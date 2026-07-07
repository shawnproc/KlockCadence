-- ============================================================
-- Migration 007: Proxy Entry Exception
-- DCAA allows supervisors to enter time on behalf of employees
-- during prolonged absence or travel — but ALL proxy entries
-- must be documented, justified, and acknowledged by the employee.
-- ============================================================

-- Add proxy fields to timesheet_entries
ALTER TABLE timesheet_entries
  ADD COLUMN is_proxy_entry           boolean     NOT NULL DEFAULT false,
  ADD COLUMN proxy_actor_id           uuid        REFERENCES users(id),
  ADD COLUMN proxy_reason             text,
  ADD COLUMN employee_acknowledged    boolean     NOT NULL DEFAULT false,
  ADD COLUMN employee_acknowledged_at timestamptz;

-- Integrity: when proxy, actor + reason (≥50 chars) are required
ALTER TABLE timesheet_entries
  ADD CONSTRAINT proxy_entry_fields_required
  CHECK (
    NOT is_proxy_entry
    OR (
      proxy_actor_id IS NOT NULL
      AND proxy_reason IS NOT NULL
      AND length(trim(proxy_reason)) >= 50
    )
  );

-- Integrity: acknowledged_at must be set when acknowledged
ALTER TABLE timesheet_entries
  ADD CONSTRAINT proxy_acknowledged_timestamp
  CHECK (
    NOT employee_acknowledged
    OR employee_acknowledged_at IS NOT NULL
  );

CREATE INDEX idx_te_is_proxy         ON timesheet_entries(is_proxy_entry)         WHERE is_proxy_entry = true;
CREATE INDEX idx_te_proxy_actor      ON timesheet_entries(proxy_actor_id)         WHERE proxy_actor_id IS NOT NULL;
CREATE INDEX idx_te_proxy_unacked    ON timesheet_entries(employee_acknowledged)  WHERE is_proxy_entry = true AND employee_acknowledged = false;
CREATE INDEX idx_te_proxy_created    ON timesheet_entries(created_at)             WHERE is_proxy_entry = true;

-- ============================================================
-- RLS UPDATES
-- ============================================================

-- 1. Let managers/admins INSERT proxy entries for any employee in org
CREATE POLICY "manager_inserts_proxy_entries"
  ON timesheet_entries FOR INSERT
  WITH CHECK (
    org_id = auth_org_id()
    AND is_proxy_entry = true
    AND proxy_actor_id = auth.uid()
    AND proxy_reason IS NOT NULL
    AND length(trim(proxy_reason)) >= 50
    AND auth_user_role() IN ('manager', 'admin')
  );

-- 2. Update delete policy: employees cannot delete proxy entries
DROP POLICY IF EXISTS "employee_deletes_own_entries" ON timesheet_entries;

CREATE POLICY "employee_deletes_own_entries"
  ON timesheet_entries FOR DELETE
  USING (
    org_id = auth_org_id()
    AND user_id = auth.uid()
    AND is_proxy_entry = false
    AND EXISTS (
      SELECT 1 FROM timesheets t
      WHERE t.id = timesheet_id
      AND t.certified_by_employee = false
      AND t.status IN ('draft', 'rejected')
    )
  );

-- 3. Let employees acknowledge their own proxy entries (flip false → true only)
CREATE POLICY "employee_acknowledges_proxy_entries"
  ON timesheet_entries FOR UPDATE
  USING (
    org_id = auth_org_id()
    AND user_id = auth.uid()
    AND is_proxy_entry = true
    AND employee_acknowledged = false
  )
  WITH CHECK (
    employee_acknowledged = true
    AND employee_acknowledged_at IS NOT NULL
  );

-- ============================================================
-- Extend anomaly_type enum
-- ============================================================

ALTER TYPE anomaly_type ADD VALUE IF NOT EXISTS 'proxy_entry_unacknowledged';
