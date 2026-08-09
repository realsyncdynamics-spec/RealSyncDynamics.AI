-- WIEDERHERGESTELLT aus der Prod-Migrations-History (2026-08-02), Option A.
-- 1:1 aus supabase_migrations.schema_migrations, Version 20260628121551.
-- Gehoert zu Bots-Feature A. Siehe docs/runtime/PRODUCTION_BLOCKERS.md, Blocker 2.

-- Bots — Entitlements + Plan-Bindings (Growth+).

-- 1. Entitlement-Katalog
INSERT INTO public.entitlements (key, description, kind) VALUES
    ('bots.enabled',                   'Konversations-Bots (Chat)',            'boolean'),
    ('bots.voice',                     'Bot-Telefonie (Voice)',                'boolean'),
    ('ai.tool.bot_reply',              'AI: Bot-Antwort-Generierung',          'boolean'),
    ('limit.bots',                     'Maximale Anzahl aktiver Bots',         'limit'),
    ('limit.bot_messages_monthly',     'Bot-Antworten pro Monat',              'limit'),
    ('limit.bot_voice_minutes_monthly','Bot-Telefonie-Minuten pro Monat',      'limit')
ON CONFLICT (key) DO NOTHING;

-- 2. Billing-Modi für die neuen Quotas
INSERT INTO public.usage_limits_config (entitlement_key, hard_limit, soft_limit, billing_mode, description) VALUES
    ('limit.bot_messages_monthly',      NULL, NULL, 'included', 'Bot-Antworten; harte Caps pro Plan in product_entitlements.'),
    ('limit.bot_voice_minutes_monthly', NULL, NULL, 'metered',  'Telefonie-Minuten; metered für Stripe-Overage am Hangup-Event.')
ON CONFLICT (entitlement_key) DO NOTHING;

-- 3. Plan × Entitlement-Bindings (Growth+)
WITH plan_def(plan_key, ent_key, val) AS (VALUES
    ('growth',     'bots.enabled',                    1),
    ('growth',     'ai.tool.bot_reply',               1),
    ('growth',     'limit.bots',                      2),
    ('growth',     'limit.bot_messages_monthly',      2000),
    ('growth',     'limit.ai_calls_monthly',          2000),
    ('growth',     'limit.ai_tokens_monthly',         2000000),
    ('growth',     'limit.ai_cost_monthly_cents',     2000),

    ('agency',     'bots.enabled',                    1),
    ('agency',     'bots.voice',                      1),
    ('agency',     'ai.tool.bot_reply',               1),
    ('agency',     'limit.bots',                      10),
    ('agency',     'limit.bot_messages_monthly',      10000),
    ('agency',     'limit.bot_voice_minutes_monthly', 500),
    ('agency',     'limit.ai_calls_monthly',          10000),
    ('agency',     'limit.ai_tokens_monthly',         10000000),
    ('agency',     'limit.ai_cost_monthly_cents',     10000),

    ('scale',      'bots.enabled',                    1),
    ('scale',      'bots.voice',                      1),
    ('scale',      'ai.tool.bot_reply',               1),
    ('scale',      'limit.bots',                      50),
    ('scale',      'limit.bot_messages_monthly',      50000),
    ('scale',      'limit.bot_voice_minutes_monthly', 2500),
    ('scale',      'limit.ai_calls_monthly',          50000),
    ('scale',      'limit.ai_tokens_monthly',         50000000),
    ('scale',      'limit.ai_cost_monthly_cents',     50000),

    ('enterprise', 'bots.enabled',                    1),
    ('enterprise', 'bots.voice',                      1),
    ('enterprise', 'ai.tool.bot_reply',               1),
    ('enterprise', 'limit.bots',                      -1),
    ('enterprise', 'limit.bot_messages_monthly',      -1),
    ('enterprise', 'limit.bot_voice_minutes_monthly', -1),
    ('enterprise', 'limit.ai_calls_monthly',          -1),
    ('enterprise', 'limit.ai_tokens_monthly',         -1),
    ('enterprise', 'limit.ai_cost_monthly_cents',     -1)
)
INSERT INTO public.product_entitlements (product_id, entitlement_id, value)
SELECT p.id, e.id, pd.val
FROM plan_def pd
JOIN public.products p     ON p.default_for_plan_key = pd.plan_key
JOIN public.entitlements e ON e.key = pd.ent_key
ON CONFLICT (product_id, entitlement_id) DO NOTHING;
