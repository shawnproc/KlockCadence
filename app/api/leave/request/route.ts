import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { writeAuditLog } from '@/lib/audit/logger'
import type { LeaveType } from '@/types'

const LEAVE_TYPES: LeaveType[] = ['annual', 'sick', 'comp', 'jury_duty', 'bereavement', 'fmla', 'unpaid']

/**
 * POST /api/leave/request
 * The system is the approver: if the employee's available balance covers the
 * request it is approved instantly and the hours are deducted; otherwise it is
 * rejected. No manager step. Every approval is written to the audit_log.
 *
 * Leave types without a tracked balance (unpaid, jury_duty, bereavement, fmla,
 * comp) are recorded as approved without a balance check — they are not
 * balance-limited.
 */
export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })

  const { data: profile } = await supabase
    .from('users')
    .select('org_id')
    .eq('id', user.id)
    .single()

  if (!profile) return NextResponse.json({ error: 'Profile not found.' }, { status: 403 })

  let body: {
    leave_type?: unknown
    requested_hours?: unknown
    start_date?: unknown
    end_date?: unknown
    employee_notes?: unknown
  }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 })
  }

  const leaveType = body.leave_type
  const requested = Number(body.requested_hours)
  const startDate = body.start_date
  const endDate = body.end_date

  if (typeof leaveType !== 'string' || !LEAVE_TYPES.includes(leaveType as LeaveType)) {
    return NextResponse.json({ error: 'Invalid leave type.' }, { status: 400 })
  }
  if (!Number.isFinite(requested) || requested <= 0) {
    return NextResponse.json({ error: 'Requested hours must be greater than zero.' }, { status: 400 })
  }
  if (typeof startDate !== 'string' || typeof endDate !== 'string') {
    return NextResponse.json({ error: 'Start and end dates are required.' }, { status: 400 })
  }

  const svc = createServiceClient()

  // Balance check (only for balance-tracked leave types).
  const { data: balance } = await svc
    .from('leave_balances')
    .select('id, available_hours, used_hours')
    .eq('org_id', profile.org_id)
    .eq('user_id', user.id)
    .eq('leave_type', leaveType)
    .maybeSingle()

  if (balance) {
    const available = Number(balance.available_hours)
    if (requested > available) {
      return NextResponse.json(
        { error: `Insufficient balance: requesting ${requested.toFixed(2)}h but only ${available.toFixed(2)}h available.` },
        { status: 422 }
      )
    }
  }

  // Insert the approved request FIRST so the unauthorized-balance-edit trigger
  // sees an approved request when the balance is then deducted.
  const { data: inserted, error: insertError } = await svc
    .from('leave_requests')
    .insert({
      org_id: profile.org_id,
      user_id: user.id,
      leave_type: leaveType,
      requested_hours: requested,
      start_date: startDate,
      end_date: endDate,
      employee_notes: typeof body.employee_notes === 'string' && body.employee_notes ? body.employee_notes : null,
      status: 'approved',
      reviewed_by: null,
      reviewed_at: new Date().toISOString(),
      reviewer_notes: 'Auto-approved by system: sufficient balance.',
    })
    .select('id')
    .single()

  if (insertError || !inserted) {
    return NextResponse.json({ error: insertError?.message ?? 'Could not record leave request.' }, { status: 500 })
  }

  // Deduct atomically (guards against lost-update / over-spend races): the RPC
  // only deducts if the balance still covers the request.
  if (balance) {
    const { data: deducted, error: deductError } = await svc.rpc('deduct_leave_balance', {
      p_org_id: profile.org_id,
      p_user_id: user.id,
      p_leave_type: leaveType,
      p_hours: requested,
    })

    if (deductError || deducted !== true) {
      // Roll back the approved request we just inserted.
      await svc.from('leave_requests').delete().eq('id', inserted.id)
      if (deductError) {
        return NextResponse.json({ error: `Could not deduct balance: ${deductError.message}` }, { status: 500 })
      }
      return NextResponse.json(
        { error: `Insufficient balance: requesting ${requested.toFixed(2)}h but the balance no longer covers it.` },
        { status: 422 }
      )
    }
  }

  await writeAuditLog({
    org_id: profile.org_id,
    actor_id: user.id,
    action: 'LEAVE_REQUEST_APPROVED',
    target_table: 'leave_requests',
    target_id: inserted.id,
    new_value: { leave_type: leaveType, requested_hours: requested, auto_approved: true },
  })

  return NextResponse.json({ ok: true, status: 'approved', id: inserted.id, balance_tracked: !!balance })
}
