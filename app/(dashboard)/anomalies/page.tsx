import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { AnomalyFeed } from '@/components/anomalies/anomaly-feed'

export default async function AnomaliesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('users')
    .select('role, org_id')
    .eq('id', user.id)
    .single()

  if (!profile || !['admin', 'finance', 'manager'].includes(profile.role)) {
    redirect('/dashboard')
  }

  const { data: anomalies } = await supabase
    .from('anomalies')
    .select('*, users(full_name, email)')
    .eq('org_id', profile.org_id)
    .order('created_at', { ascending: false })
    .limit(200)

  const openCount = anomalies?.filter((a) => !a.resolved).length ?? 0
  const criticalCount = anomalies?.filter((a) => !a.resolved && a.severity === 'critical').length ?? 0

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Compliance Anomalies</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {openCount} open{criticalCount > 0 ? ` · ${criticalCount} critical` : ''}
          </p>
        </div>
      </div>
      <AnomalyFeed
        anomalies={anomalies ?? []}
        resolverId={user.id}
        orgId={profile.org_id}
      />
    </div>
  )
}
