import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { writeAuditLog } from '@/lib/audit/logger'

/**
 * POST /api/anomalies/dedupe
 * Admin-only. Collapses exact-duplicate anomalies (same user + type +
 * description) down to the earliest one in each group and deletes the rest.
 * Cleans up detector-generated floods. The bulk deletion is recorded in the
 * immutable audit_log.
 */
export async function POST() {
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

  const { data: anomalies, error: fetchError } = await svc
    .from('anomalies')
    .select('id, user_id, anomaly_type, description, created_at')
    .eq('org_id', profile.org_id)
    .order('created_at', { ascending: true })

  if (fetchError) return NextResponse.json({ error: fetchError.message }, { status: 500 })

  // Group by identical (user, type, description); keep the first (earliest).
  const seen = new Set<string>()
  const toDelete: { id: string; anomaly_type: string; description: string }[] = []
  for (const a of anomalies ?? []) {
    const key = `${a.user_id}|${a.anomaly_type}|${a.description}`
    if (seen.has(key)) {
      toDelete.push({ id: a.id as string, anomaly_type: a.anomaly_type as string, description: a.description as string })
    } else {
      seen.add(key)
    }
  }

  if (toDelete.length === 0) {
    return NextResponse.json({ ok: true, removed: 0 })
  }

  // Record each deletion (with a valid uuid target_id) BEFORE deleting, so
  // nothing is removed without an audit trail. writeAuditLog throws on failure,
  // which aborts before any delete happens.
  for (const a of toDelete) {
    await writeAuditLog({
      org_id: profile.org_id,
      actor_id: user.id,
      action: 'ANOMALY_DELETED',
      target_table: 'anomalies',
      target_id: a.id,
      old_value: { anomaly_type: a.anomaly_type, description: a.description },
      new_value: { reason: 'dedupe' },
    })
  }

  const idsToDelete = toDelete.map((a) => a.id)
  const { error } = await svc
    .from('anomalies')
    .delete()
    .in('id', idsToDelete)
    .eq('org_id', profile.org_id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true, removed: idsToDelete.length })
}
