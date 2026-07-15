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
  const idsToDelete: string[] = []
  for (const a of anomalies ?? []) {
    const key = `${a.user_id}|${a.anomaly_type}|${a.description}`
    if (seen.has(key)) {
      idsToDelete.push(a.id as string)
    } else {
      seen.add(key)
    }
  }

  if (idsToDelete.length === 0) {
    return NextResponse.json({ ok: true, removed: 0 })
  }

  await writeAuditLog({
    org_id: profile.org_id,
    actor_id: user.id,
    action: 'ANOMALY_DELETED',
    target_table: 'anomalies',
    target_id: 'bulk-dedupe',
    new_value: { reason: 'dedupe', removed_count: idsToDelete.length, removed_ids: idsToDelete },
  })

  const { error } = await svc
    .from('anomalies')
    .delete()
    .in('id', idsToDelete)
    .eq('org_id', profile.org_id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true, removed: idsToDelete.length })
}
