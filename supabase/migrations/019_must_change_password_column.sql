-- ============================================================
-- Migration 019 — must_change_password as a server-authoritative column
-- ============================================================
-- The forced-password-change flag lived in auth user_metadata, which the user
-- can edit themselves (updateUser({ data: ... })) — so a temp-password user
-- could clear it and keep the admin-issued temp password. Move it to a users
-- column. UPDATE on users is already revoked from `authenticated` (migration
-- 017), so only server (service role) can clear it.
-- Additive — apply BEFORE the code that reads it deploys.
-- ============================================================

ALTER TABLE users
  ADD COLUMN must_change_password boolean NOT NULL DEFAULT false;
