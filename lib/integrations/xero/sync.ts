import { createServiceClient } from '@/lib/supabase/server'
import { xeroPost } from './client'
import { getTokens } from '../tokens'

interface XeroSyncResult {
  recordsSynced: number
  errors: string[]
}

// Sync approved timesheet entries to Xero Timesheet records.
// Xero timesheets are weekly, so we group entries by user + week.
export async function syncTimesheetsToXero(
  orgId: string,
  startDate: string,
  endDate: string
): Promise<XeroSyncResult> {
  const svc = createServiceClient()
  await getTokens(orgId, 'xero') // validates connection

  const { data: entries } = await svc
    .from('timesheet_entries')
    .select(`
      user_id,
      work_date,
      hours,
      charge_codes!inner (code, description),
      timesheets!inner (status, week_start_date),
      users!inner (full_name)
    `)
    .eq('org_id', orgId)
    .gte('work_date', startDate)
    .lte('work_date', endDate)
    .gt('hours', 0)

  const approved = (entries ?? []).filter(
    (e) => (e.timesheets as unknown as { status: string }).status === 'approved'
  )
  if (approved.length === 0) return { recordsSynced: 0, errors: [] }

  const { data: empMappings } = await svc
    .from('integration_mappings')
    .select('kc_user_id, external_id')
    .eq('org_id', orgId)
    .eq('integration_type', 'xero')

  const empMap = new Map<string, string>(
    (empMappings ?? []).map((m) => [m.kc_user_id as string, m.external_id as string])
  )

  // Group by user + week_start_date
  const weekMap = new Map<string, { userId: string; weekStart: string; hours: number[] }>()

  for (const entry of approved) {
    const ts = entry.timesheets as unknown as { week_start_date: string }
    const key = `${entry.user_id}:${ts.week_start_date}`
    if (!weekMap.has(key)) {
      weekMap.set(key, { userId: entry.user_id as string, weekStart: ts.week_start_date, hours: [0, 0, 0, 0, 0, 0, 0] })
    }
    const week = weekMap.get(key)!
    const dayOffset = Math.floor(
      (new Date(entry.work_date as string).getTime() - new Date(ts.week_start_date).getTime()) / 86400000
    )
    if (dayOffset >= 0 && dayOffset <= 6) {
      week.hours[dayOffset] = (week.hours[dayOffset] ?? 0) + (entry.hours as number)
    }
  }

  const errors: string[] = []
  let synced = 0

  for (const week of Array.from(weekMap.values())) {
    const xeroEmployeeId = empMap.get(week.userId)
    if (!xeroEmployeeId) {
      errors.push(`No Xero mapping for user: ${week.userId}`)
      continue
    }

    // Xero date format: /Date(milliseconds+0000)/
    const startMs = new Date(week.weekStart).getTime()
    const endMs = startMs + 6 * 86400000

    try {
      await xeroPost(orgId, '/api.xro/2.0/Timesheets', {
        Timesheets: [
          {
            EmployeeID: xeroEmployeeId,
            StartDate: `/Date(${startMs}+0000)/`,
            EndDate: `/Date(${endMs}+0000)/`,
            Status: 'APPROVED',
            TimesheetLines: [
              {
                NumberOfUnits: week.hours,
              },
            ],
          },
        ],
      })
      synced++
    } catch (e) {
      errors.push(`Week ${week.weekStart} user ${week.userId}: ${e instanceof Error ? e.message : 'Unknown'}`)
    }
  }

  return { recordsSynced: synced, errors }
}
