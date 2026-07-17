-- ============================================================
-- Migration 018 — Atomic leave-balance deduction
-- ============================================================
-- The leave route read the balance, checked it in JS, then wrote an absolute
-- used_hours value — a read-modify-write race that let concurrent requests
-- over-spend / lose updates. This RPC does the check-and-deduct in one atomic
-- UPDATE: it only deducts when the balance still covers the request, and
-- reports whether it succeeded. Called only as service_role from the server
-- route (after the auth check).
-- ============================================================

CREATE OR REPLACE FUNCTION deduct_leave_balance(
  p_org_id     uuid,
  p_user_id    uuid,
  p_leave_type leave_type,
  p_hours      numeric
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_updated integer;
BEGIN
  UPDATE leave_balances
  SET used_hours = used_hours + p_hours
  WHERE org_id = p_org_id
    AND user_id = p_user_id
    AND leave_type = p_leave_type
    AND (accrued_hours - used_hours - pending_hours) >= p_hours;

  GET DIAGNOSTICS v_updated = ROW_COUNT;
  RETURN v_updated > 0;
END;
$$;

REVOKE EXECUTE ON FUNCTION deduct_leave_balance(uuid, uuid, leave_type, numeric) FROM authenticated, public;
GRANT EXECUTE ON FUNCTION deduct_leave_balance(uuid, uuid, leave_type, numeric) TO service_role;
