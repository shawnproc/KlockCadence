import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { writeAuditLog } from '@/lib/audit/logger'
import { Resend } from 'resend'

interface ProxyEntryBody {
  employee_id: string
  week_start_date: string
  charge_code_id: string
  hours: Record<string, number> // work_date (YYYY-MM-DD) -> hours
  proxy_reason: string
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: actor } = await supabase
    .from('users')
    .select('role, org_id, full_name')
    .eq('id', user.id)
    .single()

  if (!actor || !['manager', 'admin'].includes(actor.role)) {
    return NextResponse.json({ error: 'Only managers and admins can create proxy entries.' }, { status: 403 })
  }

  let body: ProxyEntryBody
  try {
    body = await request.json() as ProxyEntryBody
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 })
  }
  if (!body || typeof body.hours !== 'object' || body.hours === null) {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 })
  }

  if (!body.proxy_reason || body.proxy_reason.trim().length < 50) {
    return NextResponse.json(
      { error: 'Proxy reason must be at least 50 characters. DCAA requires documented justification for all proxy entries.' },
      { status: 422 }
    )
  }

  const validEntries = Object.entries(body.hours).filter(([, h]) => h > 0)
  if (validEntries.length === 0) {
    return NextResponse.json({ error: 'At least one day must have hours greater than zero.' }, { status: 422 })
  }

  const svc = createServiceClient()

  // Verify employee exists in same org and is still active
  const { data: employee } = await svc
    .from('users')
    .select('id, full_name, email, org_id')
    .eq('id', body.employee_id)
    .eq('org_id', actor.org_id)
    .eq('is_active', true)
    .single()

  if (!employee) {
    return NextResponse.json({ error: 'Employee not found or has been deactivated.' }, { status: 404 })
  }

  // Verify charge code belongs to org
  const { data: chargeCode } = await svc
    .from('charge_codes')
    .select('id, code, description')
    .eq('id', body.charge_code_id)
    .eq('org_id', actor.org_id)
    .eq('is_active', true)
    .single()

  if (!chargeCode) {
    return NextResponse.json({ error: 'Charge code not found or inactive.' }, { status: 404 })
  }

  // Find or create timesheet for employee for that week
  const { data: existingTs } = await svc
    .from('timesheets')
    .select('id, status')
    .eq('org_id', actor.org_id)
    .eq('user_id', employee.id)
    .eq('week_start_date', body.week_start_date)
    .maybeSingle()

  let timesheetId: string

  if (existingTs) {
    timesheetId = existingTs.id as string
  } else {
    const { data: newTs, error: tsError } = await svc
      .from('timesheets')
      .insert({
        org_id: actor.org_id,
        user_id: employee.id,
        week_start_date: body.week_start_date,
        status: 'draft',
      })
      .select('id')
      .single()

    if (tsError || !newTs) {
      console.error('[proxy] timesheet create error:', tsError?.message)
      return NextResponse.json({ error: 'Failed to create timesheet.' }, { status: 500 })
    }
    timesheetId = newTs.id as string
  }

  // Insert proxy entries
  const entriesToInsert = validEntries.map(([workDate, hours]) => ({
    org_id: actor.org_id,
    timesheet_id: timesheetId,
    user_id: employee.id,
    charge_code_id: body.charge_code_id,
    work_date: workDate,
    hours,
    work_description: `[PROXY] ${body.proxy_reason}`,
    is_proxy_entry: true,
    proxy_actor_id: user.id,
    proxy_reason: body.proxy_reason.trim(),
    employee_acknowledged: false,
    entry_created_at: new Date().toISOString(),
  }))

  const { data: insertedEntries, error: insertError } = await svc
    .from('timesheet_entries')
    .insert(entriesToInsert)
    .select('id')

  if (insertError) {
    console.error('[proxy] insert error:', insertError.message)
    return NextResponse.json({ error: 'Failed to insert proxy entries.' }, { status: 500 })
  }

  const insertedIds = (insertedEntries ?? []).map((e) => (e as { id: string }).id)

  // Write audit log
  await writeAuditLog({
    org_id: actor.org_id,
    actor_id: user.id,
    action: 'PROXY_ENTRY_CREATED',
    target_table: 'timesheet_entries',
    target_id: timesheetId,
    new_value: {
      employee_id: employee.id,
      employee_name: employee.full_name,
      week_start_date: body.week_start_date,
      charge_code: chargeCode.code,
      entry_ids: insertedIds,
      proxy_reason: body.proxy_reason.trim(),
      proxy_actor: actor.full_name,
      days_entered: validEntries.map(([d, h]) => `${d}: ${h}h`),
    },
  })

  // Email employee
  const resendKey = process.env.RESEND_API_KEY
  if (resendKey) {
    try {
      const resend = new Resend(resendKey)
      const daysList = validEntries
        .map(([d, h]) => {
          const label = new Date(d).toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })
          return `<li>${label}: <strong>${h}h</strong> — ${chargeCode.code}</li>`
        })
        .join('')

      await resend.emails.send({
        from: 'KlockCadence <noreply@klockcadence.com>',
        to: employee.email,
        subject: `Action Required: Time Entered on Your Behalf for Week of ${body.week_start_date}`,
        html: `
          <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
            <div style="background: #1B2A4A; padding: 24px; border-radius: 8px 8px 0 0;">
              <h1 style="color: white; margin: 0; font-size: 20px;">KlockCadence — Proxy Time Entry</h1>
            </div>
            <div style="background: #FFF7ED; border: 1px solid #FDBA74; padding: 16px; margin: 0;">
              <p style="margin: 0; color: #9A3412; font-size: 14px;">
                <strong>Action Required:</strong> Time has been entered on your behalf. You must acknowledge these entries upon your return.
              </p>
            </div>
            <div style="padding: 24px; border: 1px solid #E5E7EB; border-top: none;">
              <p>Hello ${employee.full_name},</p>
              <p><strong>${actor.full_name}</strong> (${actor.role}) has entered time on your behalf for the week of <strong>${body.week_start_date}</strong>.</p>
              <h3 style="color: #1B2A4A;">Entries Created</h3>
              <ul>${daysList}</ul>
              <h3 style="color: #1B2A4A;">Justification</h3>
              <p style="background: #F9FAFB; border: 1px solid #E5E7EB; padding: 12px; border-radius: 4px; font-size: 14px;">
                ${body.proxy_reason.trim()}
              </p>
              <p>Please log in to KlockCadence and acknowledge these entries. Unacknowledged proxy entries are flagged as a DCAA compliance anomaly after 48 hours.</p>
              <a href="https://www.klockcadence.com/timesheets?week=${body.week_start_date}"
                 style="display: inline-block; background: #1B2A4A; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; margin-top: 8px;">
                Review &amp; Acknowledge
              </a>
              <p style="margin-top: 24px; font-size: 12px; color: #6B7280;">
                This proxy entry has been recorded in the immutable audit log per DCAA compliance requirements.
                If you have questions about this entry, contact ${actor.full_name} or your HR administrator.
              </p>
            </div>
          </div>
        `,
      })
    } catch (emailErr) {
      console.error('[proxy] email failed (non-fatal):', emailErr)
    }
  }

  return NextResponse.json({
    success: true,
    timesheet_id: timesheetId,
    entries_created: insertedIds.length,
  })
}
