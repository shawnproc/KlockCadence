import { createServiceClient } from '@/lib/supabase/server'
import { qboPost, qboQuery } from './client'

interface SyncResult {
  recordsSynced: number
  errors: string[]
  qboIds: string[]
}

interface QBOTimeActivity {
  Id?: string
  TxnDate: string
  NameOf: string
  EmployeeRef: { value: string; name?: string }
  ItemRef?: { value: string; name?: string }
  CustomerRef?: { value: string; name?: string }
  Hours: number
  Minutes: number
  Description?: string
  BillableStatus: string
  Taxable: boolean
}

interface QBOTimeActivityResponse {
  TimeActivity: QBOTimeActivity & { Id: string }
}

// Sync all approved timesheet entries in the given date range to QBO Time Activities.
export async function syncTimesheetsToQBO(
  orgId: string,
  startDate: string,
  endDate: string
): Promise<SyncResult> {
  const svc = await createServiceClient()

  // Fetch approved timesheet entries for the period
  const { data: entries, error } = await svc
    .from('timesheet_entries')
    .select(`
      id,
      user_id,
      charge_code_id,
      work_date,
      hours,
      work_description,
      charge_codes!inner (code, description, contract_number, is_billable),
      users!inner (full_name)
    `)
    .eq('org_id', orgId)
    .gte('work_date', startDate)
    .lte('work_date', endDate)
    .gt('hours', 0)

  if (error) throw new Error(`Failed to fetch timesheet entries: ${error.message}`)

  if (!entries || entries.length === 0) return { recordsSynced: 0, errors: [], qboIds: [] }

  // Fetch employee mappings for this integration
  const { data: empMappings } = await svc
    .from('integration_mappings')
    .select('kc_user_id, external_id')
    .eq('org_id', orgId)
    .eq('integration_type', 'quickbooks')

  const empMap = new Map<string, string>(
    (empMappings ?? []).map((m) => [m.kc_user_id as string, m.external_id as string])
  )

  // Fetch charge code mappings
  const { data: codeMappings } = await svc
    .from('integration_code_mappings')
    .select('charge_code_id, external_code, external_name')
    .eq('org_id', orgId)
    .eq('integration_type', 'quickbooks')

  const codeMap = new Map<string, { code: string; name: string }>(
    (codeMappings ?? []).map((m) => [
      m.charge_code_id as string,
      { code: m.external_code as string, name: (m.external_name ?? m.external_code) as string },
    ])
  )

  const errors: string[] = []
  const qboIds: string[] = []
  let synced = 0

  for (const entry of entries) {
    const qboEmployeeId = empMap.get(entry.user_id as string)
    if (!qboEmployeeId) {
      const users = entry.users as unknown as { full_name: string }
      errors.push(`No QBO mapping for employee: ${users.full_name}`)
      continue
    }

    const codeMapping = codeMap.get(entry.charge_code_id as string)
    const chargeCodes = entry.charge_codes as unknown as {
      code: string; description: string; contract_number: string | null; is_billable: boolean
    }

    const hours = Math.floor(entry.hours as number)
    const minutes = Math.round(((entry.hours as number) - hours) * 60)

    const payload: QBOTimeActivity = {
      TxnDate: entry.work_date as string,
      NameOf: 'Employee',
      EmployeeRef: { value: qboEmployeeId },
      Hours: hours,
      Minutes: minutes,
      Description: `${chargeCodes.code} — ${entry.work_description ?? chargeCodes.description} [KC:${entry.id}]`,
      BillableStatus: chargeCodes.is_billable ? 'Billable' : 'NotBillable',
      Taxable: false,
    }

    if (codeMapping) {
      payload.ItemRef = { value: codeMapping.code, name: codeMapping.name }
    }

    if (chargeCodes.contract_number) {
      // Query for QBO Customer matching contract number
      try {
        type CustomerQuery = { QueryResponse: { Customer?: { Id: string; DisplayName: string }[] } }
        const result = await qboQuery<CustomerQuery>(
          orgId,
          `select * from Customer where DisplayName = '${chargeCodes.contract_number}' MAXRESULTS 1`
        )
        const customer = result.QueryResponse.Customer?.[0]
        if (customer) {
          payload.CustomerRef = { value: customer.Id, name: customer.DisplayName }
        }
      } catch {
        // Contract mapping failure is non-fatal — continue without customer ref
      }
    }

    try {
      const res = await qboPost<QBOTimeActivityResponse>(orgId, '/timeactivity', { TimeActivity: payload })
      qboIds.push(res.TimeActivity.Id)
      synced++
    } catch (e) {
      errors.push(`Entry ${entry.id}: ${e instanceof Error ? e.message : 'Unknown error'}`)
    }
  }

  return { recordsSynced: synced, errors, qboIds }
}

// Sync approved leave requests to QBO (informational — creates a time activity against a leave item)
export async function syncLeaveToQBO(
  orgId: string,
  startDate: string,
  endDate: string
): Promise<SyncResult> {
  const svc = await createServiceClient()

  const { data: requests, error } = await svc
    .from('leave_requests')
    .select('id, user_id, leave_type, start_date, end_date, requested_hours, users!inner(full_name)')
    .eq('org_id', orgId)
    .eq('status', 'approved')
    .gte('start_date', startDate)
    .lte('end_date', endDate)

  if (error) throw new Error(`Failed to fetch leave requests: ${error.message}`)
  if (!requests || requests.length === 0) return { recordsSynced: 0, errors: [], qboIds: [] }

  const { data: empMappings } = await svc
    .from('integration_mappings')
    .select('kc_user_id, external_id')
    .eq('org_id', orgId)
    .eq('integration_type', 'quickbooks')

  const empMap = new Map<string, string>(
    (empMappings ?? []).map((m) => [m.kc_user_id as string, m.external_id as string])
  )

  const errors: string[] = []
  const qboIds: string[] = []
  let synced = 0

  for (const req of requests) {
    const qboEmployeeId = empMap.get(req.user_id as string)
    if (!qboEmployeeId) continue

    const users = req.users as unknown as { full_name: string }
    const hours = Math.floor((req.requested_hours as number))
    const minutes = Math.round(((req.requested_hours as number) - hours) * 60)

    const payload: QBOTimeActivity = {
      TxnDate: req.start_date as string,
      NameOf: 'Employee',
      EmployeeRef: { value: qboEmployeeId },
      Hours: hours,
      Minutes: minutes,
      Description: `${(req.leave_type as string).toUpperCase()} Leave — ${users.full_name} [KC:${req.id}]`,
      BillableStatus: 'NotBillable',
      Taxable: false,
    }

    try {
      const res = await qboPost<{ TimeActivity: { Id: string } }>(orgId, '/timeactivity', {
        TimeActivity: payload,
      })
      qboIds.push(res.TimeActivity.Id)
      synced++
    } catch (e) {
      errors.push(`Leave ${req.id}: ${e instanceof Error ? e.message : 'Unknown error'}`)
    }
  }

  return { recordsSynced: synced, errors, qboIds }
}
