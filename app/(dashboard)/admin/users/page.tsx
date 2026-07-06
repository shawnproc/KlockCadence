import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { UserManagement } from '@/components/admin/user-management'

export default async function AdminUsersPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('users')
    .select('role, org_id')
    .eq('id', user.id)
    .single()

  if (!profile || profile.role !== 'admin') redirect('/dashboard')

  const { data: users } = await supabase
    .from('users')
    .select('id, full_name, email, role, department, hire_date, created_at')
    .eq('org_id', profile.org_id)
    .order('full_name')

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">User Management</h1>
      <UserManagement users={users ?? []} orgId={profile.org_id} />
    </div>
  )
}
