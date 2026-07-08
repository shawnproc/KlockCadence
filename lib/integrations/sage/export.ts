import { createServiceClient } from '@/lib/supabase/server'

// Sage Intacct labor distribution export.
// Format: Intacct project/task time entry CSV for manual import via Intacct web UI.
interface SageRow {
  EmployeeID: string
  ProjectID: string
  TaskID: string
  EntryDate: string
  Quantity: string
  Description: string
  BillableFlag: string
  Department: string
}

export async function generateSageExport(
  orgId: string,
  startDate: string,
  endDate: string
): Promise<string> {
  const svc = createServiceClient()

  const { data: entries } = await svc
    .from('timesheet_entries')
    .select(`
      user_id,
      charge_code_id,
      work_date,
      hours,
      work_description,
      charge_codes!inner (code, description, contract_number, is_billable),
      timesheets!inner (status),
      users!inner (full_name, department)
    `)
    .eq('org_id', orgId)
    .gte('work_date', startDate)
    .lte('work_date', endDate)
    .gt('hours', 0)

  const approved = (entries ?? []).filter(
    (e) => (e.timesheets as unknown as { status: string }).status === 'approved'
  )

  const { data: empMappings } = await svc
    .from('integration_mappings')
    .select('kc_user_id, external_id')
    .eq('org_id', orgId)
    .eq('integration_type', 'sage_intacct')

  const empMap = new Map<string, string>(
    (empMappings ?? []).map((m) => [m.kc_user_id as string, m.external_id as string])
  )

  const { data: codeMappings } = await svc
    .from('integration_code_mappings')
    .select('charge_code_id, external_code, external_name')
    .eq('org_id', orgId)
    .eq('integration_type', 'sage_intacct')

  const codeMap = new Map<string, { project: string; task: string }>(
    (codeMappings ?? []).map((m) => {
      const [project, task] = (m.external_code as string).split(':')
      return [m.charge_code_id as string, { project: project ?? '', task: task ?? '' }]
    })
  )

  const rows: SageRow[] = []

  for (const entry of approved) {
    const chargeCodes = entry.charge_codes as unknown as {
      code: string; description: string; contract_number: string | null; is_billable: boolean
    }
    const users = entry.users as unknown as { full_name: string; department: string }
    const mapping = codeMap.get(entry.charge_code_id as string)

    rows.push({
      EmployeeID: empMap.get(entry.user_id as string) ?? '',
      ProjectID: mapping?.project ?? chargeCodes.contract_number ?? chargeCodes.code,
      TaskID: mapping?.task ?? chargeCodes.code,
      EntryDate: entry.work_date as string,
      Quantity: Number(entry.hours).toFixed(2),
      Description: (entry.work_description as string | null) ?? chargeCodes.description,
      BillableFlag: chargeCodes.is_billable ? 'T' : 'F',
      Department: users.department,
    })
  }

  const headers = [
    'EmployeeID', 'ProjectID', 'TaskID', 'EntryDate',
    'Quantity', 'Description', 'BillableFlag', 'Department',
  ]

  const csvLines = [
    headers.join(','),
    ...rows.map((r) =>
      headers.map((h) => `"${((r as unknown as Record<string, string>)[h] ?? '').replace(/"/g, '""')}"`).join(',')
    ),
  ]

  return csvLines.join('\r\n')
}
