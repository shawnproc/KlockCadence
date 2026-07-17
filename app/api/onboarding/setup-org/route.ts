import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { writeAuditLog } from '@/lib/audit/logger'
import { hashAdminPassword, generateCompanyCode } from '@/lib/auth/company'

/**
 * POST /api/onboarding/setup-org
 * Creates an organization AND links the authenticated caller to it as its
 * admin (the piece onboarding was missing). Requires a logged-in user who is
 * not already attached to an org.
 */
export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'You must be signed in to create an organization.' }, { status: 401 })

  let body: { name?: unknown; slug?: unknown; fiscal_year_start?: unknown; holiday_schedule?: unknown; admin_password?: unknown }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 })
  }

  const name = typeof body.name === 'string' ? body.name.trim() : ''
  if (!name) return NextResponse.json({ error: 'Organization name is required.' }, { status: 400 })

  const adminPassword = typeof body.admin_password === 'string' ? body.admin_password : ''
  if (adminPassword.length < 8) {
    return NextResponse.json({ error: 'Set an admin password of at least 8 characters (share it only with people who should be admins).' }, { status: 400 })
  }

  const slug = (typeof body.slug === 'string' && body.slug.trim())
    ? body.slug.trim()
    : name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')
  const fiscalYearStart = typeof body.fiscal_year_start === 'string' && body.fiscal_year_start
    ? body.fiscal_year_start
    : `${new Date().getUTCFullYear()}-01-01`
  const holidaySchedule = body.holiday_schedule === 'custom' ? 'custom' : 'federal'

  const svc = createServiceClient()

  // Guard against attaching to / creating a second org.
  const { data: existingProfile } = await svc
    .from('users')
    .select('org_id')
    .eq('id', user.id)
    .maybeSingle()
  if (existingProfile?.org_id) {
    return NextResponse.json({ error: 'You already belong to an organization.' }, { status: 409 })
  }

  const companyCode = generateCompanyCode()
  const { data: org, error: orgError } = await svc
    .from('organizations')
    .insert({
      name,
      slug,
      fiscal_year_start: fiscalYearStart,
      holiday_schedule: holidaySchedule,
      company_code: companyCode,
      admin_password_hash: hashAdminPassword(adminPassword),
    })
    .select('id, company_code')
    .single()

  if (orgError || !org) {
    return NextResponse.json({ error: orgError?.message ?? 'Could not create organization.' }, { status: 500 })
  }

  // Link the caller as this org's admin.
  const { error: profileError } = await svc.from('users').upsert({
    id: user.id,
    org_id: org.id,
    full_name: (user.user_metadata?.full_name as string) || user.email || 'Admin',
    email: user.email ?? '',
    role: 'admin',
    department: 'Operations',
    hire_date: new Date().toISOString().split('T')[0]!,
    is_active: true,
  })

  if (profileError) {
    return NextResponse.json({ error: `Org created, but linking admin failed: ${profileError.message}` }, { status: 500 })
  }

  await writeAuditLog({
    org_id: org.id,
    actor_id: user.id,
    action: 'ORG_SETTINGS_UPDATED',
    target_table: 'organizations',
    target_id: org.id,
    new_value: { created: true, name },
  })

  return NextResponse.json({ ok: true, org_id: org.id, company_code: org.company_code })
}
