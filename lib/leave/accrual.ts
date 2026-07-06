import { type TenureTier, type LeaveType } from '@/types'

export function getTenureTier(hireDate: string, asOfDate?: string): TenureTier {
  const hire = new Date(hireDate)
  const ref = asOfDate ? new Date(asOfDate) : new Date()
  const yearsEmployed = (ref.getTime() - hire.getTime()) / (1000 * 60 * 60 * 24 * 365.25)

  if (yearsEmployed < 1) return 'year_0_1'
  if (yearsEmployed < 3) return 'year_1_3'
  if (yearsEmployed < 5) return 'year_3_5'
  return 'year_5_plus'
}

export function getWeekStart(date: Date): Date {
  const d = new Date(date)
  const day = d.getDay()
  const diff = day === 0 ? -6 : 1 - day
  d.setDate(d.getDate() + diff)
  d.setHours(0, 0, 0, 0)
  return d
}

export function getWeekDays(weekStart: string): string[] {
  const start = new Date(weekStart)
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(start)
    d.setDate(start.getDate() + i)
    return d.toISOString().split('T')[0]!
  })
}

export function formatHours(hours: number): string {
  if (hours === Math.floor(hours)) return `${hours}h`
  return `${hours}h`
}

export function getLeaveTypeLabel(type: LeaveType): string {
  const labels: Record<LeaveType, string> = {
    annual: 'Annual Leave',
    sick: 'Sick Leave',
    comp: 'Comp Time',
    jury_duty: 'Jury Duty',
    bereavement: 'Bereavement',
    fmla: 'FMLA',
    unpaid: 'Unpaid Leave',
  }
  return labels[type]
}

export function calculateExpectedHours(weekDays: string[], excludeWeekends = true): number {
  if (!excludeWeekends) return weekDays.length * 8
  return weekDays.filter((d) => {
    const day = new Date(d).getDay()
    return day !== 0 && day !== 6
  }).length * 8
}
