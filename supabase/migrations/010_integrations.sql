-- ============================================================
-- Migration 010 — Integration Framework
-- ============================================================

-- ── Tables ───────────────────────────────────────────────────

-- Main connection table: one row per org per integration type.
-- Tokens stored as AES-256-GCM encrypted strings (app-layer encryption).
-- Client code MUST NEVER select access_token_enc or refresh_token_enc.
CREATE TABLE integrations (
  id                    uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id                uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  integration_type      text NOT NULL CHECK (
    integration_type IN ('quickbooks', 'gusto', 'adp', 'xero', 'sage_intacct', 'deltek')
  ),
  status                text NOT NULL DEFAULT 'disconnected'
                        CHECK (status IN ('connected', 'disconnected', 'error')),
  access_token_enc      text,
  refresh_token_enc     text,
  token_expires_at      timestamptz,
  -- Provider-specific account identifier (QBO realm ID, Gusto company UUID, Xero tenant ID)
  realm_id              text,
  last_sync_at          timestamptz,
  last_sync_status      text CHECK (last_sync_status IN ('success', 'error', 'partial')),
  last_error_message    text,
  sync_frequency        text NOT NULL DEFAULT 'manual'
                        CHECK (sync_frequency IN ('realtime', 'daily', 'manual')),
  error_notify_user_id  uuid REFERENCES users(id) ON DELETE SET NULL,
  config                jsonb NOT NULL DEFAULT '{}',
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now(),
  UNIQUE (org_id, integration_type)
);

-- Employee mappings: KlockCadence user → external system employee ID
CREATE TABLE integration_mappings (
  id                uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id            uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  integration_type  text NOT NULL CHECK (
    integration_type IN ('quickbooks', 'gusto', 'adp', 'xero', 'sage_intacct', 'deltek')
  ),
  kc_user_id        uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  external_id       text NOT NULL,
  external_name     text,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  UNIQUE (org_id, integration_type, kc_user_id)
);

-- Charge code mappings: KC charge code → GL account / service item / project code
CREATE TABLE integration_code_mappings (
  id                uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id            uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  integration_type  text NOT NULL CHECK (
    integration_type IN ('quickbooks', 'gusto', 'adp', 'xero', 'sage_intacct', 'deltek')
  ),
  charge_code_id    uuid NOT NULL REFERENCES charge_codes(id) ON DELETE CASCADE,
  external_code     text NOT NULL,
  external_name     text,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  UNIQUE (org_id, integration_type, charge_code_id)
);

-- Sync event history — INSERT ONLY, never deletable (DCAA audit trail)
CREATE TABLE integration_sync_events (
  id                uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id            uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  integration_type  text NOT NULL,
  triggered_by      uuid REFERENCES users(id) ON DELETE SET NULL,
  status            text NOT NULL CHECK (status IN ('success', 'error', 'partial')),
  records_synced    integer NOT NULL DEFAULT 0,
  error_message     text,
  details           jsonb,
  created_at        timestamptz NOT NULL DEFAULT now()
);

-- ── Indexes ──────────────────────────────────────────────────

CREATE INDEX idx_integrations_org ON integrations(org_id);
CREATE INDEX idx_integrations_org_type ON integrations(org_id, integration_type);
CREATE INDEX idx_integration_mappings_org_type ON integration_mappings(org_id, integration_type);
CREATE INDEX idx_integration_mappings_user ON integration_mappings(kc_user_id);
CREATE INDEX idx_integration_code_mappings_org_type ON integration_code_mappings(org_id, integration_type);
CREATE INDEX idx_integration_sync_events_org_type ON integration_sync_events(org_id, integration_type);
CREATE INDEX idx_integration_sync_events_created ON integration_sync_events(created_at DESC);

-- ── updated_at trigger ────────────────────────────────────────

CREATE OR REPLACE FUNCTION touch_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_integrations_updated_at
  BEFORE UPDATE ON integrations
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

