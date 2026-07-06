import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Badge } from '@/components/ui/badge'
import { formatDate } from '@/lib/utils'
import { getLeaveTypeLabel } from '@/lib/leave/accrual'
import type { LeaveRequestStatus } from '@/types'

export default async function LeaveHistoryPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('users')
    .select('role, org_id')
    .eq('id', user.id)
    .single()

  if (!profile) redirect('/login')

  const query = supabase
    .from('leave_requests')
    .select('id, leave_type, requested_hours, start_date, end_date, status, reviewer_notes, created_at, users(full_name)')
    .eq('org_id', profile.org_id)
    .order('created_at', { ascending: false })
    .limit(100)

  if (profile.role === 'employee') {
    query.eq('user_id', user.id)
  }

  const { data: requests } = await query

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Leave History</h1>

      <div className="rounded-lg border overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-muted/50">
              <th className="text-left px-4 py-3 font-medium">Type</th>
              {profile.role !== 'employee' && (
                <th className="text-left px-4 py-3 font-medium">Employee</th>
              )}
              <th className="text-left px-4 py-3 font-medium">Dates</th>
              <th className="text-left px-4 py-3 font-medium">Hours</th>
              <th className="text-left px-4 py-3 font-medium">Status</th>
              <th className="text-left px-4 py-3 font-medium">Notes</th>
            </tr>
          </thead>
          <tbody>
            {requests?.map((req) => {
              const u = req.users as unknown as { full_name: string } | null
              return (
                <tr key={req.id} className="border-t">
                  <td className="px-4 py-3">
                    {getLeaveTypeLabel(req.leave_type as never)}
                  </td>
                  {profile.role !== 'employee' && (
                    <td className="px-4 py-3 text-muted-foreground">{u?.full_name}</td>
                  )}
                  <td className="px-4 py-3 text-muted-foreground">
                    {formatDate(req.start_date)} – {formatDate(req.end_date)}
                  </td>
                  <td className="px-4 py-3 tabular-nums">{req.requested_hours}h</td>
                  <td className="px-4 py-3">
                    <Badge variant={req.status as LeaveRequestStatus}>{req.status}</Badge>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground text-xs max-w-xs truncate">
                    {req.reviewer_notes ?? '—'}
                  </td>
                </tr>
              )
            })}
            {(!requests || requests.length === 0) && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                  No leave history found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
