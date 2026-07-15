import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { LeaveBalanceCards } from '@/components/leave/leave-balance-cards'
import { LeaveRequestForm } from '@/components/leave/leave-request-form'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { formatDate } from '@/lib/utils'
import { getLeaveTypeLabel } from '@/lib/leave/accrual'
import type { LeaveRequestStatus } from '@/types'

export default async function LeavePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('users')
    .select('org_id, full_name, role')
    .eq('id', user.id)
    .single()

  if (!profile) redirect('/login')

  const [{ data: balances }, { data: recentRequests }] = await Promise.all([
    supabase
      .from('leave_balances')
      .select('*')
      .eq('org_id', profile.org_id)
      .eq('user_id', user.id)
      .order('leave_type'),
    supabase
      .from('leave_requests')
      .select('id, leave_type, start_date, end_date, requested_hours, status, created_at')
      .eq('org_id', profile.org_id)
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(10),
  ])

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold">Leave</h1>

      <LeaveBalanceCards balances={balances ?? []} />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <LeaveRequestForm balances={balances ?? []} />

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Recent Requests</CardTitle>
          </CardHeader>
          <CardContent>
            {recentRequests && recentRequests.length > 0 ? (
              <div className="space-y-3">
                {recentRequests.map((req) => (
                  <div key={req.id} className="flex items-start justify-between py-2 border-b last:border-0">
                    <div>
                      <div className="text-sm font-medium">{getLeaveTypeLabel(req.leave_type)}</div>
                      <div className="text-xs text-muted-foreground">
                        {formatDate(req.start_date)} — {formatDate(req.end_date)}
                        {' · '}{req.requested_hours}h
                      </div>
                    </div>
                    <Badge variant={req.status as LeaveRequestStatus}>{req.status}</Badge>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No requests yet.</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
