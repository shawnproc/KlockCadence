import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { writeAuditLog } from '@/lib/audit/logger'

// Ban far into the future — effectively permanent until reactivated.
const BAN_DURATION = '876000h' // ~100 years

/**
 * POST /api/admin/users/[id]/deactivate
 * Body: { active: boolean }
 *   active=false → offboard: block login + hide from active rosters
 *   active=true  → reactivate
 *
 * Records are never deleted (DCAA retention); only access + visibility change.
 * Admin-only, scoped to the caller's org.
 */
export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  const targetId = params.id

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })

  const { data: profile } = await supabase
    .from('users')
    .select('role, org_id, is_active')
    .eq('id', user.id)
    .single()

  if (!profile || !profile.is_active || profile.role !== 'admin') {
    return NextResponse.json({ error: 'Admin access required.' }, { status: 403 })
  }

  let body: { active?: unknown }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 })
  }

  if (typeof body.active !== 'boolean') {
    return NextResponse.json({ error: 'Field "active" (boolean) is required.' }, { status: 400 })
  }
  const active = body.active

  if (!active && targetId === user.id) {
    return NextResponse.json(
      { error: 'You cannot deactivate your own account.' },
      { status: 400 }
    )
  }

  const svc = createServiceClient()

  // Target must exist and belong to the same org.
  const { data: target } = await svc
    .from('users')
    .select('id, full_name, org_id, is_active')
    .eq('id', targetId)
    .single()

  if (!target || target.org_id !== profile.org_id) {
    return NextResponse.json({ error: 'User not found.' }, { status: 404 })
  }

  if (target.is_active === active) {
    return NextResponse.json(
      { error: `User is already ${active ? 'active' : 'deactivated'}.` },
      { status: 409 }
    )
  }

  // Flip the profile flag (records are retained; only status changes).
  const { error: updateError } = await svc
    .from('users')
    .update({
      is_active: active,
      deactivated_at: active ? null : new Date().toISOString(),
      deactivated_by: active ? null : user.id,
    })
    .eq('id', targetId)
    .eq('org_id', profile.org_id)

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 })
  }

  // Block (or restore) the ability to sign in. Any existing session is also
  // rejected by the dashboard layout's is_active gate.
  const { error: banError } = await svc.auth.admin.updateUserById(targetId, {
    ban_duration: active ? 'none' : BAN_DURATION,
  })

  if (banError) {
    // Roll the profile flag back so state stays consistent with auth.
    await svc
      .from('users')
      .update({
        is_active: target.is_active,
        deactivated_at: active ? new Date().toISOString() : null,
        deactivated_by: active ? user.id : null,
      })
      .eq('id', targetId)
      .eq('org_id', profile.org_id)
    return NextResponse.json({ error: `Auth update failed: ${banError.message}` }, { status: 500 })
  }

  await writeAuditLog({
    org_id: profile.org_id,
    actor_id: user.id,
    action: active ? 'USER_REACTIVATED' : 'USER_DEACTIVATED',
    target_table: 'users',
    target_id: targetId,
    old_value: { is_active: target.is_active },
    new_value: { is_active: active },
  })

  return NextResponse.json({ ok: true, id: targetId, is_active: active })
}
