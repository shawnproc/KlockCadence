import { NextResponse } from 'next/server'
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

/**
 * POST /api/admin/bulk-import
 * Body: { employees: RawRow[] }  (CSV columns: full_name, email, role, department, hire_date)
 *
 * Admin-only. For each valid row: sends a Supabase invite email (the employee
 * sets their own password) and creates their profile in the admin's org.
 * Existing emails are skipped; invalid rows are reported. Nothing is faked —
 * the response returns exact created / skipped / error counts.
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
  const appUrl = (process.env.NEXT_PUBLIC_APP_URL || '').replace(/\/$/, '')
  const redirectTo = `${appUrl}/api/auth/callback?next=/auth/set-password`
  const today = new Date().toISOString().split('T')[0]!

  const created: string[] = []
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

    // Skip if a profile with this email already exists in the org.
    const { data: existing } = await svc
      .from('users')
      .select('id')
      .eq('org_id', profile.org_id)
      .eq('email', email)
      .maybeSingle()
    if (existing) { skipped.push({ email, reason: 'Already exists.' }); continue }

    // Invite: creates the auth user and emails a set-password link.
    const { data: invited, error: inviteError } = await svc.auth.admin.inviteUserByEmail(email, {
      data: { full_name: fullName },
      redirectTo,
    })

    if (inviteError || !invited?.user) {
      if ((inviteError?.message ?? '').toLowerCase().includes('already')) {
        skipped.push({ email, reason: 'Already registered.' })
      } else {
        errors.push({ row: i + 1, reason: `${email}: ${inviteError?.message ?? 'invite failed'}` })
      }
      continue
    }

    const { error: profileError } = await svc.from('users').insert({
      id: invited.user.id,
      org_id: profile.org_id,
      full_name: fullName,
      email,
      role,
      department,
      hire_date: hireDate,
      is_active: true,
    })

    if (profileError) { errors.push({ row: i + 1, reason: `${email}: ${profileError.message}` }); continue }

    await writeAuditLog({
      org_id: profile.org_id,
      actor_id: user.id,
      action: 'USER_CREATED',
      target_table: 'users',
      target_id: invited.user.id,
      new_value: { full_name: fullName, email, role, department, imported: true },
    })
    created.push(email)
  }

  return NextResponse.json({
    ok: true,
    created: created.length,
    skipped: skipped.length,
    errored: errors.length,
    details: { skipped, errors },
  })
}
