import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { LeaveApprovalQueue } from '@/components/leave/leave-approval-queue'

export default async function LeaveRequestsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('users')
    .select('role, org_id')
    .eq('id', user.id)
    .single()

  if (!profile || !['manager', 'admin'].includes(profile.role)) redirect('/dashboard')

  const { data: requests } = await supabase
    .from('leave_requests')
    .select(`
      id, leave_type, requested_hours, start_date, end_date,
      status, employee_notes, reviewer_notes, created_at,
      users(full_name, email, department)
    `)
    .eq('org_id', profile.org_id)
    .eq('status', 'pending')
    .order('created_at', { ascending: true })

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Leave Requests</h1>
      <LeaveApprovalQueue
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        requests={(requests ?? []) as any}
        reviewerId={user.id}
        orgId={profile.org_id}
      />
    </div>
  )
}
