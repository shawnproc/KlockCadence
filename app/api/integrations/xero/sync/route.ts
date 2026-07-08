import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { syncTimesheetsToXero } from '@/lib/integrations/xero/sync'
import { writeSyncEvent } from '@/lib/integrations/sync-event'

interface SyncBody { start_date: string; end_date: string }

export async function POST(req: NextRequest): Promise<NextResponse> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('users').select('role, org_id').eq('id', user.id).single()
  if (!profile || profile.role !== 'admin') {
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
  }

  const body = (await req.json()) as SyncBody
  const orgId = profile.org_id as string

  try {
    const result = await syncTimesheetsToXero(orgId, body.start_date, body.end_date)
    const status = result.errors.length === 0 ? 'success' : result.recordsSynced > 0 ? 'partial' : 'error'

    await writeSyncEvent({
      orgId, integrationType: 'xero', triggeredBy: user.id, status,
      recordsSynced: result.recordsSynced, errorMessage: result.errors[0],
      details: { errors: result.errors }, auditAction: 'XERO_SYNC',
    })

    return NextResponse.json({ status, records_synced: result.recordsSynced, errors: result.errors })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Sync failed'
    await writeSyncEvent({
      orgId, integrationType: 'xero', triggeredBy: user.id,
      status: 'error', recordsSynced: 0, errorMessage: message, auditAction: 'XERO_SYNC',
    })
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
