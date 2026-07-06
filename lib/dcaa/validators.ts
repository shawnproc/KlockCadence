import { type TimesheetEntry, type LeaveBalance, type LeaveRequest } from '@/types'

export const DCAA_CERTIFICATION_TEXT =
  'I certify that to the best of my knowledge and belief the time recorded on this timesheet is an accurate reflection of my work on the identified contracts/projects for the period indicated. I understand that the deliberate falsification of timesheets is a violation of company policy and may constitute a violation of federal law including the False Claims Act (31 U.S.C. §§ 3729-3733).'

export const MIN_MANAGER_REVIEW_SECONDS = 60

export interface ValidationResult {
  valid: boolean
  errors: string[]
}

export function validateWeeklyHours(
  entries: TimesheetEntry[],
  weekDays: string[],
  approvedLeaveHours: number
): ValidationResult {
  const errors: string[] = []

  const workDays = weekDays.filter((d) => {
    const day = new Date(d).getDay()
    return day !== 0 && day !== 6
  })

  const expectedHours = workDays.length * 8
  const loggedHours = entries.reduce((sum, e) => sum + Number(e.hours), 0)
  const totalAccountedHours = loggedHours + approvedLeaveHours

  if (totalAccountedHours < expectedHours) {
    errors.push(
      `Total time accounting gap: ${expectedHours}h expected, ${totalAccountedHours}h accounted for (${loggedHours}h logged + ${approvedLeaveHours}h approved leave). All hours must be accounted for per DCAA requirements.`
    )
  }

  return { valid: errors.length === 0, errors }
}

export function validateCertificationName(
  typedName: string,
  expectedName: string
): ValidationResult {
  const errors: string[] = []
  const normalized = (s: string) => s.trim().toLowerCase().replace(/\s+/g, ' ')

  if (normalized(typedName) !== normalized(expectedName)) {
    errors.push('Typed name must match your full legal name exactly as it appears in your profile.')
  }

  return { valid: errors.length === 0, errors }
}

export function validateLeaveRequestBalance(
  balance: LeaveBalance,
  request: Pick<LeaveRequest, 'requested_hours'>
): ValidationResult {
  const errors: string[] = []

  if (request.requested_hours > balance.available_hours) {
    errors.push(
      `Insufficient balance: requesting ${request.requested_hours}h but only ${balance.available_hours}h available.`
    )
  }

  return { valid: errors.length === 0, errors }
}

export function isLateEntry(workDate: string, entryCreatedAt: string): boolean {
  const work = new Date(workDate)
  work.setHours(0, 0, 0, 0)
  const deadline = new Date(work.getTime() + 24 * 60 * 60 * 1000)
  return new Date(entryCreatedAt) > deadline
}
