-- ============================================================
-- Migration 021 — trigger fixes + storage policy hardening
-- ============================================================
-- Run AFTER migration 020 (uses the 'rubber_stamp' enum value).
-- ============================================================

-- 1. Rubber-stamp anomalies now use their own type instead of being mislabeled
--    as 'timesheet_modified_after_certification'.
CREATE OR REPLACE FUNCTION detect_rubber_stamp()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_recent_approvals integer;
BEGIN
  IF new.status = 'approved' AND old.status <> 'approved' THEN
    SELECT count(*) INTO v_recent_approvals
    FROM timesheets
    WHERE approved_by = new.approved_by
      AND approved_at > now() - interval '2 minutes'
      AND status = 'approved';

    IF v_recent_approvals >= 5 THEN
      INSERT INTO anomalies (org_id, user_id, anomaly_type, severity, description)
      VALUES (
        new.org_id,
        new.approved_by,
        'rubber_stamp',
        'medium',
        format('Rubber-stamp pattern: manager approved %s timesheets in under 2 minutes.', v_recent_approvals)
      );
    END IF;
  END IF;
  RETURN new;
END;
$$;

-- 2. Balance-edit anomaly no longer embeds auth.uid() (always NULL under the
--    service role) — points to the audit log for attribution instead.
CREATE OR REPLACE FUNCTION detect_unauthorized_balance_edit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_approved_hours numeric;
  v_consumed       numeric;
  v_unaccounted    numeric;
BEGIN
  IF old.used_hours <> new.used_hours OR old.accrued_hours <> new.accrued_hours THEN
    v_consumed := (new.used_hours - old.used_hours) + (old.accrued_hours - new.accrued_hours);

    IF v_consumed > 0 THEN
      SELECT coalesce(sum(requested_hours), 0) INTO v_approved_hours
      FROM leave_requests
      WHERE user_id = new.user_id
        AND org_id = new.org_id
        AND leave_type = new.leave_type
        AND status = 'approved'
        AND reviewed_at > now() - interval '5 minutes';

      v_unaccounted := v_consumed - v_approved_hours;

      IF v_unaccounted > 0 THEN
        INSERT INTO anomalies (org_id, user_id, anomaly_type, severity, description)
        VALUES (
          new.org_id,
          new.user_id,
          'unauthorized_balance_edit',
          'critical',
          format(
            'Leave balance reduced by %sh but only %sh approved. Unauthorized reduction of %sh (type: %s). See the audit log for the acting user.',
            v_consumed, v_approved_hours, v_unaccounted, new.leave_type
          )
        );
      END IF;
    END IF;
  END IF;

  RETURN new;
END;
$$;

-- 3. Storage: policy PDFs are served via service-role signed URLs, so the
--    permissive authenticated read/upload policies (not org-scoped) are an
--    unnecessary cross-org exposure. Remove them; service role bypasses RLS.
DROP POLICY IF EXISTS "authenticated_read_policy_docs" ON storage.objects;
DROP POLICY IF EXISTS "service_upload_policy_docs" ON storage.objects;
