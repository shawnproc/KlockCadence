-- ============================================================
-- Migration 015 — Allow audited anomaly deletion + stop duplicates
-- ============================================================
-- The original design blocked ALL deletes on `anomalies` (migration 003).
-- In practice that meant detector bugs (e.g. the per-row certified-edit
-- trigger firing once per entry on a bulk update) produced piles of
-- identical CRITICAL anomalies that could never be cleaned up.
--
-- DCAA integrity does NOT require anomalies themselves to be undeletable —
-- it requires that nothing happens without a trace. The immutable record is
-- `audit_log`. So: allow admins to delete anomalies, but the app records
-- every deletion in `audit_log` (ANOMALY_DELETED). audit_log stays fully
-- immutable (migration 003 triggers unchanged).
-- ============================================================

-- 1. Remove the hard DELETE block.
DROP TRIGGER IF EXISTS no_delete_anomalies ON anomalies;
DROP FUNCTION IF EXISTS block_anomaly_deletes();

-- 2. Admins may delete anomalies within their org (defense in depth; the API
--    also gates on role and logs the deletion). Reads/inserts/resolve
--    policies from migration 002 are unchanged.
CREATE POLICY "admin_can_delete_anomalies" ON anomalies
  FOR DELETE TO authenticated
  USING (
    org_id = auth_org_id()
    AND auth_user_role() = 'admin'
  );

-- 3. Stop the flood at the source: only flag a certified-timesheet edit once.
--    Previously this inserted a fresh CRITICAL anomaly on EVERY row-level
--    update of an entry on a certified timesheet. Now it skips if an
--    unresolved anomaly already exists for that same timesheet.
CREATE OR REPLACE FUNCTION detect_certified_modification()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_description text;
BEGIN
  IF EXISTS (
    SELECT 1 FROM timesheets
    WHERE id = new.timesheet_id
      AND certified_by_employee = true
  ) THEN
    v_description := format('Timesheet entry modified after certification. Timesheet ID: %s', new.timesheet_id);

    -- De-dupe: one open anomaly per certified timesheet, not one per entry/edit.
    IF NOT EXISTS (
      SELECT 1 FROM anomalies
      WHERE org_id = new.org_id
        AND anomaly_type = 'timesheet_modified_after_certification'
        AND resolved = false
        AND description = v_description
    ) THEN
      INSERT INTO anomalies (org_id, user_id, anomaly_type, severity, description)
      VALUES (new.org_id, new.user_id, 'timesheet_modified_after_certification', 'critical', v_description);
    END IF;
  END IF;

  RETURN new;
END;
$$;
