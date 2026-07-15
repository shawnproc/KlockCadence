import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { writeAuditLog } from '@/lib/audit/logger'

/**
 * POST /api/timesheets/[id]/approve
 * Body: { decision: 'approved' | 'rejected', reason?: string }
 *
 * Supervisor review of a submitted timesheet (a DCAA labor control).
 * Manager/admin only, same org. A reviewer cannot approve their own
 * timesheet (segregation of duties). Every decision is written to audit_log.
 */
export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })

  const { data: profile } = await supabase
    .from('users')
    .select('role, org_id')
    .eq('id', user.id)
    .single()

  if (!profile || !['manager', 'admin'].includes(profile.role)) {
    return NextResponse.json({ error: 'Manager or admin access required.' }, { status: 403 })
  }

  let body: { decision?: unknown; reason?: unknown }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 })
  }

  const decision = body.decision
  if (decision !== 'approved' && decision !== 'rejected') {
    return NextResponse.json({ error: 'decision must be "approved" or "rejected".' }, { status: 400 })
  }

  const reason = typeof body.reason === 'string' ? body.reason.trim() : ''
  if (decision === 'rejected' && reason.length < 5) {
    return NextResponse.json({ error: 'A rejection reason is required.' }, { status: 400 })
  }

  const svc = createServiceClient()

  const { data: timesheet } = await svc
    .from('timesheets')
    .select('id, org_id, user_id, status')
    .eq('id', params.id)
    .single()

  if (!timesheet || timesheet.org_id !== profile.org_id) {
    return NextResponse.json({ error: 'Timesheet not found.' }, { status: 404 })
  }
  if (timesheet.user_id === user.id) {
    return NextResponse.json({ error: 'You cannot approve your own timesheet.' }, { status: 403 })
  }
  if (timesheet.status !== 'submitted') {
    return NextResponse.json({ error: `Only submitted timesheets can be reviewed (this one is ${timesheet.status}).` }, { status: 409 })
  }

  const now = new Date().toISOString()
  const update =
    decision === 'approved'
      ? { status: 'approved', approved_by: user.id, approved_at: now, rejection_reason: null }
      : { status: 'rejected', rejection_reason: reason, approved_by: null, approved_at: null }

  const { error } = await svc
    .from('timesheets')
    .update(update)
    .eq('id', params.id)
    .eq('org_id', profile.org_id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await writeAuditLog({
    org_id: profile.org_id,
    actor_id: user.id,
    action: decision === 'approved' ? 'TIMESHEET_APPROVED' : 'TIMESHEET_REJECTED',
    target_table: 'timesheets',
    target_id: params.id,
    old_value: { status: 'submitted' },
    new_value: decision === 'approved' ? { status: 'approved' } : { status: 'rejected', rejection_reason: reason },
  })

  return NextResponse.json({ ok: true, id: params.id, status: update.status })
}
