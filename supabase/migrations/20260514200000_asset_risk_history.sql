-- ============================================================
-- Asset Risk Score History
-- ============================================================
-- Each call to governance-risk-score persists the resulting
-- score alongside the previous one, the delta (generated column),
-- a human-readable reason and the contributing event IDs.

CREATE TABLE IF NOT EXISTS public.asset_risk_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id UUID NOT NULL REFERENCES public.governance_assets(id) ON DELETE CASCADE,
  tenant_id UUID,
  risk_score INT NOT NULL CHECK (risk_score >= 0 AND risk_score <= 100),
  previous_score INT,
  score_delta INT GENERATED ALWAYS AS (risk_score - COALESCE(previous_score, 0)) STORED,
  reason TEXT,
  contributing_events JSONB DEFAULT '[]',
  calculated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_asset_risk_history_asset
  ON public.asset_risk_history(asset_id, calculated_at DESC);

CREATE INDEX IF NOT EXISTS idx_asset_risk_history_tenant
  ON public.asset_risk_history(tenant_id);

ALTER TABLE public.asset_risk_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "asset_risk_history_service_all"
ON public.asset_risk_history
FOR ALL TO service_role
USING (true) WITH CHECK (true);

CREATE POLICY "asset_risk_history_tenant_read"
ON public.asset_risk_history
FOR SELECT TO authenticated
USING (
  tenant_id IN (SELECT tenant_id FROM public.memberships WHERE user_id = auth.uid())
);
