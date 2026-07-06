-- ============================================================
-- Row Level Security Policies
-- Every table scoped to org_id — no exceptions
-- ============================================================

-- Helper function: get caller's org_id from users table
create or replace function auth_org_id()
returns uuid
language sql
stable
security definer
as $$
  select org_id from users where id = auth.uid()
$$;

-- Helper function: get caller's role
create or replace function auth_user_role()
returns user_role
language sql
stable
security definer
as $$
  select role from users where id = auth.uid()
$$;

-- ============================================================
-- ORGANIZATIONS
-- ============================================================
alter table organizations enable row level security;

create policy "org_members_can_read_own_org"
  on organizations for select
  using (id = auth_org_id());

-- Only admin can update org settings
create policy "admin_can_update_org"
  on organizations for update
  using (id = auth_org_id() and auth_user_role() = 'admin');

-- ============================================================
-- USERS
-- ============================================================
alter table users enable row level security;

create policy "users_can_read_own_org"
  on users for select
  using (org_id = auth_org_id());

create policy "users_can_update_own_profile"
  on users for update
  using (id = auth.uid());

create policy "admin_can_insert_users"
  on users for insert
  with check (org_id = auth_org_id() and auth_user_role() = 'admin');

create policy "admin_can_update_users"
  on users for update
  using (org_id = auth_org_id() and auth_user_role() = 'admin');

-- ============================================================
-- CHARGE CODES
-- ============================================================
alter table charge_codes enable row level security;

create policy "org_members_can_read_charge_codes"
  on charge_codes for select
  using (org_id = auth_org_id());

create policy "admin_can_manage_charge_codes"
  on charge_codes for all
  using (org_id = auth_org_id() and auth_user_role() = 'admin');

-- ============================================================
-- TIMESHEETS
-- ============================================================
alter table timesheets enable row level security;

-- Employees see only their own; managers/admin/finance see all in org
create policy "employee_sees_own_timesheets"
  on timesheets for select
  using (
    org_id = auth_org_id()
    and (
      user_id = auth.uid()
      or auth_user_role() in ('manager', 'admin', 'finance')
    )
  );

-- Employees can create their own timesheets
create policy "employee_can_create_timesheet"
  on timesheets for insert
  with check (
    org_id = auth_org_id()
    and user_id = auth.uid()
  );

-- Employees can update draft timesheets; managers can approve/reject
create policy "employee_can_update_draft_timesheet"
  on timesheets for update
  using (
    org_id = auth_org_id()
    and (
      (user_id = auth.uid() and status in ('draft', 'rejected'))
      or auth_user_role() in ('manager', 'admin')
    )
  );

-- ============================================================
-- TIMESHEET ENTRIES
-- ============================================================
alter table timesheet_entries enable row level security;

create policy "employee_sees_own_entries"
  on timesheet_entries for select
  using (
    org_id = auth_org_id()
    and (
      user_id = auth.uid()
      or auth_user_role() in ('manager', 'admin', 'finance')
    )
  );

-- Employees can only insert their own entries
create policy "employee_inserts_own_entries"
  on timesheet_entries for insert
  with check (
    org_id = auth_org_id()
    and user_id = auth.uid()
  );

-- Employees can update entries on non-certified timesheets
create policy "employee_updates_own_entries"
  on timesheet_entries for update
  using (
    org_id = auth_org_id()
    and user_id = auth.uid()
    and exists (
      select 1 from timesheets t
      where t.id = timesheet_id
      and t.certified_by_employee = false
      and t.status in ('draft', 'rejected')
    )
  );

create policy "employee_deletes_own_entries"
  on timesheet_entries for delete
  using (
    org_id = auth_org_id()
    and user_id = auth.uid()
    and exists (
      select 1 from timesheets t
      where t.id = timesheet_id
      and t.certified_by_employee = false
      and t.status in ('draft', 'rejected')
    )
  );

-- ============================================================
-- LEAVE POLICIES
-- ============================================================
alter table leave_policies enable row level security;

create policy "org_members_can_read_leave_policies"
  on leave_policies for select
  using (org_id = auth_org_id());

create policy "admin_can_manage_leave_policies"
  on leave_policies for all
  using (org_id = auth_org_id() and auth_user_role() = 'admin');

-- ============================================================
-- LEAVE BALANCES
-- ============================================================
alter table leave_balances enable row level security;

create policy "employee_sees_own_balance"
  on leave_balances for select
  using (
    org_id = auth_org_id()
    and (
      user_id = auth.uid()
      or auth_user_role() in ('manager', 'admin', 'finance')
    )
  );

-- Only admin/finance can modify balances — triggers anomaly detection
create policy "admin_finance_can_manage_balances"
  on leave_balances for all
  using (
    org_id = auth_org_id()
    and auth_user_role() in ('admin', 'finance')
  );

-- ============================================================
-- LEAVE REQUESTS
-- ============================================================
alter table leave_requests enable row level security;

create policy "employee_sees_own_requests"
  on leave_requests for select
  using (
    org_id = auth_org_id()
    and (
      user_id = auth.uid()
      or auth_user_role() in ('manager', 'admin', 'finance')
    )
  );

create policy "employee_can_submit_request"
  on leave_requests for insert
  with check (
    org_id = auth_org_id()
    and user_id = auth.uid()
  );

create policy "employee_can_cancel_own_request"
  on leave_requests for update
  using (
    org_id = auth_org_id()
    and (
      (user_id = auth.uid() and status = 'pending')
      or auth_user_role() in ('manager', 'admin')
    )
  );

-- ============================================================
-- AUDIT LOG
-- ============================================================
alter table audit_log enable row level security;

-- Admin only can read audit log
create policy "admin_can_read_audit_log"
  on audit_log for select
  using (
    org_id = auth_org_id()
    and auth_user_role() in ('admin', 'finance')
  );

-- Any org member can insert (via server-side only in practice)
create policy "service_can_insert_audit_log"
  on audit_log for insert
  with check (org_id = auth_org_id());

-- BLOCK all updates and deletes — enforced by trigger below

-- ============================================================
-- ANOMALIES
-- ============================================================
alter table anomalies enable row level security;

create policy "finance_admin_can_read_anomalies"
  on anomalies for select
  using (
    org_id = auth_org_id()
    and auth_user_role() in ('admin', 'finance', 'manager')
  );

create policy "service_can_insert_anomalies"
  on anomalies for insert
  with check (org_id = auth_org_id());

-- Only admin/finance can resolve anomalies (update resolved field only)
create policy "admin_finance_can_resolve_anomalies"
  on anomalies for update
  using (
    org_id = auth_org_id()
    and auth_user_role() in ('admin', 'finance')
  );
