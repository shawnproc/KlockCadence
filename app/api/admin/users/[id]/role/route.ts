import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { writeAuditLog } from '@/lib/audit/logger'
import type { UserRole } from '@/types'

const ROLES: UserRole[] = ['employee', 'manager', 'admin', 'finance']

/**
 * POST /api/admin/users/[id]/role
 * Body: { role }
 *
 * Admin-only, audited role change — the checks-and-balances replacement for the
 * shared admin password. An admin promotes/demotes a specific user in their own
 * org; every change is written to audit_log (USER_ROLE_CHANGED) for
 * per-person accountability. Admins cannot change their own role (prevents
 * accidental self-lockout and self-elevation loops).
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
    .select('role, org_id, is_active')
    .eq('id', user.id)
    .single()

  if (!profile || !profile.is_active || profile.role !== 'admin') {
    return NextResponse.json({ error: 'Admin access required.' }, { status: 403 })
  }

  let body: { role?: unknown }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 })
  }

  const role = body.role
  if (typeof role !== 'string' || !ROLES.includes(role as UserRole)) {
    return NextResponse.json({ error: 'Invalid role.' }, { status: 400 })
  }

  if (params.id === user.id) {
    return NextResponse.json({ error: 'You cannot change your own role.' }, { status: 400 })
  }

  const svc = createServiceClient()

  const { data: target } = await svc
    .from('users')
    .select('id, org_id, role')
    .eq('id', params.id)
    .single()

  if (!target || target.org_id !== profile.org_id) {
    return NextResponse.json({ error: 'User not found.' }, { status: 404 })
  }

  if (target.role === role) {
    return NextResponse.json({ ok: true, role })
  }

  const { error } = await svc
    .from('users')
    .update({ role })
    .eq('id', params.id)
    .eq('org_id', profile.org_id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await writeAuditLog({
    org_id: profile.org_id,
    actor_id: user.id,
    action: 'USER_ROLE_CHANGED',
    target_table: 'users',
    target_id: params.id,
    old_value: { role: target.role },
    new_value: { role },
  })

  return NextResponse.json({ ok: true, role })
}
