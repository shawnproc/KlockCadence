import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { writeAuditLog } from '@/lib/audit/logger'
import { validateCertificationName } from '@/lib/dcaa/validators'

/**
 * POST /api/timesheets/certify
 * Body: { timesheet_id, typed_name }
 *
 * Server-authoritative certification (the DCAA / False Claims Act attestation).
 * Verifies the caller owns the timesheet, the typed name matches their legal
 * name, and every entry has a work description — THEN sets the certified flag
 * and submits, in one place. Certification can no longer be set from the client.
 */
export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })

  const { data: profile } = await supabase
    .from('users')
    .select('org_id, full_name, is_active')
    .eq('id', user.id)
    .single()

  if (!profile || !profile.is_active) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 403 })
  }

  let body: { timesheet_id?: unknown; typed_name?: unknown }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 })
  }

  const timesheetId = typeof body.timesheet_id === 'string' ? body.timesheet_id : ''
  const typedName = typeof body.typed_name === 'string' ? body.typed_name : ''
  if (!timesheetId) return NextResponse.json({ error: 'timesheet_id is required.' }, { status: 400 })

  // The typed name must match the employee's legal name (attestation integrity).
  const nameCheck = validateCertificationName(typedName, profile.full_name)
  if (!nameCheck.valid) {
    return NextResponse.json({ error: nameCheck.errors[0] ?? 'Typed name does not match your legal name.' }, { status: 422 })
  }

  const svc = createServiceClient()

  const { data: ts } = await svc
    .from('timesheets')
    .select('id, org_id, user_id, status')
    .eq('id', timesheetId)
    .single()

  if (!ts || ts.org_id !== profile.org_id) {
    return NextResponse.json({ error: 'Timesheet not found.' }, { status: 404 })
  }
  if (ts.user_id !== user.id) {
    return NextResponse.json({ error: 'You can only certify your own timesheet.' }, { status: 403 })
  }
  if (!['draft', 'rejected'].includes(ts.status)) {
    return NextResponse.json({ error: `This timesheet cannot be certified (status: ${ts.status}).` }, { status: 409 })
  }

  // DCAA: every entry must have a work description of at least 10 characters.
  const { data: entries } = await svc
    .from('timesheet_entries')
    .select('work_description')
    .eq('timesheet_id', timesheetId)
    .eq('org_id', profile.org_id)

  const invalid = (entries ?? []).filter((e) => !e.work_description || e.work_description.trim().length < 10)
  if (invalid.length > 0) {
    return NextResponse.json(
      { error: `${invalid.length} time ${invalid.length === 1 ? 'entry is' : 'entries are'} missing required work descriptions (minimum 10 characters).` },
      { status: 422 }
    )
  }

  const now = new Date().toISOString()
  const { error: updateError } = await svc
    .from('timesheets')
    .update({ certified_by_employee: true, certified_at: now, status: 'submitted', rejection_reason: null })
    .eq('id', timesheetId)
    .eq('org_id', profile.org_id)

  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 })

  await writeAuditLog({
    org_id: profile.org_id,
    actor_id: user.id,
    action: 'CERTIFICATION_SIGNED',
    target_table: 'timesheets',
    target_id: timesheetId,
    new_value: { typed_name: typedName, certified_at: now },
  })

  return NextResponse.json({ ok: true, status: 'submitted' })
}
