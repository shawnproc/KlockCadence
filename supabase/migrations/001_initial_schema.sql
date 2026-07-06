-- ============================================================
-- KlockCadence Initial Schema
-- DCAA-Compliant Timekeeping & PTO Management
-- ============================================================

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- ============================================================
-- ENUMS
-- ============================================================

create type user_role as enum ('employee', 'manager', 'admin', 'finance');
create type holiday_schedule as enum ('federal', 'custom');
create type timesheet_status as enum ('draft', 'submitted', 'approved', 'rejected');
create type leave_type as enum ('annual', 'sick', 'comp', 'jury_duty', 'bereavement', 'fmla', 'unpaid');
create type leave_request_status as enum ('pending', 'approved', 'denied', 'cancelled');
create type tenure_tier as enum ('year_0_1', 'year_1_3', 'year_3_5', 'year_5_plus');
create type anomaly_type as enum (
  'insufficient_balance',
  'unauthorized_balance_edit',
  'missing_timesheet',
  'hours_shortage',
  'timesheet_modified_after_certification',
  'late_entry_pattern',
  'missing_accrual'
);
create type anomaly_severity as enum ('low', 'medium', 'high', 'critical');

-- ============================================================
-- ORGANIZATIONS
-- ============================================================

create table organizations (
  id                  uuid primary key default uuid_generate_v4(),
  name                text not null,
  slug                text not null unique,
  fiscal_year_start   date not null,
  holiday_schedule    holiday_schedule not null default 'federal',
  created_at          timestamptz not null default now()
);

-- ============================================================
-- USERS
-- ============================================================

create table users (
  id          uuid primary key references auth.users(id) on delete cascade,
  org_id      uuid not null references organizations(id) on delete cascade,
  full_name   text not null,
  email       text not null,
  role        user_role not null default 'employee',
  department  text not null default '',
  hire_date   date not null,
  created_at  timestamptz not null default now()
);

create index idx_users_org_id on users(org_id);
create index idx_users_email on users(email);

-- ============================================================
-- CHARGE CODES
-- ============================================================

create table charge_codes (
  id               uuid primary key default uuid_generate_v4(),
  org_id           uuid not null references organizations(id) on delete cascade,
  code             text not null,
  description      text not null,
  contract_number  text,
  is_billable      boolean not null default true,
  is_active        boolean not null default true,
  created_at       timestamptz not null default now(),
  unique (org_id, code)
);

create index idx_charge_codes_org_id on charge_codes(org_id);

-- ============================================================
-- TIMESHEETS
-- ============================================================

create table timesheets (
  id                      uuid primary key default uuid_generate_v4(),
  org_id                  uuid not null references organizations(id) on delete cascade,
  user_id                 uuid not null references users(id) on delete cascade,
  week_start_date         date not null,
  status                  timesheet_status not null default 'draft',
  certified_by_employee   boolean not null default false,
  certified_at            timestamptz,
  approved_by             uuid references users(id),
  approved_at             timestamptz,
  rejection_reason        text,
  created_at              timestamptz not null default now(),
  unique (org_id, user_id, week_start_date)
);

create index idx_timesheets_org_id on timesheets(org_id);
create index idx_timesheets_user_id on timesheets(user_id);
create index idx_timesheets_week_start on timesheets(week_start_date);
create index idx_timesheets_status on timesheets(status);

-- ============================================================
-- TIMESHEET ENTRIES
-- ============================================================

create table timesheet_entries (
  id               uuid primary key default uuid_generate_v4(),
  org_id           uuid not null references organizations(id) on delete cascade,
  timesheet_id     uuid not null references timesheets(id) on delete cascade,
  user_id          uuid not null references users(id) on delete cascade,
  charge_code_id   uuid not null references charge_codes(id),
  work_date        date not null,
  hours            numeric(5,2) not null check (hours >= 0 and hours <= 24),
  notes            text,
  created_at       timestamptz not null default now(),
  entry_created_at timestamptz not null default now()
);

create index idx_timesheet_entries_org_id on timesheet_entries(org_id);
create index idx_timesheet_entries_timesheet_id on timesheet_entries(timesheet_id);
create index idx_timesheet_entries_user_id on timesheet_entries(user_id);
create index idx_timesheet_entries_work_date on timesheet_entries(work_date);

