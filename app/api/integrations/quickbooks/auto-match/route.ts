import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { autoMatchQBOEmployees } from '@/lib/integrations/quickbooks/auto-match'
import { writeAuditLog } from '@/lib/audit/logger'

export async function POST(): Promise<NextResponse> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('users')
    .select('role, org_id')
    .eq('id', user.id)
    .single()

  if (!profile || profile.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  try {
    const result = await autoMatchQBOEmployees(profile.org_id as string)

    await writeAuditLog({
      org_id: profile.org_id as string,
      actor_id: user.id,
      action: 'INTEGRATION_CONNECTED',
      target_table: 'integration_mappings',
      target_id: profile.org_id as string,
      new_value: { auto_matched: result.matched, unmatched: result.unmatched },
    })

    return NextResponse.json(result)
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Auto-match failed' },
      { status: 500 }
    )
  }
}
