import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { writeAuditLog } from '@/lib/audit/logger'

interface AcknowledgeBody {
  entry_ids: string[]
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('users')
    .select('org_id, full_name')
    .eq('id', user.id)
    .single()

  if (!profile) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json() as AcknowledgeBody

  if (!body.entry_ids || body.entry_ids.length === 0) {
    return NextResponse.json({ error: 'No entry IDs provided.' }, { status: 422 })
  }

  const svc = createServiceClient()

  // Verify all entries belong to this user in this org and are proxy entries
  const { data: entries, error: fetchError } = await svc
    .from('timesheet_entries')
    .select('id, user_id, org_id, is_proxy_entry, employee_acknowledged')
    .in('id', body.entry_ids)

  if (fetchError) {
    return NextResponse.json({ error: 'Failed to fetch entries.' }, { status: 500 })
  }

  const fetchedIds = new Set((entries ?? []).map((e) => (e as { id: string }).id))
  for (const id of body.entry_ids) {
    if (!fetchedIds.has(id)) {
      return NextResponse.json({ error: `Entry ${id} not found.` }, { status: 404 })
    }
  }

  for (const entry of entries ?? []) {
    const e = entry as { id: string; user_id: string; org_id: string; is_proxy_entry: boolean; employee_acknowledged: boolean }
    if (e.user_id !== user.id) {
      return NextResponse.json({ error: 'You can only acknowledge your own proxy entries.' }, { status: 403 })
    }
    if (e.org_id !== profile.org_id) {
      return NextResponse.json({ error: 'Forbidden.' }, { status: 403 })
    }
    if (!e.is_proxy_entry) {
      return NextResponse.json({ error: `Entry ${e.id} is not a proxy entry.` }, { status: 422 })
    }
  }

  const acknowledgedAt = new Date().toISOString()

  const { error: updateError } = await svc
    .from('timesheet_entries')
    .update({
      employee_acknowledged: true,
      employee_acknowledged_at: acknowledgedAt,
    })
    .in('id', body.entry_ids)
    .eq('user_id', user.id)
    .eq('is_proxy_entry', true)

  if (updateError) {
    console.error('[proxy/acknowledge] update error:', updateError.message)
    return NextResponse.json({ error: 'Failed to record acknowledgment.' }, { status: 500 })
  }

  await writeAuditLog({
    org_id: profile.org_id,
    actor_id: user.id,
    action: 'PROXY_ENTRY_ACKNOWLEDGED',
    target_table: 'timesheet_entries',
    target_id: user.id,
    new_value: {
      employee_name: profile.full_name,
      entry_ids: body.entry_ids,
      acknowledged_at: acknowledgedAt,
      entry_count: body.entry_ids.length,
    },
  })

  return NextResponse.json({ success: true, acknowledged_at: acknowledgedAt })
}
