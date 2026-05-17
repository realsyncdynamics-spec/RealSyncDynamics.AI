-- ── Evidence Records ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS evidence_records (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID NOT NULL,
  type          TEXT NOT NULL,  -- invoice | ocr_result | agent_decision | dsgvo_find | tax_document | inventory_change
  source        TEXT NOT NULL,  -- which service/agent created this
  subject       TEXT NOT NULL,  -- original NATS subject
  content_hash  TEXT NOT NULL,  -- SHA-256 of original payload
  payload       JSONB NOT NULL,
  file_path     TEXT,           -- optional file reference
  tags          TEXT[] NOT NULL DEFAULT '{}',
  immutable     BOOLEAN NOT NULL DEFAULT true,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
  -- No updated_at — evidence is immutable
);
CREATE INDEX IF NOT EXISTS idx_evidence_tenant ON evidence_records(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_evidence_type ON evidence_records(tenant_id, type);
CREATE INDEX IF NOT EXISTS idx_evidence_hash ON evidence_records(content_hash);

-- ── Export Requests ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS export_requests (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID NOT NULL,
  requested_by  TEXT,
  type          TEXT NOT NULL,  -- dsgvo | tax | audit | full
  status        TEXT NOT NULL DEFAULT 'pending', -- pending | processing | ready | expired | failed
  filter        JSONB NOT NULL DEFAULT '{}',
  record_count  INTEGER,
  file_path     TEXT,
  expires_at    TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at  TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_exports_tenant ON export_requests(tenant_id, created_at DESC);

-- ── Immutable Audit Stream ───────────────────────────────────
CREATE TABLE IF NOT EXISTS audit_stream (
  seq           BIGSERIAL PRIMARY KEY,  -- monotonic, never gaps
  tenant_id     UUID,
  event_type    TEXT NOT NULL,
  subject       TEXT NOT NULL,
  content_hash  TEXT NOT NULL,
  payload       JSONB NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
-- Append-only: no UPDATE/DELETE ever on this table
CREATE INDEX IF NOT EXISTS idx_audit_stream_tenant ON audit_stream(tenant_id, seq DESC);
