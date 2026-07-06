import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { DashboardShell } from '@/components/layout/dashboard-shell'
import { type UserRole } from '@/types'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('users')
    .select('full_name, role, org_id, organizations(name)')
    .eq('id', user.id)
    .single()

  if (!profile) redirect('/login')

  const orgData = profile.organizations as unknown as { name: string } | null
  const orgName = orgData?.name ?? 'Unknown Org'

  return (
    <DashboardShell
      role={profile.role as UserRole}
      userName={profile.full_name}
      orgName={orgName}
    >
      {children}
    </DashboardShell>
  )
}
