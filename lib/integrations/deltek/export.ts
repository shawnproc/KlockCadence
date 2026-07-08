import { createServiceClient } from '@/lib/supabase/server'

interface DeltekRow {
  EmployeeNumber: string
  ProjectNumber: string
  PhaseCode: string
  TaskCode: string
  Date: string
  Hours: string
  WorkType: string
  Description: string
}

// Generate Deltek Vision/Vantagepoint compatible timesheet import file.
export async function generateDeltekExport(
  orgId: string,
  startDate: string,
  endDate: string
): Promise<string> {
  const svc = await createServiceClient()

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
      users!inner (full_name)
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
    .eq('integration_type', 'deltek')

  const empMap = new Map<string, string>(
    (empMappings ?? []).map((m) => [m.kc_user_id as string, m.external_id as string])
  )

  const { data: codeMappings } = await svc
    .from('integration_code_mappings')
    .select('charge_code_id, external_code')
    .eq('org_id', orgId)
    .eq('integration_type', 'deltek')

  const codeMap = new Map<string, string>(
    (codeMappings ?? []).map((m) => [m.charge_code_id as string, m.external_code as string])
  )

  const rows: DeltekRow[] = []

  for (const entry of approved) {
    const chargeCodes = entry.charge_codes as unknown as {
      code: string; description: string; contract_number: string | null; is_billable: boolean
    }

    rows.push({
      EmployeeNumber: empMap.get(entry.user_id as string) ?? '',
      ProjectNumber: chargeCodes.contract_number ?? chargeCodes.code,
      PhaseCode: '001',
      TaskCode: codeMap.get(entry.charge_code_id as string) ?? chargeCodes.code,
      Date: entry.work_date as string,
      Hours: Number(entry.hours).toFixed(2),
      WorkType: chargeCodes.is_billable ? 'REG' : 'INDIR',
      Description: (entry.work_description as string | null) ?? chargeCodes.description,
    })
  }

  const headers = [
    'EmployeeNumber', 'ProjectNumber', 'PhaseCode', 'TaskCode',
    'Date', 'Hours', 'WorkType', 'Description',
  ]

  const csvLines = [
    headers.join('\t'),
    ...rows.map((r) =>
      headers.map((h) => (r as unknown as Record<string, string>)[h] ?? '').join('\t')
    ),
  ]

  return csvLines.join('\r\n')
}
