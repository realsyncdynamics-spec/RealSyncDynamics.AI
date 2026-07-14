-- AI Gateway: Model Configs, Routing Policies, direkte Spalten auf ai_tool_runs
-- Additive Migration — keine bestehenden RLS-Policies werden geändert.

-- 1. Direkte provider/model_id Spalten auf ai_tool_runs (bisher nur in metadata JSONB)
ALTER TABLE public.ai_tool_runs
  ADD COLUMN IF NOT EXISTS provider TEXT,
  ADD COLUMN IF NOT EXISTS model_id TEXT;

-- Backfill aus metadata für bestehende Zeilen
UPDATE public.ai_tool_runs
  SET provider = metadata->>'provider'
  WHERE provider IS NULL AND metadata ? 'provider';

-- Index für Dashboard-Queries (nach Provider/Modell gruppieren)
CREATE INDEX IF NOT EXISTS idx_ai_tool_runs_provider_model
  ON public.ai_tool_runs (tenant_id, provider, model_id, created_at DESC);

-- 2. ai_model_configs — zentrale Modell-Registry (Preise, Latenz, EU-Residenz)
CREATE TABLE IF NOT EXISTS public.ai_model_configs (
  id                         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider                   TEXT NOT NULL CHECK (provider IN ('anthropic','google','openai','ollama','lm_studio')),
  model_id                   TEXT NOT NULL,
  display_name               TEXT NOT NULL,
  cost_input_per_million_usd NUMERIC NOT NULL DEFAULT 0,
  cost_output_per_million_usd NUMERIC NOT NULL DEFAULT 0,
  avg_latency_ms             INTEGER,
  eu_resident                BOOLEAN NOT NULL DEFAULT false,
  enabled                    BOOLEAN NOT NULL DEFAULT true,
  created_at                 TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                 TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (provider, model_id)
);

-- Bekannte Modelle vorab befüllen
INSERT INTO public.ai_model_configs
  (provider, model_id, display_name, cost_input_per_million_usd, cost_output_per_million_usd, avg_latency_ms, eu_resident)
VALUES
  ('anthropic', 'claude-haiku-4-5-20251001',  'Claude Haiku 4.5',   0.80,  4.00,  800,  false),
  ('anthropic', 'claude-sonnet-4-6-20250514', 'Claude Sonnet 4.6',  3.00, 15.00, 2000,  false),
  ('anthropic', 'claude-opus-4-8',            'Claude Opus 4.8',   15.00, 75.00, 4000,  false),
  ('openai',    'gpt-4o',                     'GPT-4o',             2.50, 10.00, 1800,  false),
  ('openai',    'gpt-4o-mini',                'GPT-4o Mini',        0.15,  0.60,  600,  false),
  ('google',    'gemini-2.0-flash',           'Gemini 2.0 Flash',   0.10,  0.40,  700,  false),
  ('google',    'gemini-1.5-pro',             'Gemini 1.5 Pro',     1.25,  5.00, 2200,  false),
  ('ollama',    'gemma3:4b',                  'Gemma 3 4B (EU)',     0.00,  0.00, 5000,  true),
  ('ollama',    'qwen3',                      'Qwen3 (EU)',          0.00,  0.00, 6000,  true)
ON CONFLICT (provider, model_id) DO NOTHING;

-- RLS: Modell-Configs sind für alle authentifizierten Nutzer lesbar (kein Tenant-Filter nötig)
ALTER TABLE public.ai_model_configs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ai_model_configs_read_all"
  ON public.ai_model_configs FOR SELECT
  USING (auth.role() = 'authenticated');
CREATE POLICY "ai_model_configs_service_write"
  ON public.ai_model_configs FOR ALL
  USING (auth.role() = 'service_role');

-- 3. ai_routing_policies — Tenant-spezifische Routing-Regeln
CREATE TABLE IF NOT EXISTS public.ai_routing_policies (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id               UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name                    TEXT NOT NULL,
  priority                INTEGER NOT NULL DEFAULT 50,
  -- Match-Bedingungen (alle optional, AND-verknüpft wenn gesetzt)
  match_tool_key_pattern  TEXT,          -- SQL LIKE pattern, z.B. 'legal_%'
  match_content_type      TEXT,          -- 'legal' | 'code' | 'summary' | 'analysis' | null = alle
  -- Routing-Entscheidung
  preferred_provider      TEXT CHECK (preferred_provider IN ('anthropic','google','openai','ollama','lm_studio')),
  preferred_model_id      TEXT,
  -- Constraints
  max_cost_usd_per_call   NUMERIC,       -- NULL = kein Limit
  require_eu_resident     BOOLEAN NOT NULL DEFAULT false,
  -- Aktiv
  enabled                 BOOLEAN NOT NULL DEFAULT true,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ai_routing_policies_tenant
  ON public.ai_routing_policies (tenant_id, priority, enabled);

-- RLS: Jeder Tenant sieht nur seine eigenen Policies
ALTER TABLE public.ai_routing_policies ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ai_routing_policies_tenant_iso"
  ON public.ai_routing_policies FOR ALL
  USING (tenant_id = (SELECT id FROM public.tenants WHERE id = auth.uid()));
CREATE POLICY "ai_routing_policies_service"
  ON public.ai_routing_policies FOR ALL
  USING (auth.role() = 'service_role');

-- 4. View: ai_tool_runs_by_model — aggregiert für Dashboard-Queries
CREATE OR REPLACE VIEW public.ai_tool_runs_by_model AS
SELECT
  tenant_id,
  COALESCE(provider, metadata->>'provider', 'unknown')  AS provider,
  COALESCE(model_id, 'unknown')                          AS model_id,
  date_trunc('month', created_at)                        AS month,
  COUNT(*)                                               AS request_count,
  SUM(input_tokens)                                      AS total_input_tokens,
  SUM(output_tokens)                                     AS total_output_tokens,
  SUM(cached_tokens)                                     AS total_cached_tokens,
  SUM(cost_usd)                                          AS total_cost_usd,
  AVG(duration_ms)                                       AS avg_duration_ms,
  PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY duration_ms) AS p95_duration_ms,
  COUNT(*) FILTER (WHERE status = 'success')             AS success_count,
  COUNT(*) FILTER (WHERE status = 'error')               AS error_count
FROM public.ai_tool_runs
GROUP BY tenant_id, provider, model_id, date_trunc('month', created_at);

-- RLS auf View durchgesetzt via Basistabelle
