import { NextResponse } from 'next/server'
import { randomBytes } from 'crypto'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { writeAuditLog } from '@/lib/audit/logger'
import type { UserRole } from '@/types'

const ROLES: UserRole[] = ['employee', 'manager', 'admin', 'finance']
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const MAX_ROWS = 1000

interface RawRow {
  full_name?: unknown
  email?: unknown
  role?: unknown
  department?: unknown
  hire_date?: unknown
}

// Readable temporary password the employee replaces on first login.
function tempPassword(): string {
  return 'Kc-' + randomBytes(6).toString('hex') // e.g. Kc-a1b2c3d4e5f6
}

/**
 * POST /api/admin/bulk-import
 * Body: { employees: RawRow[] }  (CSV columns: full_name, email, role, department, hire_date)
 *
 * Admin-only, email-free. For each valid row: creates a confirmed auth user
 * with a generated temporary password and a must_change_password flag in
 * user_metadata, then creates the profile in the admin's org. The temp
 * passwords are returned ONCE so the admin can distribute them; on first login
 * the employee is forced to set their own password. Existing emails are
 * skipped; invalid rows are reported.
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

  let body: { employees?: unknown }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 })
  }

  const rows = body.employees
  if (!Array.isArray(rows) || rows.length === 0) {
    return NextResponse.json({ error: 'No employees to import.' }, { status: 400 })
  }
  if (rows.length > MAX_ROWS) {
    return NextResponse.json({ error: `Too many rows (max ${MAX_ROWS}).` }, { status: 400 })
  }

  const svc = createServiceClient()
  const today = new Date().toISOString().split('T')[0]!

  const created: { email: string; full_name: string; temp_password: string }[] = []
  const skipped: { email: string; reason: string }[] = []
  const errors: { row: number; reason: string }[] = []

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i] as RawRow
    const email = typeof r.email === 'string' ? r.email.trim().toLowerCase() : ''
    const fullName = typeof r.full_name === 'string' ? r.full_name.trim() : ''

    if (!EMAIL_RE.test(email)) { errors.push({ row: i + 1, reason: 'Missing or invalid email.' }); continue }
    if (!fullName) { errors.push({ row: i + 1, reason: `Missing full_name (${email}).` }); continue }

    const roleRaw = typeof r.role === 'string' ? r.role.trim().toLowerCase() : ''
    if (roleRaw && !ROLES.includes(roleRaw as UserRole)) {
      errors.push({ row: i + 1, reason: `Invalid role "${roleRaw}" (${email}).` })
      continue
    }
    const role: UserRole = (roleRaw || 'employee') as UserRole
    const department = typeof r.department === 'string' ? r.department.trim() : ''
    const hireDate = typeof r.hire_date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(r.hire_date.trim())
      ? r.hire_date.trim()
      : today

    const { data: existing } = await svc
      .from('users')
      .select('id')
      .eq('org_id', profile.org_id)
      .eq('email', email)
      .maybeSingle()
    if (existing) { skipped.push({ email, reason: 'Already exists.' }); continue }

    const temp = tempPassword()
    const { data: authUser, error: createError } = await svc.auth.admin.createUser({
      email,
      password: temp,
      email_confirm: true,
      user_metadata: { full_name: fullName, must_change_password: true },
    })

    if (createError || !authUser?.user) {
      if ((createError?.message ?? '').toLowerCase().includes('already')) {
        skipped.push({ email, reason: 'Already registered.' })
      } else {
        errors.push({ row: i + 1, reason: `${email}: ${createError?.message ?? 'account creation failed'}` })
      }
      continue
    }

    const { error: profileError } = await svc.from('users').insert({
      id: authUser.user.id,
      org_id: profile.org_id,
      full_name: fullName,
      email,
      role,
      department,
      hire_date: hireDate,
      is_active: true,
    })

    if (profileError) {
      // Roll back the orphaned auth user so a retry can succeed.
      await svc.auth.admin.deleteUser(authUser.user.id)
      errors.push({ row: i + 1, reason: `${email}: ${profileError.message}` })
      continue
    }

    await writeAuditLog({
      org_id: profile.org_id,
      actor_id: user.id,
      action: 'USER_CREATED',
      target_table: 'users',
      target_id: authUser.user.id,
      new_value: { full_name: fullName, email, role, department, imported: true },
    })
    created.push({ email, full_name: fullName, temp_password: temp })
  }

  return NextResponse.json({
    ok: true,
    created: created.length,
    skipped: skipped.length,
    errored: errors.length,
    credentials: created, // shown ONCE for the admin to distribute
    details: { skipped, errors },
  })
}
