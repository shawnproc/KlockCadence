import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
)

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')!

interface AnomalyInsert {
  org_id: string
  user_id: string
  anomaly_type: string
  severity: string
  description: string
}

async function insertAnomaly(a: AnomalyInsert) {
  const { error } = await supabase.from('anomalies').insert(a)
  if (error) console.error('Failed to insert anomaly:', error.message)
}

async function notifyAdmins(orgId: string, subject: string, body: string) {
  const { data: recipients } = await supabase
    .from('users')
    .select('email')
    .eq('org_id', orgId)
    .in('role', ['admin', 'finance'])

  if (!recipients || recipients.length === 0) return

  for (const r of recipients) {
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: 'KlockCadence <alerts@klockcadence.com>',
        to: r.email,
        subject,
        html: `<p>${body}</p>`,
      }),
    })
  }
}

// Rule 1: Leave request with insufficient balance
async function checkInsufficientBalance(orgId: string) {
  const { data: pendingRequests } = await supabase
    .from('leave_requests')
    .select('id, user_id, leave_type, requested_hours')
    .eq('org_id', orgId)
    .eq('status', 'pending')

  for (const req of pendingRequests ?? []) {
    const { data: balance } = await supabase
      .from('leave_balances')
      .select('available_hours')
      .eq('org_id', orgId)
      .eq('user_id', req.user_id)
      .eq('leave_type', req.leave_type)
      .maybeSingle()

    if (balance && req.requested_hours > balance.available_hours) {
      await insertAnomaly({
        org_id: orgId,
        user_id: req.user_id,
        anomaly_type: 'insufficient_balance',
        severity: 'critical',
        description: `Leave request for ${req.requested_hours}h but only ${balance.available_hours}h available (${req.leave_type})`,
      })
    }
  }
}

// Rule 5: Timesheet not submitted by Friday
async function checkMissingTimesheets(orgId: string) {
  const now = new Date()
  const day = now.getDay()
  if (day !== 6 && day !== 0) return // only check on weekends

  const daysToMonday = day === 0 ? -6 : 1 - day
  const monday = new Date(now)
  monday.setDate(now.getDate() + daysToMonday - 7)
  const weekStart = monday.toISOString().split('T')[0]!

  const { data: employees } = await supabase
    .from('users')
    .select('id')
    .eq('org_id', orgId)
    .eq('role', 'employee')

  for (const emp of employees ?? []) {
    const { data: ts } = await supabase
      .from('timesheets')
      .select('id, status')
      .eq('org_id', orgId)
      .eq('user_id', emp.id)
      .eq('week_start_date', weekStart)
      .maybeSingle()

    if (!ts || ts.status === 'draft') {
      await insertAnomaly({
        org_id: orgId,
        user_id: emp.id,
        anomaly_type: 'missing_timesheet',
        severity: 'high',
        description: `Timesheet not submitted for week of ${weekStart}`,
      })
    }
  }
}

// Rule 9: PTO accrual not processed on pay period date
async function checkMissingAccruals(orgId: string) {
  const { data: balances } = await supabase
    .from('leave_balances')
    .select('id, user_id, leave_type, last_accrual_date')
    .eq('org_id', orgId)

  const now = new Date()
  for (const balance of balances ?? []) {
    if (!balance.last_accrual_date) continue
    const lastAccrual = new Date(balance.last_accrual_date)
    const daysSince = (now.getTime() - lastAccrual.getTime()) / (1000 * 60 * 60 * 24)
    if (daysSince > 16) {
      await insertAnomaly({
        org_id: orgId,
        user_id: balance.user_id,
        anomaly_type: 'missing_accrual',
        severity: 'medium',
        description: `Leave accrual overdue by ${Math.floor(daysSince - 14)} days for ${balance.leave_type}`,
      })
    }
  }
}

