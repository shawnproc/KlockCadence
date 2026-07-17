-- ============================================================
-- Migration 016 — Company code + admin password (signup gating)
-- ============================================================
-- Signup previously made everyone an admin of a brand-new org. Instead,
-- people sign up by joining an existing company via its code, and only those
-- who also enter the company's admin password become admins; everyone else
-- joins as a regular employee.
--
--   company_code        — shareable identifier employees use to join the org
--   admin_password_hash — salted scrypt hash; entering the matching password
--                         at signup grants the admin role (never sent to client)
-- ============================================================

ALTER TABLE organizations
  ADD COLUMN company_code        text,
  ADD COLUMN admin_password_hash text;

-- Backfill existing orgs with a unique code so employees can already join them.
UPDATE organizations
SET company_code = upper(substr(md5(id::text || clock_timestamp()::text), 1, 8))
WHERE company_code IS NULL;

ALTER TABLE organizations ALTER COLUMN company_code SET NOT NULL;
CREATE UNIQUE INDEX idx_organizations_company_code ON organizations(company_code);

COMMENT ON COLUMN organizations.admin_password_hash IS
  'Salted scrypt hash of the company admin password. Never expose to the client. Null = no admin self-signup until an admin sets it in Org Settings.';
