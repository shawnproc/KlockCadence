-- ============================================================
-- Migration 017 — Access-control hardening (P0 security)
-- ============================================================
-- Apply AFTER the corresponding code deploys — every change here is
-- code-first-safe (the app already avoids the removed behaviors).
-- Addresses: self-service admin escalation, cross-tenant RPC leak,
-- admin-password-hash exposure, and client-forged audit/anomaly records.
-- ============================================================

-- 1. Privilege/tenant escalation via the users table.
--    The self-update policy had no WITH CHECK / column limit, letting an
--    employee set their own role to 'admin' from the browser. Remove the
--    ability for authenticated clients to UPDATE users at all; every
--    legitimate change (role, is_active, profile) now goes through
--    service-role server routes (which bypass this REVOKE).
DROP POLICY IF EXISTS "users_can_update_own_profile" ON users;
REVOKE UPDATE ON users FROM authenticated;

-- 2. Cross-tenant payroll exfiltration. Both labor-distribution RPCs are
--    SECURITY DEFINER and trust a caller-supplied org_id, and were granted to
--    all authenticated users — any user could pull another org's data by
--    calling the RPC directly. Revoke direct execution; the report route calls
--    them as service_role after enforcing admin/finance role + own org.
REVOKE EXECUTE ON FUNCTION get_labor_distribution(uuid, date) FROM authenticated, public;
REVOKE EXECUTE ON FUNCTION get_labor_distribution_weekly(uuid, date) FROM authenticated, public;

-- 3. Remove the shared admin-password model entirely (replaced by audited,
--    admin-initiated role changes via /api/admin/users/[id]/role). Dropping the
--    column also removes the hash that was RLS-readable by any org member.
ALTER TABLE organizations DROP COLUMN IF EXISTS admin_password_hash;

-- 4. audit_log and anomalies must be written only by the service role (server)
--    or the SECURITY DEFINER detection triggers — never forged by an
--    authenticated client. The app writes these via the service client, so
--    removing the permissive authenticated INSERT policies changes nothing for
--    legitimate writes while closing the forgery hole.
DROP POLICY IF EXISTS "service_can_insert_audit_log" ON audit_log;
DROP POLICY IF EXISTS "service_can_insert_anomalies" ON anomalies;
