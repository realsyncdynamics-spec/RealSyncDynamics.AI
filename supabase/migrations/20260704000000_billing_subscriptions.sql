-- ─── Subscription Plans & UG-Ready Billing Integration ─────────────────────

-- This migration adds tier-based subscription plan definitions compatible with:
--   - src/config/pricing.ts (5-tier model: free, starter, growth, agency, scale, enterprise)
--   - Stripe Product/Price IDs
--   - Feature quota enforcement (bots, API calls, evidence vault, etc.)

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ─── 1. Subscription Plans (Tiers) ───────────────────────────────────────────

-- Pricing tiers backed by Stripe Product/Price IDs
-- Single source of truth for all tier definitions
CREATE TABLE IF NOT EXISTS public.subscription_plans (
  id TEXT PRIMARY KEY, -- 'free_audit', 'starter', 'growth', 'agency', 'scale', 'enterprise'
  name TEXT NOT NULL,
  description TEXT,
  price_eur DECIMAL(10, 2) NOT NULL,
  stripe_product_id TEXT,
  stripe_price_id TEXT,
  recurring BOOLEAN NOT NULL DEFAULT false,
  billing_period_days INTEGER DEFAULT 30,
  bot_quota_max_bots INTEGER DEFAULT 0,
  bot_quota_max_answers_per_month INTEGER DEFAULT 0,
  features JSONB DEFAULT '[]', -- stored feature list from pricing.ts
  metadata JSONB DEFAULT '{}',
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.subscription_plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "subscription_plans anyone-read"
  ON public.subscription_plans FOR SELECT
  USING (active = true);

CREATE POLICY "subscription_plans service-only"
  ON public.subscription_plans FOR ALL
  USING (auth.role() = 'service_role');

-- ─── 2. Enhance existing subscriptions table with plan_key ───────────────────

-- Backcompat: map plan_key to plan_id (subscription_plans.id)
ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS plan_id TEXT REFERENCES public.subscription_plans(id);

-- ─── 3. Feature Usage Tracking (quota enforcement) ──────────────────────────

-- Track feature usage against plan quotas (monthly buckets)
CREATE TABLE IF NOT EXISTS public.feature_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  feature_name TEXT NOT NULL, -- e.g., 'audit_scans', 'bot_answers', 'api_calls'
  usage_count INTEGER DEFAULT 0,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  reset_at TIMESTAMPTZ,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(tenant_id, feature_name, period_start)
);

ALTER TABLE public.feature_usage ENABLE ROW LEVEL SECURITY;
CREATE POLICY "feature_usage tenant-read"
  ON public.feature_usage FOR SELECT
  USING (public.is_tenant_member(tenant_id));

CREATE POLICY "feature_usage service-only"
  ON public.feature_usage FOR ALL
  USING (auth.role() = 'service_role');

-- ─── Indices for Performance ────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_subscriptions_plan_id
  ON public.subscriptions(plan_id);

CREATE INDEX IF NOT EXISTS idx_feature_usage_tenant_id
  ON public.feature_usage(tenant_id);

CREATE INDEX IF NOT EXISTS idx_feature_usage_period
  ON public.feature_usage(period_start, period_end);

-- ─── Helper Functions (RLS-compliant) ────────────────────────────────────────

-- Get active subscription plan for a tenant (lookup via existing subscriptions table)
CREATE OR REPLACE FUNCTION public.get_tenant_plan_key(p_tenant_id UUID)
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT plan_key
  FROM public.subscriptions
  WHERE tenant_id = p_tenant_id
    AND status = 'active'
  LIMIT 1;
$$;

COMMENT ON FUNCTION public.get_tenant_plan_key(UUID) IS
  'Retrieve active plan_key for a tenant (e.g., ''starter'', ''growth'', ''agency'')';

-- Check if tenant has a specific feature based on their active plan
CREATE OR REPLACE FUNCTION public.has_feature(
  p_tenant_id UUID,
  p_feature_name TEXT
)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.subscriptions s
    JOIN public.subscription_plans sp ON s.plan_id = sp.id
    WHERE s.tenant_id = p_tenant_id
      AND s.status = 'active'
      AND sp.features ? p_feature_name
  );
$$;

COMMENT ON FUNCTION public.has_feature(UUID, TEXT) IS
  'Check if a tenant can access a feature based on their active subscription plan';

-- Get feature quota for a tenant (e.g., max_bots, max_answers_per_month)
CREATE OR REPLACE FUNCTION public.get_feature_quota(
  p_tenant_id UUID,
  p_quota_name TEXT
)
RETURNS INTEGER
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE p_quota_name
    WHEN 'max_bots' THEN sp.bot_quota_max_bots
    WHEN 'max_answers_per_month' THEN sp.bot_quota_max_answers_per_month
    ELSE NULL
  END
  FROM public.subscriptions s
  JOIN public.subscription_plans sp ON s.plan_id = sp.id
  WHERE s.tenant_id = p_tenant_id
    AND s.status = 'active'
  LIMIT 1;
$$;

COMMENT ON FUNCTION public.get_feature_quota(UUID, TEXT) IS
  'Get feature quota (max_bots, max_answers_per_month) for a tenant''s active plan';

-- Check monthly feature usage against quota
CREATE OR REPLACE FUNCTION public.check_feature_usage(
  p_tenant_id UUID,
  p_feature_name TEXT,
  p_month_bucket DATE
)
RETURNS TABLE (
  usage_count INTEGER,
  max_allowed INTEGER,
  remaining INTEGER
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    COALESCE(fu.usage_count, 0) AS usage_count,
    CASE p_feature_name
      WHEN 'bot_answers' THEN sp.bot_quota_max_answers_per_month
      ELSE NULL
    END AS max_allowed,
    CASE p_feature_name
      WHEN 'bot_answers' THEN (sp.bot_quota_max_answers_per_month - COALESCE(fu.usage_count, 0))
      ELSE NULL
    END AS remaining
  FROM public.subscriptions s
  LEFT JOIN public.subscription_plans sp ON s.plan_id = sp.id
  LEFT JOIN public.feature_usage fu ON
    fu.tenant_id = p_tenant_id
    AND fu.feature_name = p_feature_name
    AND fu.period_start = p_month_bucket
  WHERE s.tenant_id = p_tenant_id
    AND s.status = 'active'
  LIMIT 1;
$$;

COMMENT ON FUNCTION public.check_feature_usage(UUID, TEXT, DATE) IS
  'Check current usage and remaining quota for a feature in a billing month';
