import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { generateDeltekExport } from '@/lib/integrations/deltek/export'
import { writeSyncEvent } from '@/lib/integrations/sync-event'

export async function GET(req: NextRequest): Promise<NextResponse> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('users').select('role, org_id').eq('id', user.id).single()
  if (!profile || !['admin', 'finance'].includes(profile.role as string)) {
    return NextResponse.json({ error: 'Admin or Finance access required' }, { status: 403 })
  }

  const { searchParams } = req.nextUrl
  const startDate = searchParams.get('start_date')
  const endDate = searchParams.get('end_date')
  if (!startDate || !endDate) {
    return NextResponse.json({ error: 'start_date and end_date required' }, { status: 400 })
  }

  const orgId = profile.org_id as string

  try {
    const tsv = await generateDeltekExport(orgId, startDate, endDate)
    const filename = `deltek_timesheet_${startDate}_${endDate}.txt`

    await writeSyncEvent({
      orgId, integrationType: 'deltek', triggeredBy: user.id,
      status: 'success', recordsSynced: tsv.split('\n').length - 1,
      details: { start_date: startDate, end_date: endDate },
      auditAction: 'DELTEK_EXPORT',
    })

    return new NextResponse(tsv, {
      headers: {
        'Content-Type': 'text/tab-separated-values',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Export failed' }, { status: 500 })
  }
}
