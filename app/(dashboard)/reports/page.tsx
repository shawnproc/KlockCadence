import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { DCAAExportForm } from '@/components/reports/dcaa-export-form'

export default async function ReportsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('users')
    .select('role, org_id')
    .eq('id', user.id)
    .single()

  if (!profile || !['admin', 'finance'].includes(profile.role)) redirect('/dashboard')

  const { data: org } = await supabase
    .from('organizations')
    .select('name, slug')
    .eq('id', profile.org_id)
    .single()

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">DCAA Audit Package</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Generate a complete audit-ready package for any date range.
        </p>
      </div>
      <DCAAExportForm
        orgId={profile.org_id}
        orgName={org?.name ?? 'Unknown Org'}
      />
    </div>
  )
}
