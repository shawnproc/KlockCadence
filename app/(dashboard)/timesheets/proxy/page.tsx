import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getWeekStart } from '@/lib/leave/accrual'
import { ProxyEntryForm } from '@/components/timesheets/proxy-entry-form'
import { UserCheck } from 'lucide-react'

export default async function ProxyEntryPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('users')
    .select('role, org_id')
    .eq('id', user.id)
    .single()

  if (!profile || !['manager', 'admin'].includes(profile.role)) {
    redirect('/dashboard')
  }

  const [{ data: employees }, { data: chargeCodes }] = await Promise.all([
    supabase
      .from('users')
      .select('id, full_name, email, department')
      .eq('org_id', profile.org_id)
      .eq('role', 'employee')
      .order('full_name'),
    supabase
      .from('charge_codes')
      .select('*')
      .eq('org_id', profile.org_id)
      .eq('is_active', true)
      .order('code'),
  ])

  const defaultWeekStart = getWeekStart(new Date()).toISOString().split('T')[0]!

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center gap-3">
        <div
          className="h-10 w-10 rounded-lg flex items-center justify-center shrink-0"
          style={{ backgroundColor: '#1B2A4A' }}
        >
          <UserCheck className="h-5 w-5 text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">Proxy Time Entry</h1>
          <p className="text-sm text-muted-foreground">
            Enter time on behalf of an employee — for documented absence or travel only
          </p>
        </div>
      </div>

      <ProxyEntryForm
        employees={employees ?? []}
        chargeCodes={chargeCodes ?? []}
        defaultWeekStart={defaultWeekStart}
      />
    </div>
  )
}
