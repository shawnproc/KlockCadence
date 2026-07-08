import { redirect } from 'next/navigation'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { UserManagement } from '@/components/admin/user-management'

export default async function AdminUsersPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('users')
    .select('role, org_id, organizations(policy_version)')
    .eq('id', user.id)
    .single()

  if (!profile || profile.role !== 'admin') redirect('/dashboard')

  const orgData = profile.organizations as unknown as { policy_version: string } | null
  const currentPolicyVersion = orgData?.policy_version ?? '1.0'

  const svc = createServiceClient()

  const [{ data: users }, { data: allAcks }] = await Promise.all([
    supabase
      .from('users')
      .select('id, full_name, email, role, department, hire_date, created_at')
      .eq('org_id', profile.org_id)
      .order('full_name'),
    svc
      .from('policy_acknowledgments')
      .select('user_id, policy_version, acknowledged_at')
      .eq('org_id', profile.org_id)
      .order('acknowledged_at', { ascending: false }),
  ])

  // Build map: user_id → latest acknowledgment
  const ackMap: Record<string, { policy_version: string; acknowledged_at: string }> = {}
  for (const ack of allAcks ?? []) {
    const uid = ack.user_id as string
    if (!ackMap[uid]) {
      ackMap[uid] = {
        policy_version: ack.policy_version as string,
        acknowledged_at: ack.acknowledged_at as string,
      }
    }
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">User Management</h1>
      <UserManagement
        users={users ?? []}
        orgId={profile.org_id}
        currentPolicyVersion={currentPolicyVersion}
        ackMap={ackMap}
      />
    </div>
  )
}