// Rule: Proxy entries not acknowledged by employee within 48 hours
async function checkProxyEntryAcknowledgments(orgId: string) {
  const now = new Date()
  const cutoff = new Date(now.getTime() - 48 * 60 * 60 * 1000)

  const { data: entries } = await supabase
    .from('timesheet_entries')
    .select('user_id, work_date, created_at')
    .eq('org_id', orgId)
    .eq('is_proxy_entry', true)
    .eq('employee_acknowledged', false)
    .lte('created_at', cutoff.toISOString())

  if (!entries || entries.length === 0) return

  // Group by user so we create one anomaly per employee, not per entry
  const userCounts: Record<string, number> = {}
  for (const entry of entries) {
    const uid = entry.user_id as string
    userCounts[uid] = (userCounts[uid] ?? 0) + 1
  }

  for (const [userId, count] of Object.entries(userCounts)) {
    const { data: existing } = await supabase
      .from('anomalies')
      .select('id')
      .eq('org_id', orgId)
      .eq('user_id', userId)
      .eq('anomaly_type', 'proxy_entry_unacknowledged')
      .eq('resolved', false)
      .maybeSingle()

    if (!existing) {
      await insertAnomaly({
        org_id: orgId,
        user_id: userId,
        anomaly_type: 'proxy_entry_unacknowledged',
        severity: 'high',
        description: `Employee has ${count} unacknowledged proxy time entr${count === 1 ? 'y' : 'ies'} older than 48 hours. DCAA requires employees to acknowledge all proxy entries upon return from absence. Immediate review required.`,
      })
    }
  }
}

// Rule: Employee has not acknowledged current timekeeping policy within 7 days
async function checkPolicyAcknowledgments(orgId: string) {
  const { data: org } = await supabase
    .from('organizations')
    .select('policy_version')
    .eq('id', orgId)
    .maybeSingle()

  if (!org) return

  const now = new Date()
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
  const oneYearAgo = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000)

  // All users who joined more than 7 days ago
  const { data: users } = await supabase
    .from('users')
    .select('id')
    .eq('org_id', orgId)
    .lte('created_at', sevenDaysAgo.toISOString())

  for (const u of users ?? []) {
    // Check for a valid acknowledgment: current version, within the last year
    const { data: ack } = await supabase
      .from('policy_acknowledgments')
      .select('acknowledged_at')
      .eq('org_id', orgId)
      .eq('user_id', u.id)
      .eq('policy_version', org.policy_version)
      .gte('acknowledged_at', oneYearAgo.toISOString())
      .limit(1)
      .maybeSingle()

    if (!ack) {
      // Only create anomaly if one doesn't already exist (unresolved)
      const { data: existing } = await supabase
        .from('anomalies')
        .select('id')
        .eq('org_id', orgId)
        .eq('user_id', u.id)
        .eq('anomaly_type', 'policy_unacknowledged')
        .eq('resolved', false)
        .maybeSingle()

      if (!existing) {
        await insertAnomaly({
          org_id: orgId,
          user_id: u.id,
          anomaly_type: 'policy_unacknowledged',
          severity: 'high',
          description: `Employee has not acknowledged timekeeping policy v${org.policy_version}. Acknowledgment is overdue by more than 7 days. DCAA requires documented policy acknowledgment from all timekeeping personnel.`,
        })
      }
    }
  }
}

Deno.serve(async (req) => {
  const { org_id } = await req.json() as { org_id?: string }

  let orgIds: string[] = []
  if (org_id) {
    orgIds = [org_id]
  } else {
    const { data: orgs } = await supabase.from('organizations').select('id')
    orgIds = orgs?.map((o) => o.id) ?? []
  }

  for (const id of orgIds) {
    await checkInsufficientBalance(id)
    await checkMissingTimesheets(id)
    await checkMissingAccruals(id)
    await checkProxyEntryAcknowledgments(id)
    await checkPolicyAcknowledgments(id)
  }

  return new Response(JSON.stringify({ ok: true, orgs_checked: orgIds.length }), {
    headers: { 'Content-Type': 'application/json' },
  })
})
