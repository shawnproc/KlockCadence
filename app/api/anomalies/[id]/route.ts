import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { writeAuditLog } from '@/lib/audit/logger'

/**
 * DELETE /api/anomalies/[id]
 * Admin-only. Deletes a single anomaly. The deletion is recorded in the
 * immutable audit_log (ANOMALY_DELETED) with the full removed row, so nothing
 * disappears without a trace.
 */
export async function DELETE(
  _request: Request,
  { params }: { params: { id: string } }
) {
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

  const svc = createServiceClient()

  const { data: anomaly } = await svc
    .from('anomalies')
    .select('*')
    .eq('id', params.id)
    .eq('org_id', profile.org_id)
    .single()

  if (!anomaly) {
    return NextResponse.json({ error: 'Anomaly not found.' }, { status: 404 })
  }

  // Record the deletion BEFORE removing it, so the audit trail keeps the row.
  await writeAuditLog({
    org_id: profile.org_id,
    actor_id: user.id,
    action: 'ANOMALY_DELETED',
    target_table: 'anomalies',
    target_id: params.id,
    old_value: anomaly as Record<string, unknown>,
  })

  const { error } = await svc
    .from('anomalies')
    .delete()
    .eq('id', params.id)
    .eq('org_id', profile.org_id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true, id: params.id })
}
