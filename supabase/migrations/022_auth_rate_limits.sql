-- ============================================================
-- Migration 022 — auth rate-limit ledger
-- ============================================================
-- Backs the sliding-window rate limiter on the public auth endpoints
-- (/api/auth/join, /api/auth/signup) to throttle account-creation spam and
-- company-code guessing. Written/read only by the service role (server);
-- RLS is enabled with no policies so no client can touch it.
-- Additive + the limiter fails open, so ordering vs. code is not critical.
-- ============================================================

CREATE TABLE auth_rate_limits (
  id         uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  ip         text NOT NULL,
  action     text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_auth_rate_limits_lookup ON auth_rate_limits(action, ip, created_at);

ALTER TABLE auth_rate_limits ENABLE ROW LEVEL SECURITY;
-- No policies: only service_role (which bypasses RLS) may read/write.
