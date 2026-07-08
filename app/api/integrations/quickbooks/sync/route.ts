import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { syncTimesheetsToQBO, syncLeaveToQBO } from '@/lib/integrations/quickbooks/sync'
import { writeSyncEvent } from '@/lib/integrations/sync-event'

interface SyncBody {
  start_date: string  // YYYY-MM-DD
  end_date: string    // YYYY-MM-DD
  include_leave?: boolean
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('users')
    .select('role, org_id')
    .eq('id', user.id)
    .single()

  if (!profile || profile.role !== 'admin') {
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
  }

  const body = (await req.json()) as SyncBody
  if (!body.start_date || !body.end_date) {
    return NextResponse.json({ error: 'start_date and end_date required' }, { status: 400 })
  }

  const orgId = profile.org_id as string

  try {
    const tsResult = await syncTimesheetsToQBO(orgId, body.start_date, body.end_date)
    let totalSynced = tsResult.recordsSynced
    let allErrors = [...tsResult.errors]

    if (body.include_leave) {
      const leaveResult = await syncLeaveToQBO(orgId, body.start_date, body.end_date)
      totalSynced += leaveResult.recordsSynced
      allErrors = [...allErrors, ...leaveResult.errors]
    }

    const status = allErrors.length === 0 ? 'success' : tsResult.recordsSynced > 0 ? 'partial' : 'error'

    await writeSyncEvent({
      orgId,
      integrationType: 'quickbooks',
      triggeredBy: user.id,
      status,
      recordsSynced: totalSynced,
      errorMessage: allErrors.length > 0 ? allErrors.slice(0, 3).join('; ') : undefined,
      details: { start_date: body.start_date, end_date: body.end_date, qbo_ids: tsResult.qboIds, errors: allErrors },
      auditAction: 'QUICKBOOKS_SYNC',
    })

    return NextResponse.json({
      status,
      records_synced: totalSynced,
      errors: allErrors,
    })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Sync failed'
    await writeSyncEvent({
      orgId,
      integrationType: 'quickbooks',
      triggeredBy: user.id,
      status: 'error',
      recordsSynced: 0,
      errorMessage: message,
      auditAction: 'QUICKBOOKS_SYNC',
    })
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
