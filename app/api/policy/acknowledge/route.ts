import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { writeAuditLog } from '@/lib/audit/logger'
import { headers } from 'next/headers'

export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('users')
    .select('org_id, full_name, organizations(policy_version)')
    .eq('id', user.id)
    .single()

  if (!profile) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const orgData = profile.organizations as unknown as { policy_version: string } | null
  const policyVersion = orgData?.policy_version ?? '1.0'

  const headersList = await headers()
  const ip = headersList.get('x-forwarded-for') ?? headersList.get('x-real-ip') ?? 'unknown'

  // Insert acknowledgment record (insert-only table)
  const svc = createServiceClient()
  const { error: ackError } = await svc.from('policy_acknowledgments').insert({
    org_id: profile.org_id,
    user_id: user.id,
    policy_version: policyVersion,
    ip_address: ip,
  })

  if (ackError) {
    console.error('[policy_acknowledge] insert error:', ackError.message)
    return NextResponse.json({ error: 'Failed to record acknowledgment.' }, { status: 500 })
  }

  // Immutable audit log entry
  await writeAuditLog({
    org_id: profile.org_id,
    actor_id: user.id,
    action: 'POLICY_ACKNOWLEDGED',
    target_table: 'policy_acknowledgments',
    target_id: user.id,
    new_value: {
      policy_version: policyVersion,
      acknowledged_at: new Date().toISOString(),
      ip_address: ip,
      employee_name: profile.full_name,
    },
  })

  return NextResponse.json({ success: true, policy_version: policyVersion })
}
