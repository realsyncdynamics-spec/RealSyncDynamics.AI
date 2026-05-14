-- Cost & Token Tracking (PR #160).
-- token_usage: per-request granularity. token_usage_monthly view: aggregation
-- pro (tenant, asset, vendor, model, environment, month) für Cost-Dashboards.

CREATE TABLE IF NOT EXISTS public.token_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID,
  asset_id UUID REFERENCES public.governance_assets(id) ON DELETE SET NULL,
  event_id UUID REFERENCES public.governance_events(id) ON DELETE SET NULL,
  environment TEXT NOT NULL DEFAULT 'production',
  vendor TEXT NOT NULL,
  model_name TEXT NOT NULL,
  prompt_tokens INT NOT NULL DEFAULT 0,
  completion_tokens INT NOT NULL DEFAULT 0,
  total_tokens INT GENERATED ALWAYS AS (prompt_tokens + completion_tokens) STORED,
  cost_usd NUMERIC(10,6),
  cost_eur NUMERIC(10,6),
  request_type TEXT CHECK (request_type IN ('chat','completion','embedding','image','audio','other')) DEFAULT 'chat',
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  metadata JSONB DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS idx_token_usage_tenant ON public.token_usage(tenant_id, recorded_at DESC);
CREATE INDEX IF NOT EXISTS idx_token_usage_asset ON public.token_usage(asset_id, recorded_at DESC);
CREATE INDEX IF NOT EXISTS idx_token_usage_vendor ON public.token_usage(vendor, recorded_at DESC);

ALTER TABLE public.token_usage ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "token_usage_service_all" ON public.token_usage;
CREATE POLICY "token_usage_service_all" ON public.token_usage FOR ALL TO service_role USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "token_usage_tenant_read" ON public.token_usage;
CREATE POLICY "token_usage_tenant_read" ON public.token_usage FOR SELECT TO authenticated
USING (tenant_id IN (SELECT tenant_id FROM public.memberships WHERE user_id = auth.uid()));

CREATE OR REPLACE VIEW public.token_usage_monthly AS
SELECT tenant_id, asset_id, vendor, model_name, environment,
  DATE_TRUNC('month', recorded_at) AS month,
  SUM(prompt_tokens) AS total_prompt_tokens,
  SUM(completion_tokens) AS total_completion_tokens,
  SUM(total_tokens) AS total_tokens,
  SUM(cost_usd) AS total_cost_usd,
  SUM(cost_eur) AS total_cost_eur,
  COUNT(*) AS request_count
FROM public.token_usage
GROUP BY tenant_id, asset_id, vendor, model_name, environment, DATE_TRUNC('month', recorded_at);

GRANT SELECT ON public.token_usage_monthly TO authenticated;
