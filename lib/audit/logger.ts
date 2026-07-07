import { createServiceClient } from '@/lib/supabase/server'
import { headers } from 'next/headers'

export type AuditAction =
  | 'TIMESHEET_CREATED'
  | 'TIMESHEET_SUBMITTED'
  | 'TIMESHEET_APPROVED'
  | 'TIMESHEET_REJECTED'
  | 'TIMESHEET_CERTIFIED'
  | 'LEAVE_REQUEST_SUBMITTED'
  | 'LEAVE_REQUEST_APPROVED'
  | 'LEAVE_REQUEST_DENIED'
  | 'LEAVE_REQUEST_CANCELLED'
  | 'BALANCE_MODIFIED'
  | 'BALANCE_ACCRUED'
  | 'CERTIFICATION_SIGNED'
  | 'USER_CREATED'
  | 'USER_ROLE_CHANGED'
  | 'USER_DEACTIVATED'
  | 'CHARGE_CODE_CREATED'
  | 'CHARGE_CODE_UPDATED'
  | 'ANOMALY_RESOLVED'
  | 'LEAVE_POLICY_UPDATED'
  | 'ORG_SETTINGS_UPDATED'
  | 'POLICY_ACKNOWLEDGED'
  | 'PROXY_ENTRY_CREATED'
  | 'PROXY_ENTRY_ACKNOWLEDGED'

interface AuditLogEntry {
  org_id: string
  actor_id: string
  action: AuditAction
  target_table: string
  target_id: string
  old_value?: Record<string, unknown> | null
  new_value?: Record<string, unknown> | null
}

export async function writeAuditLog(entry: AuditLogEntry): Promise<void> {
  const supabase = await createServiceClient()
  const headersList = await headers()
  const ip = headersList.get('x-forwarded-for') ?? headersList.get('x-real-ip') ?? 'unknown'

  const { error } = await supabase.from('audit_log').insert({
    ...entry,
    ip_address: ip,
  })

  if (error) {
    console.error('[audit_log] Failed to write audit entry:', error.message)
  }
}
