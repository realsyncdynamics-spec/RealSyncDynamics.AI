-- ─────────────────────────────────────────────────────────────────────────────
-- Rate Limiting Analytics Tables
-- Phase 9: Rate Limiting Analytics Dashboard
-- ─────────────────────────────────────────────────────────────────────────────

-- Rate limit configurations per API key
CREATE TABLE IF NOT EXISTS public.api_rate_limit_configs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  api_key_id uuid NOT NULL REFERENCES public.api_keys(id) ON DELETE CASCADE,
  requests_per_minute integer NOT NULL DEFAULT 100,
  requests_per_hour integer NOT NULL DEFAULT 5000,
  burst_limit integer NOT NULL DEFAULT 200,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT unique_rate_limit_config UNIQUE(tenant_id, api_key_id)
);

-- Rate limit violations history
CREATE TABLE IF NOT EXISTS public.api_rate_limit_violations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  api_key_id uuid NOT NULL REFERENCES public.api_keys(id) ON DELETE CASCADE,
  violation_type text NOT NULL CHECK (violation_type IN ('per_minute', 'per_hour', 'burst')),
  requests_count integer NOT NULL,
  limit_value integer NOT NULL,
  violated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.api_rate_limit_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.api_rate_limit_violations ENABLE ROW LEVEL SECURITY;

-- RLS Policies for rate_limit_configs
CREATE POLICY "Users can view their tenant's rate limit configs"
  ON public.api_rate_limit_configs
  FOR SELECT
  USING (tenant_id IN (
    SELECT id FROM public.tenants WHERE id = auth.uid() OR
    id IN (SELECT tenant_id FROM public.tenant_memberships WHERE user_id = auth.uid())
  ));

CREATE POLICY "Users can update their tenant's rate limit configs"
  ON public.api_rate_limit_configs
  FOR UPDATE
  USING (tenant_id IN (
    SELECT id FROM public.tenants WHERE id = auth.uid() OR
    id IN (SELECT tenant_id FROM public.tenant_memberships WHERE user_id = auth.uid())
  ));

-- RLS Policies for rate_limit_violations
CREATE POLICY "Users can view their tenant's rate limit violations"
  ON public.api_rate_limit_violations
  FOR SELECT
  USING (tenant_id IN (
    SELECT id FROM public.tenants WHERE id = auth.uid() OR
    id IN (SELECT tenant_id FROM public.tenant_memberships WHERE user_id = auth.uid())
  ));

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_rate_limit_configs_tenant
  ON public.api_rate_limit_configs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_rate_limit_configs_api_key
  ON public.api_rate_limit_configs(api_key_id);
CREATE INDEX IF NOT EXISTS idx_rate_limit_violations_tenant
  ON public.api_rate_limit_violations(tenant_id);
CREATE INDEX IF NOT EXISTS idx_rate_limit_violations_api_key
  ON public.api_rate_limit_violations(api_key_id);
CREATE INDEX IF NOT EXISTS idx_rate_limit_violations_timestamp
  ON public.api_rate_limit_violations(violated_at DESC);

-- Audit logging
INSERT INTO ai_tool_runs (tenant_id, tool_name, input_json, output_json, status)
SELECT
  null,
  'database_migration',
  '{"migration":"20260707000000_rate_limiting_analytics"}'::jsonb,
  '{"tables_created":["api_rate_limit_configs","api_rate_limit_violations"]}'::jsonb,
  'completed'
WHERE NOT EXISTS (
  SELECT 1 FROM ai_tool_runs
  WHERE tool_name = 'database_migration'
  AND input_json->>'migration' = '20260707000000_rate_limiting_analytics'
);
