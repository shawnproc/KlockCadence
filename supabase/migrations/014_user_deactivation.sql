-- ============================================================
-- Migration 014 — User deactivation (offboarding)
-- ============================================================
-- Employees who leave (fired/quit) must be removed from active use, but
-- their records CANNOT be deleted — timesheets, certifications, anomalies,
-- and the immutable audit_log are federal contract records subject to DCAA
-- retention. (User FKs are ON DELETE RESTRICT precisely to prevent this.)
--
-- Deactivation is soft: the person can no longer sign in and disappears
-- from every active roster/selector, while all historical records remain
-- intact and attributable to their real name for audit.
-- ============================================================

ALTER TABLE users
  ADD COLUMN is_active      boolean     NOT NULL DEFAULT true,
  ADD COLUMN deactivated_at timestamptz,
  ADD COLUMN deactivated_by uuid REFERENCES users(id) ON DELETE SET NULL;

-- Fast filtering of active vs. offboarded users within an org.
CREATE INDEX idx_users_org_active ON users(org_id, is_active);

COMMENT ON COLUMN users.is_active IS
  'False = offboarded/terminated. Login is banned and the user is hidden from active rosters, but all historical records are retained for DCAA audit.';
