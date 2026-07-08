import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { DCAAExportForm } from '@/components/reports/dcaa-export-form'
import { LaborDistributionExport } from '@/components/reports/labor-distribution-export'

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
    <div className="space-y-10">
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

      <div className="border-t pt-8 space-y-6">
        <div>
          <h2 className="text-xl font-bold">Labor Distribution Export</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Export approved timesheet hours by employee, charge code, and week for GL import.
          </p>
        </div>
        <LaborDistributionExport />
      </div>
    </div>
  )
}
