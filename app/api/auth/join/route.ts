import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { checkRateLimit, clientIp } from '@/lib/auth/rate-limit'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/**
 * POST /api/auth/join
 * Body: { full_name, email, password, company_code }
 *
 * Self-service signup that JOINS an existing company by its company_code, as a
 * regular EMPLOYEE. Admin access is never granted here — an existing admin must
 * promote a user (audited) via /api/admin/users/[id]/role. Creates a
 * pre-confirmed account + profile so they can sign in immediately.
 */
export async function POST(request: Request) {
  if (!(await checkRateLimit(clientIp(request), 'join', 10, 600))) {
    return NextResponse.json({ error: 'Too many attempts. Please try again in a few minutes.' }, { status: 429 })
  }

  let body: {
    full_name?: unknown
    email?: unknown
    password?: unknown
    company_code?: unknown
  }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 })
  }

  const fullName = typeof body.full_name === 'string' ? body.full_name.trim() : ''
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : ''
  const password = typeof body.password === 'string' ? body.password : ''
  const companyCode = typeof body.company_code === 'string' ? body.company_code.trim().toUpperCase() : ''

  if (!fullName) return NextResponse.json({ error: 'Enter your full name.' }, { status: 400 })
  if (!EMAIL_RE.test(email)) return NextResponse.json({ error: 'Enter a valid email address.' }, { status: 400 })
  if (password.length < 8) return NextResponse.json({ error: 'Password must be at least 8 characters.' }, { status: 400 })
  if (!companyCode) return NextResponse.json({ error: 'Enter your company code.' }, { status: 400 })

  const svc = createServiceClient()

  const { data: org } = await svc
    .from('organizations')
    .select('id')
    .eq('company_code', companyCode)
    .maybeSingle()

  if (!org) {
    return NextResponse.json({ error: 'Invalid company code. Check with your administrator.' }, { status: 404 })
  }

  // Always join as a regular employee; elevation is an admin-initiated action.
  const role = 'employee' as const

  const { data: authUser, error: createError } = await svc.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: fullName },
  })

  if (createError || !authUser?.user) {
    const msg = (createError?.message ?? '').toLowerCase()
    if (msg.includes('already') || msg.includes('registered') || msg.includes('exists')) {
      return NextResponse.json({ error: 'An account with that email already exists. Try signing in.' }, { status: 409 })
    }
    return NextResponse.json({ error: createError?.message ?? 'Could not create account.' }, { status: 500 })
  }

  const { error: profileError } = await svc.from('users').insert({
    id: authUser.user.id,
    org_id: org.id,
    full_name: fullName,
    email,
    role,
    department: '',
    hire_date: new Date().toISOString().split('T')[0]!,
    is_active: true,
  })

  if (profileError) {
    await svc.auth.admin.deleteUser(authUser.user.id)
    return NextResponse.json({ error: profileError.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true, role })
}
