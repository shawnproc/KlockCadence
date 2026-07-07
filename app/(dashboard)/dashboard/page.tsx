import { redirect } from 'next/navigation'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { getWeekStart } from '@/lib/leave/accrual'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Clock, Calendar, AlertTriangle, CheckCircle2, FileText } from 'lucide-react'
import Link from 'next/link'
import { formatWeekRange } from '@/lib/utils'
import { ComplianceScore, type ComplianceBreakdownItem } from '@/components/dashboard/compliance-score'
import { ActivityFeed, type ActivityEntry } from '@/components/dashboard/activity-feed'
import { PresenceWidget, type EmployeeStatus } from '@/components/dashboard/presence-widget'

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

  // ── Admin/Finance: compliance score + activity feed ──────────────────────
  let complianceScore = 0
  let complianceBreakdown: ComplianceBreakdownItem[] = []
  let activityEntries: ActivityEntry[] = []

  if (profile.role === 'admin' || profile.role === 'finance') {
    const svc = await createServiceClient()
    const eightWeeksAgo = new Date()
    eightWeeksAgo.setDate(eightWeeksAgo.getDate() - 56)
    const eightWeeksAgoStr = eightWeeksAgo.toISOString().split('T')[0]!

    const [
      { data: recentTimesheets },
      { count: criticalCount },
      { count: negativeBalances },
      { data: rawActivity },
    ] = await Promise.all([
      svc.from('timesheets')
        .select('week_start_date, certified_at, approved_at, status')
        .eq('org_id', profile.org_id)
        .gte('week_start_date', eightWeeksAgoStr),
      svc.from('anomalies')
        .select('id', { count: 'exact', head: true })
        .eq('org_id', profile.org_id)
        .eq('severity', 'critical')
        .eq('resolved', false),
      svc.from('leave_balances')
        .select('id', { count: 'exact', head: true })
        .eq('org_id', profile.org_id)
        .lt('available_hours', 0),
      svc.from('audit_log')
        .select('id, action, created_at, new_value, actor:actor_id(full_name)')
        .eq('org_id', profile.org_id)
        .order('created_at', { ascending: false })
        .limit(10),
    ])

    // pts1: timesheets submitted on time (certified before end of Friday)
    const certified = (recentTimesheets ?? []).filter((ts) => ts.certified_at)
    const onTime = certified.filter((ts) => {
      const friday = new Date(ts.week_start_date)
      friday.setDate(friday.getDate() + 4)
      friday.setHours(23, 59, 59, 999)
      return new Date(ts.certified_at!) <= friday
    })
    const pts1 = certified.length > 0 ? Math.round((onTime.length / certified.length) * 25) : 25

    // pts2: no unresolved critical anomalies
    const pts2 = (criticalCount ?? 0) === 0 ? 25 : 0

    // pts3: timesheets approved within 7 calendar days of week end
    const approved = (recentTimesheets ?? []).filter((ts) => ts.status === 'approved' && ts.approved_at)
    const timelyApproved = approved.filter((ts) => {
      const friday = new Date(ts.week_start_date)
      friday.setDate(friday.getDate() + 4)
      const diff = (new Date(ts.approved_at!).getTime() - friday.getTime()) / 86400000
      return diff <= 7
    })
    const pts3 = approved.length > 0 ? Math.round((timelyApproved.length / approved.length) * 25) : 25

    // pts4: no negative leave balances
    const pts4 = (negativeBalances ?? 0) === 0 ? 25 : Math.max(0, 25 - (negativeBalances ?? 0) * 5)

    complianceScore = pts1 + pts2 + pts3 + pts4
    complianceBreakdown = [
      { label: 'Timesheets on time',    pts: pts1, max: 25 },
      { label: 'Critical Anomaly Status', pts: pts2, max: 25, zeroLabel: 'Issue detected' },
      { label: 'Timely approvals',      pts: pts3, max: 25 },
      { label: 'Healthy balances',      pts: pts4, max: 25 },
    ]

    activityEntries = (rawActivity ?? []).map((e) => ({
      id: e.id as string,
      action: e.action as string,
      created_at: e.created_at as string,
      new_value: e.new_value as Record<string, unknown> | null,
      actor: (e.actor as unknown) as { full_name: string } | null,
    }))
  }

  // ── Admin: team presence ──────────────────────────────────────────────────
  let presenceEmployees: EmployeeStatus[] = []

  if (profile.role === 'admin') {
    const svc = await createServiceClient()
    const todayStart = new Date()
    todayStart.setHours(0, 0, 0, 0)

    const [{ data: allUsers }, { data: todayActors }] = await Promise.all([
      svc.from('users')
        .select('id, full_name, department')
        .eq('org_id', profile.org_id)
        .neq('id', user.id)
        .order('full_name'),
      svc.from('audit_log')
        .select('actor_id')
        .eq('org_id', profile.org_id)
        .gte('created_at', todayStart.toISOString()),
    ])

    const activeIds = new Set((todayActors ?? []).map((a) => a.actor_id as string))

    presenceEmployees = (allUsers ?? []).map((u) => ({
      id: u.id as string,
      full_name: u.full_name as string,
      department: (u.department ?? '') as string,
      active_today: activeIds.has(u.id as string),
    }))
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

      {/* Compliance score + Activity feed (admin/finance) */}
      {(profile.role === 'admin' || profile.role === 'finance') && (
        <div className="grid gap-4 lg:grid-cols-2">
          <ComplianceScore score={complianceScore} breakdown={complianceBreakdown} />
          <ActivityFeed entries={activityEntries} />
        </div>
      )}

      {/* Team presence (admin only) */}
      {profile.role === 'admin' && presenceEmployees.length > 0 && (
        <PresenceWidget employees={presenceEmployees} />
      )}
    </div>
  )
}