-- ============================================================
-- LEAVE POLICIES
-- ============================================================

create table leave_policies (
  id                           uuid primary key default uuid_generate_v4(),
  org_id                       uuid not null references organizations(id) on delete cascade,
  leave_type                   leave_type not null,
  accrual_rate_per_pay_period  numeric(6,4) not null,
  max_accrual_hours            numeric(6,2) not null,
  carryover_cap_hours          numeric(6,2) not null,
  tenure_tier                  tenure_tier not null,
  created_at                   timestamptz not null default now(),
  unique (org_id, leave_type, tenure_tier)
);

create index idx_leave_policies_org_id on leave_policies(org_id);

-- ============================================================
-- LEAVE BALANCES
-- ============================================================

create table leave_balances (
  id                  uuid primary key default uuid_generate_v4(),
  org_id              uuid not null references organizations(id) on delete cascade,
  user_id             uuid not null references users(id) on delete cascade,
  leave_type          leave_type not null,
  accrued_hours       numeric(8,2) not null default 0,
  used_hours          numeric(8,2) not null default 0,
  pending_hours       numeric(8,2) not null default 0,
  available_hours     numeric(8,2) generated always as (accrued_hours - used_hours - pending_hours) stored,
  last_accrual_date   date,
  created_at          timestamptz not null default now(),
  unique (org_id, user_id, leave_type)
);

create index idx_leave_balances_org_id on leave_balances(org_id);
create index idx_leave_balances_user_id on leave_balances(user_id);

-- ============================================================
-- LEAVE REQUESTS
-- ============================================================

create table leave_requests (
  id               uuid primary key default uuid_generate_v4(),
  org_id           uuid not null references organizations(id) on delete cascade,
  user_id          uuid not null references users(id) on delete cascade,
  leave_type       leave_type not null,
  requested_hours  numeric(6,2) not null check (requested_hours > 0),
  start_date       date not null,
  end_date         date not null,
  status           leave_request_status not null default 'pending',
  reviewed_by      uuid references users(id),
  reviewed_at      timestamptz,
  employee_notes   text,
  reviewer_notes   text,
  created_at       timestamptz not null default now(),
  check (end_date >= start_date)
);

create index idx_leave_requests_org_id on leave_requests(org_id);
create index idx_leave_requests_user_id on leave_requests(user_id);
create index idx_leave_requests_status on leave_requests(status);

-- ============================================================
-- AUDIT LOG (IMMUTABLE)
-- ============================================================

create table audit_log (
  id            uuid primary key default uuid_generate_v4(),
  org_id        uuid not null references organizations(id) on delete restrict,
  actor_id      uuid not null references users(id) on delete restrict,
  action        text not null,
  target_table  text not null,
  target_id     uuid not null,
  old_value     jsonb,
  new_value     jsonb,
  ip_address    text not null default '',
  created_at    timestamptz not null default now()
);

create index idx_audit_log_org_id on audit_log(org_id);
create index idx_audit_log_actor_id on audit_log(actor_id);
create index idx_audit_log_target_id on audit_log(target_id);
create index idx_audit_log_action on audit_log(action);
create index idx_audit_log_created_at on audit_log(created_at);

-- ============================================================
-- ANOMALIES (IMMUTABLE — never delete or update resolved logic
--            is done via separate resolved column only)
-- ============================================================

create table anomalies (
  id            uuid primary key default uuid_generate_v4(),
  org_id        uuid not null references organizations(id) on delete restrict,
  user_id       uuid not null references users(id) on delete restrict,
  anomaly_type  anomaly_type not null,
  severity      anomaly_severity not null,
  description   text not null,
  resolved      boolean not null default false,
  resolved_by   uuid references users(id),
  resolved_at   timestamptz,
  created_at    timestamptz not null default now()
);

create index idx_anomalies_org_id on anomalies(org_id);
create index idx_anomalies_user_id on anomalies(user_id);
create index idx_anomalies_severity on anomalies(severity);
create index idx_anomalies_resolved on anomalies(resolved);
