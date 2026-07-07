import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { TimesheetGrid } from '@/components/timesheets/timesheet-grid'
import { getWeekStart, getWeekDays } from '@/lib/leave/accrual'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import Link from 'next/link'

interface TimesheetPageProps {
  searchParams: Promise<{ week?: string }>
}

export default async function TimesheetsPage({ searchParams }: TimesheetPageProps) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const params = await searchParams
  const weekStart = params.week ?? getWeekStart(new Date()).toISOString().split('T')[0]!
  const days = getWeekDays(weekStart)

  const { data: profile } = await supabase
    .from('users')
    .select('full_name, role, org_id')
    .eq('id', user.id)
    .single()

  if (!profile) redirect('/login')

  const [
    { data: timesheet },
    { data: entries },
    { data: chargeCodes },
    { data: approvedLeave },
  ] = await Promise.all([
    supabase
      .from('timesheets')
      .select('*')
      .eq('org_id', profile.org_id)
      .eq('user_id', user.id)
      .eq('week_start_date', weekStart)
      .maybeSingle(),
    supabase
      .from('timesheet_entries')
      .select('*')
      .eq('org_id', profile.org_id)
      .eq('user_id', user.id)
      .gte('work_date', weekStart)
      .lte('work_date', days[6]!),
    supabase
      .from('charge_codes')
      .select('*')
      .eq('org_id', profile.org_id)
      .eq('is_active', true)
      .order('code'),
    supabase
      .from('leave_requests')
      .select('requested_hours')
      .eq('org_id', profile.org_id)
      .eq('user_id', user.id)
      .eq('status', 'approved')
      .gte('start_date', weekStart)
      .lte('end_date', days[6]!),
  ])

  const approvedLeaveHours = approvedLeave?.reduce((sum, r) => sum + r.requested_hours, 0) ?? 0

  // Build proxy actor name map for any proxy entries this week
  const proxyActorIds = Array.from(
    new Set(
      (entries ?? [])
        .filter((e) => e.is_proxy_entry && e.proxy_actor_id)
        .map((e) => e.proxy_actor_id as string)
    )
  )
  const proxyActorNames: Record<string, string> = {}
  if (proxyActorIds.length > 0) {
    const { data: actorUsers } = await supabase
      .from('users')
      .select('id, full_name')
      .in('id', proxyActorIds)
    for (const u of actorUsers ?? []) {
      proxyActorNames[u.id as string] = u.full_name as string
    }
  }

  // Prev/next week navigation
  const prevWeek = new Date(weekStart)
  prevWeek.setDate(prevWeek.getDate() - 7)
  const nextWeek = new Date(weekStart)
  nextWeek.setDate(nextWeek.getDate() + 7)
  const currentWeekStart = getWeekStart(new Date()).toISOString().split('T')[0]!
  const isCurrentWeek = weekStart === currentWeekStart

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Timesheets</h1>
        <div className="flex items-center gap-1">
          <Link
            href={`/timesheets?week=${prevWeek.toISOString().split('T')[0]}`}
            className="inline-flex h-8 w-8 items-center justify-center rounded-md border hover:bg-muted transition-colors"
          >
            <ChevronLeft className="h-4 w-4" />
          </Link>
          {!isCurrentWeek && (
            <Link
              href="/timesheets"
              className="text-xs text-primary hover:underline px-2"
            >
              Today
            </Link>
          )}
          <Link
            href={`/timesheets?week=${nextWeek.toISOString().split('T')[0]}`}
            className="inline-flex h-8 w-8 items-center justify-center rounded-md border hover:bg-muted transition-colors"
          >
            <ChevronRight className="h-4 w-4" />
          </Link>
        </div>
      </div>

      <TimesheetGrid
        timesheet={timesheet ?? null}
        weekStart={weekStart}
        days={days}
        chargeCodes={chargeCodes ?? []}
        initialEntries={entries ?? []}
        userId={user.id}
        orgId={profile.org_id}
        fullName={profile.full_name}
        approvedLeaveHours={approvedLeaveHours}
        proxyActorNames={proxyActorNames}
      />

      <div className="text-xs text-muted-foreground text-right">
        <Link href="/timesheets/history" className="hover:underline">
          View timesheet history →
        </Link>
      </div>
    </div>
  )
}
