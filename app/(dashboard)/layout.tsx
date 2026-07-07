import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { DashboardShell } from '@/components/layout/dashboard-shell'
import { type UserRole } from '@/types'

const MS_PER_YEAR = 365 * 24 * 60 * 60 * 1000

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('users')
    .select('full_name, role, org_id, organizations(name, policy_version, policy_text)')
    .eq('id', user.id)
    .single()

  if (!profile) redirect('/login')

  const orgData = profile.organizations as unknown as {
    name: string
    policy_version: string
    policy_text: string
  } | null

  const orgName = orgData?.name ?? 'Unknown Org'
  const policyVersion = orgData?.policy_version ?? '1.0'
  const policyText = orgData?.policy_text ?? ''

  // Check whether this user has a valid (current version, <365 days old) acknowledgment
  const { data: latestAck } = await supabase
    .from('policy_acknowledgments')
    .select('acknowledged_at')
    .eq('user_id', user.id)
    .eq('policy_version', policyVersion)
    .order('acknowledged_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  const requiresAck =
    !latestAck ||
    Date.now() - new Date(latestAck.acknowledged_at).getTime() > MS_PER_YEAR

  const isRenewal = !!(latestAck && requiresAck)

  return (
    <DashboardShell
      role={profile.role as UserRole}
      userName={profile.full_name}
      orgName={orgName}
      requiresAck={requiresAck}
      policyText={policyText}
      policyVersion={policyVersion}
      isRenewal={isRenewal}
    >
      {children}
    </DashboardShell>
  )
}
