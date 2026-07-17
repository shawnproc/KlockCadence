import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { writeAuditLog } from '@/lib/audit/logger'
import { hashAdminPassword } from '@/lib/auth/company'

/**
 * POST /api/admin/org/admin-password
 * Body: { password }
 * Admin-only. Sets/rotates the company admin password that grants the admin
 * role at signup. Stored as a salted hash; never returned.
 */
export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })

  const { data: profile } = await supabase
    .from('users')
    .select('role, org_id')
    .eq('id', user.id)
    .single()

  if (!profile || profile.role !== 'admin') {
    return NextResponse.json({ error: 'Admin access required.' }, { status: 403 })
  }

  let body: { password?: unknown }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 })
  }

  const password = typeof body.password === 'string' ? body.password : ''
  if (password.length < 8) {
    return NextResponse.json({ error: 'Admin password must be at least 8 characters.' }, { status: 400 })
  }

  const svc = createServiceClient()
  const { error } = await svc
    .from('organizations')
    .update({ admin_password_hash: hashAdminPassword(password) })
    .eq('id', profile.org_id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await writeAuditLog({
    org_id: profile.org_id,
    actor_id: user.id,
    action: 'ORG_SETTINGS_UPDATED',
    target_table: 'organizations',
    target_id: profile.org_id,
    new_value: { admin_password_changed: true },
  })

  return NextResponse.json({ ok: true })
}
