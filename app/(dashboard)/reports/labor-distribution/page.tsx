import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { LaborDistributionReport } from '@/components/reports/labor-distribution-report'
import { FileSpreadsheet } from 'lucide-react'

export default async function LaborDistributionPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('users')
    .select('role, org_id')
    .eq('id', user.id)
    .single()

  if (!profile || !['admin', 'finance'].includes(profile.role)) {
    redirect('/dashboard')
  }

  const { data: org } = await supabase
    .from('organizations')
    .select('name')
    .eq('id', profile.org_id)
    .single()

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div
          className="h-10 w-10 rounded-lg flex items-center justify-center shrink-0"
          style={{ backgroundColor: '#1B2A4A' }}
        >
          <FileSpreadsheet className="h-5 w-5 text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">Monthly Labor Distribution</h1>
          <p className="text-sm text-muted-foreground">
            Aggregate approved hours by employee and charge code — export to QuickBooks GL
          </p>
        </div>
      </div>

      <LaborDistributionReport
        orgId={profile.org_id}
        orgName={org?.name ?? 'Unknown'}
      />
    </div>
  )
}