CREATE TRIGGER trg_integration_mappings_updated_at
  BEFORE UPDATE ON integration_mappings
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

CREATE TRIGGER trg_integration_code_mappings_updated_at
  BEFORE UPDATE ON integration_code_mappings
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

-- ── RLS ──────────────────────────────────────────────────────

ALTER TABLE integrations             ENABLE ROW LEVEL SECURITY;
ALTER TABLE integration_mappings     ENABLE ROW LEVEL SECURITY;
ALTER TABLE integration_code_mappings ENABLE ROW LEVEL SECURITY;
ALTER TABLE integration_sync_events  ENABLE ROW LEVEL SECURITY;

-- integrations: admin SELECT only (tokens never exposed — always use service_role for token ops)
CREATE POLICY "admin_reads_integrations" ON integrations
  FOR SELECT TO authenticated
  USING (
    org_id = (SELECT org_id FROM users WHERE id = auth.uid())
    AND (SELECT role FROM users WHERE id = auth.uid()) = 'admin'
  );
-- INSERT / UPDATE / DELETE only via service_role (API routes)

-- integration_mappings: admin CRUD
CREATE POLICY "admin_reads_integration_mappings" ON integration_mappings
  FOR SELECT TO authenticated
  USING (
    org_id = (SELECT org_id FROM users WHERE id = auth.uid())
    AND (SELECT role FROM users WHERE id = auth.uid()) = 'admin'
  );

CREATE POLICY "admin_inserts_integration_mappings" ON integration_mappings
  FOR INSERT TO authenticated
  WITH CHECK (
    org_id = (SELECT org_id FROM users WHERE id = auth.uid())
    AND (SELECT role FROM users WHERE id = auth.uid()) = 'admin'
  );

CREATE POLICY "admin_updates_integration_mappings" ON integration_mappings
  FOR UPDATE TO authenticated
  USING (
    org_id = (SELECT org_id FROM users WHERE id = auth.uid())
    AND (SELECT role FROM users WHERE id = auth.uid()) = 'admin'
  );

CREATE POLICY "admin_deletes_integration_mappings" ON integration_mappings
  FOR DELETE TO authenticated
  USING (
    org_id = (SELECT org_id FROM users WHERE id = auth.uid())
    AND (SELECT role FROM users WHERE id = auth.uid()) = 'admin'
  );

-- integration_code_mappings: admin CRUD
CREATE POLICY "admin_reads_integration_code_mappings" ON integration_code_mappings
  FOR SELECT TO authenticated
  USING (
    org_id = (SELECT org_id FROM users WHERE id = auth.uid())
    AND (SELECT role FROM users WHERE id = auth.uid()) = 'admin'
  );

CREATE POLICY "admin_inserts_integration_code_mappings" ON integration_code_mappings
  FOR INSERT TO authenticated
  WITH CHECK (
    org_id = (SELECT org_id FROM users WHERE id = auth.uid())
    AND (SELECT role FROM users WHERE id = auth.uid()) = 'admin'
  );

CREATE POLICY "admin_updates_integration_code_mappings" ON integration_code_mappings
  FOR UPDATE TO authenticated
  USING (
    org_id = (SELECT org_id FROM users WHERE id = auth.uid())
    AND (SELECT role FROM users WHERE id = auth.uid()) = 'admin'
  );

CREATE POLICY "admin_deletes_integration_code_mappings" ON integration_code_mappings
  FOR DELETE TO authenticated
  USING (
    org_id = (SELECT org_id FROM users WHERE id = auth.uid())
    AND (SELECT role FROM users WHERE id = auth.uid()) = 'admin'
  );

-- integration_sync_events: admin/finance SELECT only. No client inserts (service_role only).
CREATE POLICY "admin_finance_reads_sync_events" ON integration_sync_events
  FOR SELECT TO authenticated
  USING (
    org_id = (SELECT org_id FROM users WHERE id = auth.uid())
    AND (SELECT role FROM users WHERE id = auth.uid()) IN ('admin', 'finance')
  );
