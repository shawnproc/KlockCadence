import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { writeAuditLog } from '@/lib/audit/logger'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('users')
    .select('org_id')
    .eq('id', user.id)
    .single()

  if (!profile) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json() as { timesheet_id: string; typed_name: string }

  await writeAuditLog({
    org_id: profile.org_id,
    actor_id: user.id,
    action: 'CERTIFICATION_SIGNED',
    target_table: 'timesheets',
    target_id: body.timesheet_id,
    new_value: {
      typed_name: body.typed_name,
      certified_at: new Date().toISOString(),
      action: 'TIMESHEET_CERTIFIED',
    },
  })

  return NextResponse.json({ success: true })
}
