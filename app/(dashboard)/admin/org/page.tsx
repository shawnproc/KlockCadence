import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { OrgSettingsForm } from '@/components/admin/org-settings-form'
import type { Organization } from '@/types'

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

  // Select explicit columns — never send admin_password_hash to the client.
  const { data: org } = await supabase
    .from('organizations')
    .select('id, name, slug, fiscal_year_start, holiday_schedule, policy_version, policy_version_updated_at, policy_text, company_code, created_at')
    .eq('id', profile.org_id)
    .single()

  if (!org) redirect('/dashboard')

  const { data: sec } = await supabase
    .from('organizations')
    .select('admin_password_hash')
    .eq('id', profile.org_id)
    .single()
  const hasAdminPassword = !!sec?.admin_password_hash

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Organization Settings</h1>
      <OrgSettingsForm org={org as Organization} hasAdminPassword={hasAdminPassword} />
    </div>
  )
}
