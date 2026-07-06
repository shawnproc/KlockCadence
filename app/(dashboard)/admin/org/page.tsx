import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { OrgSettingsForm } from '@/components/admin/org-settings-form'

export default async function OrgSettingsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('users')
    .select('role, org_id')
    .eq('id', user.id)
    .single()

  if (!profile || profile.role !== 'admin') redirect('/dashboard')

  const { data: org } = await supabase
    .from('organizations')
    .select('*')
    .eq('id', profile.org_id)
    .single()

  if (!org) redirect('/dashboard')

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Organization Settings</h1>
      <OrgSettingsForm org={org} />
    </div>
  )
}
