import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Badge } from '@/components/ui/badge'
import { formatWeekRange, formatDateTime } from '@/lib/utils'
import Link from 'next/link'
import type { TimesheetStatus } from '@/types'

export default async function TimesheetHistoryPage() {
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
    .from('timesheets')
    .select('id, week_start_date, status, certified_at, approved_at, rejection_reason, users(full_name)')
    .eq('org_id', profile.org_id)
    .order('week_start_date', { ascending: false })
    .limit(52)

  if (profile.role === 'employee') {
    query.eq('user_id', user.id)
  }

  const { data: timesheets } = await query

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Timesheet History</h1>

      <div className="rounded-lg border overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-muted/50">
              <th className="text-left px-4 py-3 font-medium">Week</th>
              {profile.role !== 'employee' && (
                <th className="text-left px-4 py-3 font-medium">Employee</th>
              )}
              <th className="text-left px-4 py-3 font-medium">Status</th>
              <th className="text-left px-4 py-3 font-medium">Certified</th>
              <th className="text-left px-4 py-3 font-medium">Approved</th>
              <th className="text-left px-4 py-3 font-medium">Notes</th>
              <th className="text-right px-4 py-3 font-medium">Action</th>
            </tr>
          </thead>
          <tbody>
            {timesheets?.map((ts) => {
              const u = ts.users as { full_name: string } | null
              return (
                <tr key={ts.id} className="border-t hover:bg-muted/20 transition-colors">
                  <td className="px-4 py-3 font-medium">
                    {formatWeekRange(ts.week_start_date)}
                  </td>
                  {profile.role !== 'employee' && (
                    <td className="px-4 py-3 text-muted-foreground">{u?.full_name}</td>
                  )}
                  <td className="px-4 py-3">
                    <Badge variant={ts.status as TimesheetStatus}>
                      {ts.status}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground text-xs">
                    {ts.certified_at ? formatDateTime(ts.certified_at) : '—'}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground text-xs">
                    {ts.approved_at ? formatDateTime(ts.approved_at) : '—'}
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground max-w-xs truncate">
                    {ts.rejection_reason ?? '—'}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      href={`/timesheets?week=${ts.week_start_date}`}
                      className="text-xs text-primary hover:underline"
                    >
                      {ts.status === 'rejected' ? 'Edit →' : 'View →'}
                    </Link>
                  </td>
                </tr>
              )
            })}
            {(!timesheets || timesheets.length === 0) && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">
                  No timesheets found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
