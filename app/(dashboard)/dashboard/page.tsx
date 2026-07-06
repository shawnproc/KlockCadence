import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getWeekStart } from '@/lib/leave/accrual'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Clock, Calendar, AlertTriangle, CheckCircle2, FileText } from 'lucide-react'
import Link from 'next/link'
import { formatWeekRange } from '@/lib/utils'

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('users')
    .select('full_name, role, org_id, hire_date')
    .eq('id', user.id)
    .single()

  if (!profile) redirect('/login')

  const weekStart = getWeekStart(new Date()).toISOString().split('T')[0]!

  // Current week timesheet
  const { data: currentTimesheet } = await supabase
    .from('timesheets')
    .select('id, status, week_start_date')
    .eq('org_id', profile.org_id)
    .eq('user_id', user.id)
    .eq('week_start_date', weekStart)
    .maybeSingle()

  // Leave balances
  const { data: leaveBalances } = await supabase
    .from('leave_balances')
    .select('leave_type, available_hours, accrued_hours, used_hours')
    .eq('org_id', profile.org_id)
    .eq('user_id', user.id)
    .in('leave_type', ['annual', 'sick'])

  // Manager/admin: pending timesheets
  let pendingTimesheets = 0
  if (profile.role === 'manager' || profile.role === 'admin') {
    const { count } = await supabase
      .from('timesheets')
      .select('id', { count: 'exact', head: true })
      .eq('org_id', profile.org_id)
      .eq('status', 'submitted')
    pendingTimesheets = count ?? 0
  }

  // Finance/admin: open anomalies
  let openAnomalies = 0
  if (profile.role === 'admin' || profile.role === 'finance') {
    const { count } = await supabase
      .from('anomalies')
      .select('id', { count: 'exact', head: true })
      .eq('org_id', profile.org_id)
      .eq('resolved', false)
    openAnomalies = count ?? 0
  }

  // Pending leave requests (manager/admin)
  let pendingLeave = 0
  if (profile.role === 'manager' || profile.role === 'admin') {
    const { count } = await supabase
      .from('leave_requests')
      .select('id', { count: 'exact', head: true })
      .eq('org_id', profile.org_id)
      .eq('status', 'pending')
    pendingLeave = count ?? 0
  }

  const weekRangeLabel = formatWeekRange(weekStart)
  const annualBalance = leaveBalances?.find((b) => b.leave_type === 'annual')
  const sickBalance = leaveBalances?.find((b) => b.leave_type === 'sick')

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">
          Welcome back, {profile.full_name.split(' ')[0]}
        </h1>
        <p className="text-muted-foreground text-sm mt-1">Week of {weekRangeLabel}</p>
      </div>

      {/* Primary action card — timesheet status */}
      <Card className="border-2">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-base">
              <Clock className="h-4 w-4" />
              Current Timesheet
            </CardTitle>
            {currentTimesheet && (
              <Badge variant={currentTimesheet.status as 'draft' | 'submitted' | 'approved' | 'rejected'}>
                {currentTimesheet.status}
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {currentTimesheet ? (
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                {currentTimesheet.status === 'approved' && 'Approved — no action needed.'}
                {currentTimesheet.status === 'submitted' && 'Submitted and awaiting manager approval.'}
                {currentTimesheet.status === 'draft' && 'In progress — complete and submit by Friday.'}
                {currentTimesheet.status === 'rejected' && 'Rejected — review feedback and resubmit.'}
              </p>
              <Link
                href="/timesheets"
                className="text-sm text-primary hover:underline font-medium"
              >
                {currentTimesheet.status === 'draft' || currentTimesheet.status === 'rejected'
                  ? 'Continue →'
                  : 'View →'}
              </Link>
            </div>
          ) : (
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">No timesheet started for this week.</p>
              <Link href="/timesheets" className="text-sm text-primary hover:underline font-medium">
                Start timesheet →
              </Link>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Stats row */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {annualBalance && (
          <Card>
            <CardContent className="pt-5">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wide">Annual Leave</p>
                  <p className="text-2xl font-bold mt-1">{annualBalance.available_hours}h</p>
                  <p className="text-xs text-muted-foreground mt-0.5">available</p>
                </div>
                <Calendar className="h-5 w-5 text-muted-foreground/50 mt-0.5" />
              </div>
            </CardContent>
          </Card>
        )}

        {sickBalance && (
          <Card>
            <CardContent className="pt-5">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wide">Sick Leave</p>
                  <p className="text-2xl font-bold mt-1">{sickBalance.available_hours}h</p>
                  <p className="text-xs text-muted-foreground mt-0.5">available</p>
                </div>
                <CheckCircle2 className="h-5 w-5 text-muted-foreground/50 mt-0.5" />
              </div>
            </CardContent>
          </Card>
        )}

        {(profile.role === 'manager' || profile.role === 'admin') && (
          <Card>
            <CardContent className="pt-5">
              <Link href="/timesheets" className="block">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wide">Pending Approval</p>
                    <p className="text-2xl font-bold mt-1">{pendingTimesheets}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">timesheets</p>
                  </div>
                  <FileText className="h-5 w-5 text-muted-foreground/50 mt-0.5" />
                </div>
              </Link>
            </CardContent>
          </Card>
        )}

        {(profile.role === 'admin' || profile.role === 'finance') && (
          <Card>
            <CardContent className="pt-5">
              <Link href="/anomalies" className="block">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wide">Open Anomalies</p>
                    <p className={`text-2xl font-bold mt-1 ${openAnomalies > 0 ? 'text-red-600' : ''}`}>
                      {openAnomalies}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">unresolved</p>
                  </div>
                  <AlertTriangle className={`h-5 w-5 mt-0.5 ${openAnomalies > 0 ? 'text-red-400' : 'text-muted-foreground/50'}`} />
                </div>
              </Link>
            </CardContent>
          </Card>
        )}

        {(profile.role === 'manager' || profile.role === 'admin') && pendingLeave > 0 && (
          <Card>
            <CardContent className="pt-5">
              <Link href="/leave/requests" className="block">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wide">Leave Requests</p>
                    <p className="text-2xl font-bold mt-1">{pendingLeave}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">pending review</p>
                  </div>
                  <Calendar className="h-5 w-5 text-yellow-500 mt-0.5" />
                </div>
              </Link>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
