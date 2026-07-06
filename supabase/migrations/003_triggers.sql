-- ============================================================
-- Postgres Triggers
-- ============================================================

-- ============================================================
-- BLOCK all UPDATE and DELETE on audit_log
-- ============================================================
create or replace function block_audit_log_mutations()
returns trigger
language plpgsql
as $$
begin
  raise exception 'audit_log is immutable — UPDATE and DELETE are not permitted';
end;
$$;

create trigger no_update_audit_log
  before update on audit_log
  for each row execute function block_audit_log_mutations();

create trigger no_delete_audit_log
  before delete on audit_log
  for each row execute function block_audit_log_mutations();

-- ============================================================
-- BLOCK DELETE on anomalies
-- ============================================================
create or replace function block_anomaly_deletes()
returns trigger
language plpgsql
as $$
begin
  raise exception 'anomalies are immutable — DELETE is not permitted';
end;
$$;

create trigger no_delete_anomalies
  before delete on anomalies
  for each row execute function block_anomaly_deletes();

-- ============================================================
-- Detect late timesheet entries (> 24 hours after work_date)
-- ============================================================
create or replace function check_late_entry()
returns trigger
language plpgsql
security definer
as $$
declare
  v_org_id uuid;
  v_late_count integer;
begin
  v_org_id := new.org_id;

  -- Flag if entry_created_at is more than 24 hours after work_date
  if new.entry_created_at > (new.work_date::timestamptz + interval '24 hours') then
    insert into anomalies (org_id, user_id, anomaly_type, severity, description)
    values (
      v_org_id,
      new.user_id,
      'late_entry_pattern',
      'low',
      format(
        'Late timesheet entry: work_date=%s, entry_created_at=%s',
        new.work_date,
        new.entry_created_at
      )
    );

    -- Count late entries this month for this user
    select count(*) into v_late_count
    from anomalies
    where org_id = v_org_id
      and user_id = new.user_id
      and anomaly_type = 'late_entry_pattern'
      and created_at >= date_trunc('month', now());

    -- 3+ late entries in one month → HIGH severity anomaly
    if v_late_count >= 3 then
      insert into anomalies (org_id, user_id, anomaly_type, severity, description)
      values (
        v_org_id,
        new.user_id,
        'late_entry_pattern',
        'high',
        format(
          'Pattern: %s late timesheet entries in %s',
          v_late_count,
          to_char(now(), 'Month YYYY')
        )
      );
    end if;
  end if;

  return new;
end;
$$;

create trigger check_late_entry_trigger
  after insert on timesheet_entries
  for each row execute function check_late_entry();

-- ============================================================
-- Detect certified timesheet modification
-- ============================================================
create or replace function detect_certified_modification()
returns trigger
language plpgsql
security definer
as $$
begin
  -- If timesheet was already certified and entries are being added/modified
  if exists (
    select 1 from timesheets
    where id = new.timesheet_id
    and certified_by_employee = true
  ) then
    insert into anomalies (org_id, user_id, anomaly_type, severity, description)
    values (
      new.org_id,
      new.user_id,
      'timesheet_modified_after_certification',
      'critical',
      format('Timesheet entry modified after certification. Timesheet ID: %s', new.timesheet_id)
    );
  end if;

  return new;
end;
$$;

create trigger detect_certified_modification_trigger
  after update on timesheet_entries
  for each row execute function detect_certified_modification();

-- ============================================================
-- Detect leave balance going negative
-- ============================================================
create or replace function detect_negative_balance()
returns trigger
language plpgsql
security definer
as $$
begin
  if new.available_hours < 0 then
    insert into anomalies (org_id, user_id, anomaly_type, severity, description)
    values (
      new.org_id,
      new.user_id,
      'insufficient_balance',
      'critical',
      format(
        'Leave balance went negative for %s: available_hours=%s',
        new.leave_type,
        new.available_hours
      )
    );
  end if;

  return new;
end;
$$;

create trigger detect_negative_balance_trigger
  after update on leave_balances
  for each row execute function detect_negative_balance();

-- ============================================================
-- Detect unauthorized leave balance modification
-- (balance changed without a corresponding approved request)
-- ============================================================
create or replace function detect_unauthorized_balance_edit()
returns trigger
language plpgsql
security definer
as $$
declare
  v_approved_hours numeric;
begin
  -- Only flag if used_hours or accrued_hours changed
  if old.used_hours != new.used_hours or old.accrued_hours != new.accrued_hours then
    -- Check if there is a recent approved request that justifies the change
    select coalesce(sum(requested_hours), 0) into v_approved_hours
    from leave_requests
    where user_id = new.user_id
      and org_id = new.org_id
      and leave_type = new.leave_type
      and status = 'approved'
      and reviewed_at > now() - interval '5 minutes';

    if v_approved_hours = 0 then
      insert into anomalies (org_id, user_id, anomaly_type, severity, description)
      values (
        new.org_id,
        new.user_id,
        'unauthorized_balance_edit',
        'critical',
        format(
          'Leave balance modified without approved request. Type: %s, Old accrued: %s → %s, Old used: %s → %s. Actor: %s',
          new.leave_type,
          old.accrued_hours, new.accrued_hours,
          old.used_hours, new.used_hours,
          auth.uid()
        )
      );
    end if;
  end if;

  return new;
end;
$$;

create trigger detect_unauthorized_balance_edit_trigger
  after update on leave_balances
  for each row execute function detect_unauthorized_balance_edit();

-- ============================================================
-- Rubber stamp detection: track approval timestamps
-- ============================================================
create or replace function detect_rubber_stamp()
returns trigger
language plpgsql
security definer
as $$
declare
  v_recent_approvals integer;
begin
  -- Only fires when status changes to 'approved'
  if new.status = 'approved' and old.status != 'approved' then
    -- Count approvals by this manager in the last 2 minutes
    select count(*) into v_recent_approvals
    from timesheets
    where approved_by = new.approved_by
      and approved_at > now() - interval '2 minutes'
      and status = 'approved';

    if v_recent_approvals >= 5 then
      insert into anomalies (org_id, user_id, anomaly_type, severity, description)
      values (
        new.org_id,
        new.approved_by,
        'timesheet_modified_after_certification',
        'medium',
        format(
          'Rubber stamp pattern: manager %s approved %s timesheets in under 2 minutes',
          new.approved_by,
          v_recent_approvals
        )
      );
    end if;
  end if;

  return new;
end;
$$;

create trigger detect_rubber_stamp_trigger
  after update on timesheets
  for each row execute function detect_rubber_stamp();
