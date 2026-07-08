import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { writeAuditLog } from '@/lib/audit/logger'

export async function GET(request: NextRequest): Promise<NextResponse> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('users')
    .select('role, org_id, full_name')
    .eq('id', user.id)
    .single()

  if (!profile || !['admin', 'finance'].includes(profile.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const start = request.nextUrl.searchParams.get('start')
  const end = request.nextUrl.searchParams.get('end')
  if (!start || !end) {
    return NextResponse.json({ error: 'start and end params required (YYYY-MM-DD).' }, { status: 422 })
  }

  const { data: entries, error } = await supabase
    .from('timesheet_entries')
    .select(`
      work_date,
      hours,
      work_description,
      users!user_id (full_name, email, department),
      charge_codes!inner (code, description, contract_number, is_billable),
      timesheets!inner (week_start_date, status)
    `)
    .eq('org_id', profile.org_id)
    .gte('work_date', start)
    .lte('work_date', end)
    .in('timesheets.status', ['submitted', 'approved'])
    .gt('hours', 0)
    .order('work_date')

  if (error) {
    console.error('[labor-distribution/csv]', error.message)
    return NextResponse.json({ error: 'Failed to generate export.' }, { status: 500 })
  }

  const rows = (entries ?? []).filter((e) => {
    const ts = e.timesheets as unknown as { status: string } | null
    return ts && ['submitted', 'approved'].includes(ts.status)
  })

  const headers = [
    'Employee Name', 'Email', 'Department',
    'Work Date', 'Week', 'Month',
    'Charge Code', 'Description', 'Contract Number',
    'Direct/Indirect', 'Hours',
  ]

  const csvLines = [
    headers.join(','),
    ...rows.map((e) => {
      const u = e.users as unknown as { full_name: string; email: string; department: string }
      const cc = e.charge_codes as unknown as { code: string; description: string; contract_number: string | null; is_billable: boolean }
      const ts = e.timesheets as unknown as { week_start_date: string }
      const workDate = e.work_date as string
      const month = workDate.slice(0, 7)
      return [
        `"${u.full_name}"`,
        `"${u.email}"`,
        `"${u.department}"`,
        `"${workDate}"`,
        `"${ts.week_start_date}"`,
        `"${month}"`,
        `"${cc.code}"`,
        `"${cc.description}"`,
        `"${cc.contract_number ?? ''}"`,
        `"${cc.is_billable ? 'Direct' : 'Indirect'}"`,
        Number(e.hours).toFixed(2),
      ].join(',')
    }),
  ]

  await writeAuditLog({
    org_id: profile.org_id as string,
    actor_id: user.id,
    action: 'LABOR_REPORT_EXPORTED',
    target_table: 'timesheet_entries',
    target_id: profile.org_id as string,
    new_value: { start, end, exported_by: profile.full_name, row_count: rows.length },
  })

  return new NextResponse(csvLines.join('\r\n'), {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="Timesheets_${start}_${end}.csv"`,
    },
  })
}
