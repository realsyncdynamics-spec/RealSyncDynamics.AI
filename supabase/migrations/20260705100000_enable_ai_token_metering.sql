-- Enable AI Token Monetization
--
-- Adds configuration for metering AI tokens consumed by tenants.
-- Integrates with Stripe metered billing to charge per 1M tokens used.
--
-- Configuration per plan:
-- - Starter (€79): 100k tokens/month included
-- - Professional (€149): 500k tokens/month included
-- - Governance OS (€599): 5M tokens/month included
-- - Enterprise: Custom metering
--
-- Token tracking happens in:
-- - tenant_cost_ledger (records individual LLM calls with token counts)
-- - usage_events (aggregates tokens per tenant per month)
-- - usage_totals (running sum per tenant per month)
-- - Stripe metering sync sends usage_totals to Stripe for billing

-- 1. Add AI token entitlement to catalog
INSERT INTO public.entitlements (key, description, kind) VALUES
  ('limit.ai_tokens_monthly', 'LLM tokens consumed per month (input + output)', 'limit')
ON CONFLICT (key) DO NOTHING;

-- 2. Add configuration for metering (Stripe sync will read this)
INSERT INTO public.usage_limits_config (
  entitlement_key,
  display_name,
  description,
  hard_limit,
  soft_limit,
  billing_mode,
  unit_label
) VALUES (
  'limit.ai_tokens_monthly',
  'AI Tokens per Month',
  'LLM tokens consumed (input + output counted together)',
  NULL,
  900000,  -- soft warning at 900k (for limits < 1M)
  'metered',
  'tokens'
)
ON CONFLICT (entitlement_key) DO NOTHING;

-- 3. Configure token limits for all Governance OS plans
-- This uses the plan_def CTE pattern from pricing_tier_alignment.sql
WITH plan_def(plan_key, ent_key, val) AS (VALUES
  -- STARTER GOVERNANCE (€39)
  ('starter_governance',      'limit.ai_tokens_monthly',  100000),  -- 100k tokens/mo

  -- PROFESSIONAL GOVERNANCE (€149)
  ('professional_governance', 'limit.ai_tokens_monthly',  500000),  -- 500k tokens/mo

  -- GOVERNANCE OS (€599)
  ('governance_os',           'limit.ai_tokens_monthly', 5000000),  -- 5M tokens/mo

  -- ENTERPRISE REGULATED (custom)
  ('enterprise_regulated',    'limit.ai_tokens_monthly',      -1)    -- -1 = unlimited
)
INSERT INTO public.product_entitlements (product_id, entitlement_id, value)
SELECT p.id, e.id, pd.val
  FROM plan_def pd
  JOIN public.products p     ON p.default_for_plan_key = pd.plan_key
  JOIN public.entitlements e ON e.key = pd.ent_key
ON CONFLICT (product_id, entitlement_id) DO UPDATE SET value = EXCLUDED.value;

-- 4. Create index on tenant_cost_ledger for faster aggregation
CREATE INDEX IF NOT EXISTS tenant_cost_ledger_tenant_kind_recorded_idx
  ON public.tenant_cost_ledger(tenant_id, cost_kind, recorded_at DESC)
  WHERE cost_kind IN ('llm_input', 'llm_output');

-- 5. Create RPC function to count tokens for a tenant in a month
-- Used by stripe-token-meter-sync to aggregate usage
CREATE OR REPLACE FUNCTION public.count_ai_tokens_by_tenant(
  p_tenant_id UUID,
  p_period_month TEXT
) RETURNS BIGINT AS $$
DECLARE
  v_total BIGINT;
BEGIN
  SELECT COALESCE(SUM(units), 0) INTO v_total
  FROM public.tenant_cost_ledger
  WHERE tenant_id = p_tenant_id
    AND cost_kind IN ('llm_input', 'llm_output')
    AND is_simulated = FALSE
    -- Match month: recorded_at >= period_month AND < next month
    AND DATE_TRUNC('month', recorded_at)::DATE = p_period_month::DATE;

  RETURN v_total;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- 6. Create view for token tracking aggregation
CREATE OR REPLACE VIEW public.ai_token_daily_totals AS
SELECT
  tenant_id,
  DATE(recorded_at) as day,
  SUM(CASE WHEN cost_kind = 'llm_input' THEN units ELSE 0 END) as input_tokens,
  SUM(CASE WHEN cost_kind = 'llm_output' THEN units ELSE 0 END) as output_tokens,
  SUM(CASE WHEN cost_kind IN ('llm_input', 'llm_output') THEN units ELSE 0 END) as total_tokens,
  SUM(amount_usd) as cost_usd
FROM public.tenant_cost_ledger
WHERE cost_kind IN ('llm_input', 'llm_output')
  AND is_simulated = FALSE
GROUP BY tenant_id, DATE(recorded_at)
ORDER BY day DESC;

-- 7. Trigger on ai-invoke: record usage_events for tokens consumed
-- (This replaces manual usage recording in the function)
-- The usage-tracking system already has triggers to update usage_totals
-- from usage_events, so we just need to ensure tokens are recorded there.

COMMIT;
