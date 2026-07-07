import { redirect } from 'next/navigation'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { PolicyGenerator } from '@/components/admin/policy-generator'
import { Shield } from 'lucide-react'

export default async function PolicyManagerPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('users')
    .select('role, org_id')
    .eq('id', user.id)
    .single()

  if (!profile || profile.role !== 'admin') redirect('/dashboard')

  const svc = await createServiceClient()

  const [{ data: org }, { data: rawVersions }] = await Promise.all([
    supabase
      .from('organizations')
      .select('name, policy_version, policy_version_updated_at, policy_text')
      .eq('id', profile.org_id)
      .single(),
    svc
      .from('policy_versions')
      .select('id, version, effective_date, storage_path, created_at, users!created_by(full_name)')
      .eq('org_id', profile.org_id)
      .order('created_at', { ascending: false }),
  ])

  if (!org) redirect('/dashboard')

  interface RawVersion {
    id: string
    version: string
    effective_date: string
    storage_path: string
    created_at: string
    users: { full_name: string } | null
  }

  const versions = ((rawVersions ?? []) as unknown as RawVersion[]).map((v) => ({
    id: v.id,
    version: v.version,
    effective_date: v.effective_date,
    storage_path: v.storage_path,
    created_at: v.created_at,
    created_by_name: v.users?.full_name ?? 'Unknown',
  }))

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div
          className="h-10 w-10 rounded-lg flex items-center justify-center shrink-0"
          style={{ backgroundColor: '#1B2A4A' }}
        >
          <Shield className="h-5 w-5 text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">Policy Manager</h1>
          <p className="text-sm text-muted-foreground">
            Edit, generate, and publish versioned timekeeping policy documents
          </p>
        </div>
      </div>

      <PolicyGenerator
        orgName={(org as unknown as { name: string }).name}
        currentVersion={(org as unknown as { policy_version: string }).policy_version}
        currentVersionUpdatedAt={(org as unknown as { policy_version_updated_at: string }).policy_version_updated_at}
        currentPolicyText={(org as unknown as { policy_text: string }).policy_text}
        versions={versions}
      />
    </div>
  )
}
