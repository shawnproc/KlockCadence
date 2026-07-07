export type UserRole = 'employee' | 'manager' | 'admin' | 'finance'
export type HolidaySchedule = 'federal' | 'custom'
export type TimesheetStatus = 'draft' | 'submitted' | 'approved' | 'rejected'
export type LeaveType = 'annual' | 'sick' | 'comp' | 'jury_duty' | 'bereavement' | 'fmla' | 'unpaid'
export type LeaveRequestStatus = 'pending' | 'approved' | 'denied' | 'cancelled'
export type TenureTier = 'year_0_1' | 'year_1_3' | 'year_3_5' | 'year_5_plus'
export type AnomalyType =
  | 'insufficient_balance'
  | 'unauthorized_balance_edit'
  | 'missing_timesheet'
  | 'hours_shortage'
  | 'timesheet_modified_after_certification'
  | 'late_entry_pattern'
  | 'missing_accrual'
  | 'policy_unacknowledged'
export type AnomalySeverity = 'low' | 'medium' | 'high' | 'critical'

export interface Organization {
  id: string
  name: string
  slug: string
  fiscal_year_start: string
  holiday_schedule: HolidaySchedule
  policy_version: string
  policy_version_updated_at: string
  policy_text: string
  created_at: string
}

export interface PolicyAcknowledgment {
  id: string
  org_id: string
  user_id: string
  policy_version: string
  acknowledged_at: string
  ip_address: string
}

export interface User {
  id: string
  org_id: string
  full_name: string
  email: string
  role: UserRole
  department: string
  hire_date: string
  created_at: string
}

export interface ChargeCode {
  id: string
  org_id: string
  code: string
  description: string
  contract_number: string | null
  is_billable: boolean
  is_active: boolean
  created_at: string
}

export interface Timesheet {
  id: string
  org_id: string
  user_id: string
  week_start_date: string
  status: TimesheetStatus
  certified_by_employee: boolean
  certified_at: string | null
  approved_by: string | null
  approved_at: string | null
  rejection_reason: string | null
  created_at: string
}

export interface TimesheetEntry {
  id: string
  org_id: string
  timesheet_id: string
  user_id: string
  charge_code_id: string
  work_date: string
  hours: number
  work_description: string
  created_at: string
  entry_created_at: string
}

export interface LeavePolicy {
  id: string
  org_id: string
  leave_type: LeaveType
  accrual_rate_per_pay_period: number
  max_accrual_hours: number
  carryover_cap_hours: number
  tenure_tier: TenureTier
  created_at: string
}

export interface LeaveBalance {
  id: string
  org_id: string
  user_id: string
  leave_type: LeaveType
  accrued_hours: number
  used_hours: number
  pending_hours: number
  available_hours: number
  last_accrual_date: string
  created_at: string
}

export interface LeaveRequest {
  id: string
  org_id: string
  user_id: string
  leave_type: LeaveType
  requested_hours: number
  start_date: string
  end_date: string
  status: LeaveRequestStatus
  reviewed_by: string | null
  reviewed_at: string | null
  employee_notes: string | null
  reviewer_notes: string | null
  created_at: string
}

export interface AuditLog {
  id: string
  org_id: string
  actor_id: string
  action: string
  target_table: string
  target_id: string
  old_value: Record<string, unknown> | null
  new_value: Record<string, unknown> | null
  ip_address: string
  created_at: string
}

export interface Anomaly {
  id: string
  org_id: string
  user_id: string
  anomaly_type: AnomalyType
  severity: AnomalySeverity
  description: string
  resolved: boolean
  resolved_by: string | null
  resolved_at: string | null
  created_at: string
}

// Extended types with joins
export interface TimesheetWithUser extends Timesheet {
  users: Pick<User, 'full_name' | 'email' | 'department'>
}

export interface TimesheetEntryWithCode extends TimesheetEntry {
  charge_codes: Pick<ChargeCode, 'code' | 'description' | 'is_billable'>
}

export interface LeaveRequestWithUser extends LeaveRequest {
  users: Pick<User, 'full_name' | 'email'>
  reviewer?: Pick<User, 'full_name'> | null
}

export interface AnomalyWithUser extends Anomaly {
  users: Pick<User, 'full_name' | 'email'>
}

export interface AuditLogWithActor extends AuditLog {
  actor: Pick<User, 'full_name' | 'email'>
}

// Weekly timesheet grid types
export interface WeeklyTimesheetRow {
  charge_code_id: string
  charge_code: ChargeCode
  entries: Record<string, number> // work_date -> hours
}

export interface WeeklyTimesheetGrid {
  timesheet: Timesheet | null
  week_start: string
  days: string[] // ISO date strings Mon-Sun
  rows: WeeklyTimesheetRow[]
  daily_totals: Record<string, number>
  week_total: number
}

// Dashboard widget types
export interface DashboardStats {
  pending_timesheets?: number
  pending_leave_requests?: number
  open_anomalies?: number
  team_hours_this_week?: number
  my_leave_balances?: LeaveBalance[]
  current_timesheet_status?: TimesheetStatus | null
  hours_logged_this_week?: number
}

// DCAA Audit Package
export interface DCAAExportOptions {
  org_id: string
  start_date: string
  end_date: string
  include_timesheets: boolean
  include_leave: boolean
  include_anomalies: boolean
  include_audit_log: boolean
}
