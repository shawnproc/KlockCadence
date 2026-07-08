import { createServiceClient } from '@/lib/supabase/server'

interface ADPRow {
  AssociateID: string
  FileNumber: string
  EarningCode: string
  Hours: string
  StartDate: string
  EndDate: string
  HomeDeptCode: string
  LaborDeptCode: string
}

// Generate ADP Workforce Now compatible timesheet CSV.
export async function generateADPExport(
  orgId: string,
  startDate: string,
  endDate: string
): Promise<string> {
  const svc = createServiceClient()

  const { data: entries } = await svc
    .from('timesheet_entries')
    .select(`
      user_id,
      work_date,
      hours,
      charge_codes!inner (code, is_billable),
      timesheets!inner (status, week_start_date),
      users!inner (full_name, department)
    `)
    .eq('org_id', orgId)
    .gte('work_date', startDate)
    .lte('work_date', endDate)
    .gt('hours', 0)

  // Filter to approved timesheets only
  const approved = (entries ?? []).filter(
    (e) => (e.timesheets as unknown as { status: string }).status === 'approved'
  )

  const { data: empMappings } = await svc
    .from('integration_mappings')
    .select('kc_user_id, external_id')
    .eq('org_id', orgId)
    .eq('integration_type', 'adp')

  const empMap = new Map<string, string>(
    (empMappings ?? []).map((m) => [m.kc_user_id as string, m.external_id as string])
  )

  const rows: ADPRow[] = []

  for (const entry of approved) {
    const userId = entry.user_id as string
    const chargeCodes = entry.charge_codes as unknown as { code: string; is_billable: boolean }
    const users = entry.users as unknown as { full_name: string; department: string }

    const associateId = empMap.get(userId) ?? userId.slice(0, 10)
    const earningCode = chargeCodes.is_billable ? 'REG' : 'INDIR'

    rows.push({
      AssociateID: associateId,
      FileNumber: '',
      EarningCode: earningCode,
      Hours: Number(entry.hours).toFixed(2),
      StartDate: entry.work_date as string,
      EndDate: entry.work_date as string,
      HomeDeptCode: users.department,
      LaborDeptCode: chargeCodes.code,
    })
  }

  const headers = [
    'AssociateID', 'FileNumber', 'EarningCode', 'Hours', 'StartDate', 'EndDate',
    'HomeDeptCode', 'LaborDeptCode',
  ]

  const csvLines = [
    headers.join(','),
    ...rows.map((r) =>
      headers.map((h) => `"${(r as unknown as Record<string, string>)[h] ?? ''}"`).join(',')
    ),
  ]

  return csvLines.join('\r\n')
}
