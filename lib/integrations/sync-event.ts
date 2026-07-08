import { createServiceClient } from '@/lib/supabase/server'
import { writeAuditLog, type AuditAction } from '@/lib/audit/logger'
import type { IntegrationType, SyncEventStatus } from '@/types'

interface SyncEventParams {
  orgId: string
  integrationType: IntegrationType
  triggeredBy: string
  status: SyncEventStatus
  recordsSynced: number
  errorMessage?: string
  details?: Record<string, unknown>
  auditAction: AuditAction
}

export async function writeSyncEvent(params: SyncEventParams): Promise<void> {
  const svc = await createServiceClient()

  // Write sync event (insert-only table)
  await svc.from('integration_sync_events').insert({
    org_id: params.orgId,
    integration_type: params.integrationType,
    triggered_by: params.triggeredBy,
    status: params.status,
    records_synced: params.recordsSynced,
    error_message: params.errorMessage ?? null,
    details: params.details ?? null,
  })

  // Update integration last_sync fields
  await svc
    .from('integrations')
    .update({
      last_sync_at: new Date().toISOString(),
      last_sync_status: params.status,
      last_error_message: params.errorMessage ?? null,
      status: params.status === 'error' ? 'error' : 'connected',
    })
    .eq('org_id', params.orgId)
    .eq('integration_type', params.integrationType)

  // Write to immutable audit_log
  await writeAuditLog({
    org_id: params.orgId,
    actor_id: params.triggeredBy,
    action: params.auditAction,
    target_table: 'integration_sync_events',
    target_id: params.integrationType,
    new_value: {
      status: params.status,
      records_synced: params.recordsSynced,
      error_message: params.errorMessage ?? null,
      details: params.details ?? null,
    },
  })
}
