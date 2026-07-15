import { createServiceClient } from '@/lib/supabase/server'
import { writeAuditLog } from '@/lib/audit/logger'
import { Resend } from 'resend'
import type { AnomalyType, AnomalySeverity } from '@/types'

const resend = new Resend(process.env.RESEND_API_KEY)

interface AnomalyRecord {
  org_id: string
  user_id: string
  anomaly_type: AnomalyType
  severity: AnomalySeverity
  description: string
}

export async function recordAnomaly(anomaly: AnomalyRecord): Promise<void> {
  const supabase = createServiceClient()

  const { data, error } = await supabase
    .from('anomalies')
    .insert(anomaly)
    .select()
    .single()

  if (error) {
    console.error('[anomaly] Failed to record anomaly:', error.message)
    return
  }

  // Notify finance and admin via email for this org
  await notifyFinanceAndAdmin(anomaly)

  await writeAuditLog({
    org_id: anomaly.org_id,
    actor_id: anomaly.user_id,
    action: 'ANOMALY_RESOLVED',
    target_table: 'anomalies',
    target_id: data.id,
    new_value: { anomaly_type: anomaly.anomaly_type, severity: anomaly.severity },
  })
}

async function notifyFinanceAndAdmin(anomaly: AnomalyRecord): Promise<void> {
  const supabase = createServiceClient()

  const { data: recipients } = await supabase
    .from('users')
    .select('email, full_name')
    .eq('org_id', anomaly.org_id)
    .in('role', ['admin', 'finance'])

  if (!recipients || recipients.length === 0) return

  const severityLabel = anomaly.severity.toUpperCase()
  const subject = `[${severityLabel}] KlockCadence Compliance Alert`

  for (const recipient of recipients) {
    await resend.emails.send({
      from: 'KlockCadence <alerts@klockcadence.com>',
      to: recipient.email,
      subject,
      html: `
        <h2>Compliance Anomaly Detected</h2>
        <p><strong>Severity:</strong> ${severityLabel}</p>
        <p><strong>Type:</strong> ${anomaly.anomaly_type.replace(/_/g, ' ')}</p>
        <p><strong>Description:</strong> ${anomaly.description}</p>
        <p>Log in to KlockCadence to review and resolve this alert.</p>
      `,
    })
  }
}

export async function runNightlyChecks(orgId: string): Promise<void> {
  await checkMissingTimesheets(orgId)
  await checkMissingAccruals(orgId)
}

async function checkMissingTimesheets(orgId: string): Promise<void> {
  const supabase = createServiceClient()

  // Get all active employees (offboarded users no longer generate anomalies)
  const { data: employees } = await supabase
    .from('users')
    .select('id')
    .eq('org_id', orgId)
    .eq('role', 'employee')
    .eq('is_active', true)

  if (!employees) return

  // Determine last Friday's week
  const now = new Date()
  const dayOfWeek = now.getDay()
  const daysToLastFriday = dayOfWeek === 0 ? 2 : dayOfWeek === 6 ? 1 : dayOfWeek + 2
  const lastFriday = new Date(now)
  lastFriday.setDate(now.getDate() - daysToLastFriday)

  const weekStart = new Date(lastFriday)
  weekStart.setDate(lastFriday.getDate() - lastFriday.getDay() + 1)
  const weekStartStr = weekStart.toISOString().split('T')[0]!

  for (const employee of employees) {
    const { data: timesheet } = await supabase
      .from('timesheets')
      .select('id, status')
      .eq('org_id', orgId)
      .eq('user_id', employee.id)
      .eq('week_start_date', weekStartStr)
      .single()

    if (!timesheet || timesheet.status === 'draft') {
      await recordAnomaly({
        org_id: orgId,
        user_id: employee.id,
        anomaly_type: 'missing_timesheet',
        severity: 'high',
        description: `Timesheet not submitted for week of ${weekStartStr}`,
      })
    }
  }
}

async function checkMissingAccruals(orgId: string): Promise<void> {
  const supabase = createServiceClient()

  const { data: balances } = await supabase
    .from('leave_balances')
    .select('id, user_id, leave_type, last_accrual_date')
    .eq('org_id', orgId)
    .eq('leave_type', 'annual')

  if (!balances) return

  const now = new Date()
  for (const balance of balances) {
    if (!balance.last_accrual_date) continue
    const lastAccrual = new Date(balance.last_accrual_date)
    const daysSince = (now.getTime() - lastAccrual.getTime()) / (1000 * 60 * 60 * 24)

    if (daysSince > 16) {
      await recordAnomaly({
        org_id: orgId,
        user_id: balance.user_id,
        anomaly_type: 'missing_accrual',
        severity: 'medium',
        description: `Leave accrual not processed in ${Math.floor(daysSince)} days for ${balance.leave_type}`,
      })
    }
  }
}
