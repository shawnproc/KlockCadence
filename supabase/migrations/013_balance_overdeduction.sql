-- ============================================================
-- Migration 013 — Catch leave-balance OVER-deductions
-- ============================================================
-- Tightens detect_unauthorized_balance_edit() (migration 003).
--
-- The original trigger only flagged a balance change when there was NO
-- recently approved leave request at all (v_approved_hours = 0). That
-- missed the more common abuse: an employee is approved for N hours but
-- MORE than N hours are removed from the balance (e.g. approved for 8h,
-- but 16h deducted). The 8h difference is unauthorized yet went undetected
-- because *some* approval existed.
--
-- This version compares the hours actually consumed from the balance
-- (increase in used_hours + any decrease in accrued_hours) against the
-- hours covered by recently approved requests, and flags the unaccounted
-- difference. It is a strict superset of the old behavior: when no
-- approval exists, v_approved_hours = 0 and the full consumed amount is
-- flagged, exactly as before.
--
-- The trigger (detect_unauthorized_balance_edit_trigger) is unchanged; we
-- only replace the function body.
-- ============================================================

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
  -- Only evaluate when used_hours or accrued_hours actually changed.
  IF old.used_hours <> new.used_hours OR old.accrued_hours <> new.accrued_hours THEN
    -- Hours removed from the employee's available balance:
    --   an increase in used_hours, plus any clawback of accrued_hours.
    -- Legitimate accruals (accrued_hours increasing) make this negative → ignored.
    v_consumed := (new.used_hours - old.used_hours) + (old.accrued_hours - new.accrued_hours);

    IF v_consumed > 0 THEN
      -- Hours justified by a recently approved leave request.
      SELECT coalesce(sum(requested_hours), 0) INTO v_approved_hours
      FROM leave_requests
      WHERE user_id = new.user_id
        AND org_id = new.org_id
        AND leave_type = new.leave_type
        AND status = 'approved'
        AND reviewed_at > now() - interval '5 minutes';

      v_unaccounted := v_consumed - v_approved_hours;

      -- Any reduction beyond what was approved is unauthorized.
      IF v_unaccounted > 0 THEN
        INSERT INTO anomalies (org_id, user_id, anomaly_type, severity, description)
        VALUES (
          new.org_id,
          new.user_id,
          'unauthorized_balance_edit',
          'critical',
          format(
            'Leave balance reduced by %sh but only %sh approved. Unauthorized reduction of %sh. Type: %s. Actor: %s',
            v_consumed, v_approved_hours, v_unaccounted, new.leave_type, auth.uid()
          )
        );
      END IF;
    END IF;
  END IF;

  RETURN new;
END;
$$;
