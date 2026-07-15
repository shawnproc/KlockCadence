import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { TimesheetApprovalQueue, type PendingTimesheet } from '@/components/timesheets/timesheet-approval-queue'

export default async function TimesheetApprovalsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('users')
    .select('role, org_id')
    .eq('id', user.id)
    .single()

  if (!profile || !['manager', 'admin'].includes(profile.role)) {
    redirect('/dashboard')
  }

  // Submitted timesheets awaiting review (not the reviewer's own — segregation of duties).
  const { data: timesheets } = await supabase
    .from('timesheets')
    .select('id, user_id, week_start_date, certified_at, users!user_id(full_name, email, department)')
    .eq('org_id', profile.org_id)
    .eq('status', 'submitted')
    .neq('user_id', user.id)
    .order('week_start_date', { ascending: true })

  const ids = (timesheets ?? []).map((t) => t.id as string)

  // Entries for those timesheets, with charge-code labels, for review.
  const entriesByTimesheet: Record<string, PendingTimesheet['entries']> = {}
  if (ids.length > 0) {
    const { data: entries } = await supabase
      .from('timesheet_entries')
      .select('timesheet_id, work_date, hours, work_description, is_proxy_entry, charge_codes(code, description)')
      .in('timesheet_id', ids)
      .order('work_date', { ascending: true })

    for (const e of entries ?? []) {
      const tid = e.timesheet_id as string
      const cc = e.charge_codes as unknown as { code: string; description: string } | null
      ;(entriesByTimesheet[tid] ??= []).push({
        work_date: e.work_date as string,
        hours: Number(e.hours),
        work_description: (e.work_description as string) ?? '',
        is_proxy_entry: !!e.is_proxy_entry,
        charge_code: cc?.code ?? '—',
        charge_description: cc?.description ?? '',
      })
    }
  }

  const pending: PendingTimesheet[] = (timesheets ?? []).map((t) => {
    const u = t.users as unknown as { full_name: string; email: string; department: string } | null
    const entries = entriesByTimesheet[t.id as string] ?? []
    return {
      id: t.id as string,
      employee_name: u?.full_name ?? 'Unknown',
      email: u?.email ?? '',
      department: u?.department ?? '',
      week_start_date: t.week_start_date as string,
      certified_at: (t.certified_at as string) ?? null,
      total_hours: entries.reduce((sum, e) => sum + e.hours, 0),
      entries,
    }
  })

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Timesheet Approvals</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {pending.length} timesheet{pending.length === 1 ? '' : 's'} awaiting your review
        </p>
      </div>
      <TimesheetApprovalQueue timesheets={pending} />
    </div>
  )
}
