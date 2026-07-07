-- ============================================================
-- Migration 009: Policy Versions Table
-- Stores every generated timekeeping policy PDF.
-- Admin generates a new version → all employees must re-acknowledge.
-- ============================================================

CREATE TABLE policy_versions (
  id            uuid        PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id        uuid        NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
  version       text        NOT NULL,
  policy_text   text        NOT NULL,
  storage_path  text        NOT NULL DEFAULT '',
  effective_date date       NOT NULL DEFAULT CURRENT_DATE,
  created_by    uuid        NOT NULL REFERENCES users(id)  ON DELETE RESTRICT,
  created_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (org_id, version)
);

CREATE INDEX idx_policy_versions_org_id    ON policy_versions(org_id);
CREATE INDEX idx_policy_versions_created   ON policy_versions(created_at);

ALTER TABLE policy_versions ENABLE ROW LEVEL SECURITY;

-- Admin and finance can read version history
CREATE POLICY "admin_finance_read_policy_versions"
  ON policy_versions FOR SELECT
  USING (
    org_id = auth_org_id()
    AND auth_user_role() IN ('admin', 'finance')
  );

-- Admin can insert new versions (enforced by API; service client used in practice)
CREATE POLICY "admin_insert_policy_versions"
  ON policy_versions FOR INSERT
  WITH CHECK (
    org_id = auth_org_id()
    AND auth_user_role() = 'admin'
  );

-- No UPDATE or DELETE — versions are immutable once published

-- ============================================================
-- Supabase Storage bucket for policy PDFs
-- ============================================================

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('policy-documents', 'policy-documents', false, 10485760, ARRAY['application/pdf'])
ON CONFLICT (id) DO NOTHING;

-- Service role (used by API routes) can upload
CREATE POLICY "service_upload_policy_docs"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'policy-documents');

-- Authenticated users in the org can read (signed URLs used in practice)
CREATE POLICY "authenticated_read_policy_docs"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'policy-documents' AND auth.role() = 'authenticated');

-- ============================================================
-- Backfill: insert initial version record for existing orgs
-- ============================================================

INSERT INTO policy_versions (org_id, version, policy_text, storage_path, effective_date, created_by, created_at)
SELECT
  o.id,
  o.policy_version,
  o.policy_text,
  '',   -- no PDF was generated for the initial version
  CURRENT_DATE,
  u.id, -- first admin in the org
  now()
FROM organizations o
JOIN users u ON u.org_id = o.id AND u.role = 'admin'
WHERE o.policy_text != ''
ON CONFLICT (org_id, version) DO NOTHING;
