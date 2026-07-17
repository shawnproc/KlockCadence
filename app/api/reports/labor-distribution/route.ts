import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { writeAuditLog } from '@/lib/audit/logger'

export interface LaborRow {
  employee_name: string
  employee_email: string
  department: string
  charge_code: string
  charge_description: string
  contract_number: string
  is_billable: boolean
  total_hours: number
  has_proxy_hours: boolean
}

export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('users')
    .select('role, org_id, full_name')
    .eq('id', user.id)
    .single()

  if (!profile || !['admin', 'finance'].includes(profile.role)) {
    return NextResponse.json({ error: 'Forbidden — finance or admin role required.' }, { status: 403 })
  }

  const { searchParams } = new URL(request.url)
  const month = searchParams.get('month') // YYYY-MM
  if (!month || !/^\d{4}-\d{2}$/.test(month)) {
    return NextResponse.json({ error: 'month param required in YYYY-MM format.' }, { status: 422 })
  }

  const monthDate = `${month}-01`

  // RPC execute is revoked from `authenticated` (it's SECURITY DEFINER and must
  // not be callable directly with an arbitrary org_id). Call it as service_role
  // after the role/org checks above, passing the caller's own org_id.
  const svc = createServiceClient()
  const { data, error } = await svc.rpc('get_labor_distribution', {
    p_org_id: profile.org_id,
    p_month: monthDate,
  })

  if (error) {
    console.error('[labor-distribution] rpc error:', error.message)
    return NextResponse.json({ error: 'Failed to generate report.' }, { status: 500 })
  }

  const rows = (data ?? []) as LaborRow[]

  await writeAuditLog({
    org_id: profile.org_id,
    actor_id: user.id,
    action: 'LABOR_REPORT_EXPORTED',
    target_table: 'timesheet_entries',
    target_id: profile.org_id,
    new_value: {
      month,
      exported_by: profile.full_name,
      role: profile.role,
      row_count: rows.length,
    },
  })

  return NextResponse.json({ rows, month })
}
