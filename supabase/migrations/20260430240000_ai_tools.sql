-- AI Tools — register, audit log, and entitlement/usage wiring.
--
-- Builds on:
--   entitlements / product_entitlements (for per-tool boolean access + numeric quotas)
--   usage_events / usage_totals          (for monthly counters, per-tenant)
--   usage_limits_config                  (for billing_mode per quota key)
--
-- Three new entitlement quotas:
--   limit.ai_calls_monthly         number of tool invocations per month
--   limit.ai_tokens_monthly        sum of input + output tokens per month
--   limit.ai_cost_monthly_cents    upper cost cap per month (cents, integer)
--
-- One boolean entitlement per registered tool:
--   ai.tool.<tool_key>             must be true for the tenant to call it.
--   Tools may override via ai_tools.required_entitlement_key.

-- ─── 1. Tools register ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.ai_tools (
    id                              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    key                             TEXT UNIQUE NOT NULL,
    name                            TEXT NOT NULL,
    description                     TEXT,
    model_provider                  TEXT NOT NULL CHECK (model_provider IN ('anthropic', 'google', 'openai')),
    model_id                        TEXT NOT NULL,
    system_prompt                   TEXT,
    max_tokens                      INTEGER NOT NULL DEFAULT 4096,
    temperature                     NUMERIC NOT NULL DEFAULT 0.7,
    cost_input_per_million_usd      NUMERIC NOT NULL DEFAULT 0,
    cost_output_per_million_usd     NUMERIC NOT NULL DEFAULT 0,
    -- If null, defaults to "ai.tool." || key. Lets us share gating across tools.
    required_entitlement_key        TEXT REFERENCES public.entitlements(key),
    enabled                         BOOLEAN NOT NULL DEFAULT true,
    created_at                      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at                      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ai_tools_enabled ON public.ai_tools(enabled);

-- ─── 2. Audit log of every invocation ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.ai_tool_runs (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    tool_id         UUID REFERENCES public.ai_tools(id) ON DELETE SET NULL,
    -- Denormalized so deleting a tool doesn't lose history.
    tool_key        TEXT NOT NULL,
    user_id         UUID,            -- references auth.users; nullable for system jobs
    input_tokens    INTEGER NOT NULL DEFAULT 0,
    output_tokens  INTEGER NOT NULL DEFAULT 0,
    cached_tokens   INTEGER NOT NULL DEFAULT 0,
    cost_usd        NUMERIC NOT NULL DEFAULT 0,
    duration_ms     INTEGER,
    status          TEXT NOT NULL CHECK (status IN ('success', 'error', 'timeout', 'quota_exceeded')),
    error_code      TEXT,
    error_message   TEXT,
    metadata        JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ai_tool_runs_tenant_created
    ON public.ai_tool_runs(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_tool_runs_tenant_tool
    ON public.ai_tool_runs(tenant_id, tool_key, created_at DESC);

-- ─── 3. RLS ──────────────────────────────────────────────────────────────────
ALTER TABLE public.ai_tools     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_tool_runs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ai_tools read"            ON public.ai_tools;
DROP POLICY IF EXISTS "ai_tool_runs tenant-read" ON public.ai_tool_runs;

CREATE POLICY "ai_tools read"
    ON public.ai_tools FOR SELECT
    USING (auth.role() = 'authenticated');

CREATE POLICY "ai_tool_runs tenant-read"
    ON public.ai_tool_runs FOR SELECT
    USING (public.is_tenant_member(tenant_id));

-- updated_at trigger
DROP TRIGGER IF EXISTS update_ai_tools_modtime ON public.ai_tools;
CREATE TRIGGER update_ai_tools_modtime
    BEFORE UPDATE ON public.ai_tools
    FOR EACH ROW EXECUTE PROCEDURE update_modified_column();

-- ─── 4. New entitlement keys ─────────────────────────────────────────────────
INSERT INTO public.entitlements (key, description, kind) VALUES
    ('ai.tool.code_explain',       'AI: Code-Erklärung',                 'boolean'),
    ('ai.tool.log_analyze',        'AI: Log-Analyse',                    'boolean'),
    ('ai.tool.vps_status',         'AI: VPS-Status-Diagnose',            'boolean'),
    ('limit.ai_calls_monthly',     'AI-Aufrufe pro Monat',               'limit'),
    ('limit.ai_tokens_monthly',    'AI-Token (Input + Output) pro Monat','limit'),
    ('limit.ai_cost_monthly_cents','AI-Kosten-Cap pro Monat (Cent)',     'limit')
ON CONFLICT (key) DO NOTHING;

-- ─── 5. Billing modes for AI quotas ──────────────────────────────────────────
INSERT INTO public.usage_limits_config (entitlement_key, hard_limit, soft_limit, billing_mode, description) VALUES
    ('limit.ai_calls_monthly',     NULL, NULL, 'included', 'AI-Aufrufe; harte Caps stehen pro Plan in product_entitlements.'),
    ('limit.ai_tokens_monthly',    NULL, NULL, 'metered',  'AI-Token; metered für Stripe-Overage (siehe billing).'),
    ('limit.ai_cost_monthly_cents',NULL, NULL, 'overage',  'Kosten-Cap; Tenants können freischalten, Stripe verrechnet zusätzlich.')
ON CONFLICT (entitlement_key) DO NOTHING;

-- ─── 6. Plan bindings ────────────────────────────────────────────────────────
WITH plan_def(plan_key, ent_key, val) AS (VALUES
    -- FREE: no AI tools
    ('free',              'limit.ai_calls_monthly',          0),
    ('free',              'limit.ai_tokens_monthly',         0),
    ('free',              'limit.ai_cost_monthly_cents',     0),

    -- BRONZE: code_explain only
    ('bronze',            'ai.tool.code_explain',            1),
    ('bronze',            'limit.ai_calls_monthly',          50),
    ('bronze',            'limit.ai_tokens_monthly',         100000),
    ('bronze',            'limit.ai_cost_monthly_cents',     500),

    -- SILVER: + log_analyze
    ('silver',            'ai.tool.code_explain',            1),
    ('silver',            'ai.tool.log_analyze',             1),
    ('silver',            'limit.ai_calls_monthly',          250),
    ('silver',            'limit.ai_tokens_monthly',         500000),
    ('silver',            'limit.ai_cost_monthly_cents',     2500),

    -- GOLD: all three tools
    ('gold',              'ai.tool.code_explain',            1),
    ('gold',              'ai.tool.log_analyze',             1),
    ('gold',              'ai.tool.vps_status',              1),
    ('gold',              'limit.ai_calls_monthly',          2500),
    ('gold',              'limit.ai_tokens_monthly',         5000000),
    ('gold',              'limit.ai_cost_monthly_cents',     25000),

    -- ENTERPRISE: unlimited
    ('enterprise_public', 'ai.tool.code_explain',            1),
    ('enterprise_public', 'ai.tool.log_analyze',             1),
    ('enterprise_public', 'ai.tool.vps_status',              1),
    ('enterprise_public', 'limit.ai_calls_monthly',         -1),
    ('enterprise_public', 'limit.ai_tokens_monthly',        -1),
    ('enterprise_public', 'limit.ai_cost_monthly_cents',    -1)
)
INSERT INTO public.product_entitlements (product_id, entitlement_id, value)
SELECT p.id, e.id, pd.val
FROM plan_def pd
JOIN public.products p     ON p.default_for_plan_key = pd.plan_key
JOIN public.entitlements e ON e.key = pd.ent_key
ON CONFLICT (product_id, entitlement_id) DO NOTHING;

-- ─── 7. Seed three example tools ─────────────────────────────────────────────
-- Pricing reflects Anthropic public pricing; adjust per real contract.
INSERT INTO public.ai_tools
    (key, name, description, model_provider, model_id, system_prompt,
     max_tokens, temperature, cost_input_per_million_usd, cost_output_per_million_usd)
VALUES
    ('code_explain',
     'Code Erklären',
     'Erklärt und kommentiert Code-Snippets oder ganze Dateien.',
     'anthropic', 'claude-sonnet-4-6',
     'Du bist ein Senior-Entwickler. Erkläre den eingegebenen Code prägnant: was er macht, welche Annahmen er trifft, und welche Stolperfallen drinstecken. Antworte auf Deutsch, nutze Markdown.',
     2048, 0.4, 3.00, 15.00),

    ('log_analyze',
     'Log-Analyse',
     'Analysiert Logs, extrahiert Fehler, schlägt Fixes vor.',
     'anthropic', 'claude-sonnet-4-6',
     'Du bist Site-Reliability-Ingenieur. Lies die übergebenen Log-Zeilen, extrahiere die wichtigsten Fehler/Warnings, gruppiere sie, und schlage konkrete nächste Schritte vor. Antworte auf Deutsch, nutze Markdown.',
     3000, 0.3, 3.00, 15.00),

    ('vps_status',
     'VPS-Status-Diagnose',
     'Interpretiert den Output von Kodee VPS-Aktionen und macht eine Gesamtdiagnose.',
     'anthropic', 'claude-opus-4-7',
     'Du bist Kodee, der VPS-Sidekick. Du bekommst strukturierte Ergebnisse von vps.status / vps.disk / vps.dns_check / vps.tls_check und sollst eine kurze Gesamtdiagnose schreiben: was läuft, was nicht, was als nächstes zu tun ist. Antworte auf Deutsch, nutze Markdown, sei knapp.',
     1500, 0.2, 15.00, 75.00)
ON CONFLICT (key) DO NOTHING;

COMMENT ON TABLE public.ai_tools IS
    'Register aller AI-Tools (Modell, Prompt, Pricing). Per-Tenant-Zugriff über entitlements (ai.tool.<key>).';
COMMENT ON TABLE public.ai_tool_runs IS
    'Audit + Cost-Trail jeder AI-Tool-Invocation. Tenant-Member-RLS für SELECT.';
