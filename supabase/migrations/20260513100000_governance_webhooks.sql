-- ============================================================
-- Governance Outbound Webhooks
-- ============================================================
-- Tenant-scoped Slack / Teams / generic HTTP webhooks that get
-- fired by governance-ingest when a matched event's risk_level
-- meets or exceeds `min_risk_level`. Same hash-only secret
-- pattern as ingest keys: only sha256 is stored, the raw
-- HMAC secret leaves the system exactly once at creation.

CREATE TABLE IF NOT EXISTS public.governance_webhooks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID,
  name TEXT NOT NULL,
  target_url TEXT NOT NULL,
  secret_hash TEXT NOT NULL,
  secret_prefix TEXT NOT NULL,
  min_risk_level TEXT NOT NULL DEFAULT 'high' CHECK (
    min_risk_level IN ('info','low','medium','high','critical')
  ),
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  last_called_at TIMESTAMPTZ,
  last_status INT,
  last_error TEXT,
  created_by UUID,
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_governance_webhooks_tenant
  ON public.governance_webhooks(tenant_id);

CREATE INDEX IF NOT EXISTS idx_governance_webhooks_active
  ON public.governance_webhooks(tenant_id)
  WHERE revoked_at IS NULL AND enabled = TRUE;

ALTER TABLE public.governance_webhooks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "governance_webhooks_service_all"
ON public.governance_webhooks
FOR ALL TO service_role
USING (true)
WITH CHECK (true);

CREATE POLICY "governance_webhooks_tenant_read"
ON public.governance_webhooks
FOR SELECT TO authenticated
USING (
  tenant_id IN (
    SELECT tenant_id FROM public.memberships WHERE user_id = auth.uid()
  )
);
