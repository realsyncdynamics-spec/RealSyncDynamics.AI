-- ============================================================
-- Governance Telemetry Ingestion Keys
-- ============================================================
-- Tenant-scoped API keys for the /functions/v1/governance-ingest
-- endpoint. Mirrors the pattern used by tenant_invites: only the
-- sha256 hash is stored; the raw `rsd_gov_…` token leaves the
-- system exactly once (at creation time) and must be persisted
-- by the caller.
--
-- allowed_sources optionally pins a key to a subset of event_source
-- values (`browser_extension`, `sdk`, …). An empty array means
-- "any event source".

CREATE TABLE IF NOT EXISTS public.governance_ingest_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID,
  name TEXT NOT NULL,
  key_hash TEXT NOT NULL UNIQUE,
  key_prefix TEXT NOT NULL,
  allowed_sources TEXT[] NOT NULL DEFAULT '{}',
  rate_limit_per_minute INT NOT NULL DEFAULT 60
    CHECK (rate_limit_per_minute > 0 AND rate_limit_per_minute <= 10000),
  created_by UUID,
  last_used_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_governance_ingest_keys_tenant
  ON public.governance_ingest_keys(tenant_id);

CREATE INDEX IF NOT EXISTS idx_governance_ingest_keys_active
  ON public.governance_ingest_keys(tenant_id)
  WHERE revoked_at IS NULL;

ALTER TABLE public.governance_ingest_keys ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "governance_ingest_keys_service_all" ON public.governance_ingest_keys;
CREATE POLICY "governance_ingest_keys_service_all"
ON public.governance_ingest_keys
FOR ALL TO service_role
USING (true)
WITH CHECK (true);
