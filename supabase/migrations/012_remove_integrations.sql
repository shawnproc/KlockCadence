-- ============================================================
-- Migration 012 — Remove Integration Framework
-- ============================================================
-- Reverses migration 010. The payroll/accounting integration feature
-- (QuickBooks, Gusto, ADP, Xero, Sage Intacct, Deltek) has been removed
-- from the product entirely. This drops the four integration tables and
-- their supporting objects.
--
-- Notes:
--   * Indexes, triggers, and RLS policies are dropped automatically with
--     their owning tables.
--   * touch_updated_at() was introduced in 010 and is used ONLY by the
--     integration tables, so it is safe to drop here.
--   * audit_log rows referencing integration actions are preserved
--     (audit_log is immutable and never touched).
--   * No custom enum types were created by 010 (it used text + CHECK
--     constraints), so there are no types to drop.
-- ============================================================

DROP TABLE IF EXISTS integration_sync_events;
DROP TABLE IF EXISTS integration_code_mappings;
DROP TABLE IF EXISTS integration_mappings;
DROP TABLE IF EXISTS integrations;

DROP FUNCTION IF EXISTS touch_updated_at();
