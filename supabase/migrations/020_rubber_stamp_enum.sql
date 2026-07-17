-- ============================================================
-- Migration 020 — add 'rubber_stamp' anomaly type
-- ============================================================
-- Rubber-stamp detection was mislabeled as 'timesheet_modified_after_certification'.
-- Add a dedicated enum value. MUST run/commit before migration 021 (which uses
-- it) — Postgres forbids using a new enum value in the same transaction that
-- added it, so run this migration on its own.
-- ============================================================

ALTER TYPE anomaly_type ADD VALUE IF NOT EXISTS 'rubber_stamp';
