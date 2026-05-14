-- Deep-audit schema. Intentionally minimal; the parent platform's
-- Supabase `gdpr_audits` table remains the system of record for quick
-- scans. This table holds the long-running Playwright results.

CREATE TABLE IF NOT EXISTS deep_audits (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  url             TEXT NOT NULL,
  domain          TEXT,
  tenant_id       UUID,
  email           TEXT,
  status          TEXT NOT NULL DEFAULT 'queued',  -- queued | running | completed | failed
  score           SMALLINT,
  severity        TEXT,
  findings        JSONB,
  cookies         JSONB,
  requests        JSONB,
  consent         JSONB,
  screenshot_path TEXT,
  fetched_at      TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at    TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS deep_audits_tenant_idx ON deep_audits (tenant_id);
CREATE INDEX IF NOT EXISTS deep_audits_url_idx    ON deep_audits (url);
CREATE INDEX IF NOT EXISTS deep_audits_status_idx ON deep_audits (status);

-- Per-finding row for fast queries ("show me every Meta-Pixel finding
-- across the portfolio"). The full payload stays in deep_audits.findings.
CREATE TABLE IF NOT EXISTS deep_findings (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  audit_id    UUID NOT NULL REFERENCES deep_audits(id) ON DELETE CASCADE,
  finding_id  TEXT NOT NULL,
  severity    TEXT NOT NULL,
  issue       TEXT NOT NULL,
  detail      TEXT,
  paragraph_ref TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS deep_findings_audit_idx    ON deep_findings (audit_id);
CREATE INDEX IF NOT EXISTS deep_findings_finding_idx  ON deep_findings (finding_id);
