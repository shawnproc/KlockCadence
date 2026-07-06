import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { LeavePolicyManager } from '@/components/admin/leave-policy-manager'

export default async function LeavePoliciesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('users')
    .select('role, org_id')
    .eq('id', user.id)
    .single()

  if (!profile || profile.role !== 'admin') redirect('/dashboard')

  const { data: policies } = await supabase
    .from('leave_policies')
    .select('*')
    .eq('org_id', profile.org_id)
    .order('leave_type')
    .order('tenure_tier')

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Leave Policies</h1>
      <p className="text-sm text-muted-foreground">Accrual rates by leave type and tenure tier.</p>
      <LeavePolicyManager policies={policies ?? []} orgId={profile.org_id} />
    </div>
  )
}
