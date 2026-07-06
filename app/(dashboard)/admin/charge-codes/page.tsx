import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { ChargeCodeManager } from '@/components/admin/charge-code-manager'

export default async function ChargeCodesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('users')
    .select('role, org_id')
    .eq('id', user.id)
    .single()

  if (!profile || profile.role !== 'admin') redirect('/dashboard')

  const { data: codes } = await supabase
    .from('charge_codes')
    .select('*')
    .eq('org_id', profile.org_id)
    .order('code')

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Charge Codes</h1>
      <ChargeCodeManager codes={codes ?? []} orgId={profile.org_id} />
    </div>
  )
}
