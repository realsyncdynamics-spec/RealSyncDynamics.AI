-- Automations + Kodee/VPS — Verankerung in den AKTUELLEN Tarifen.
--
-- Ausgangslage: Beide Features sind gebaut, ihre Entitlements hingen aber nur
-- an den Legacy-Plänen (bronze/silver/gold/enterprise_public). Die heute
-- verkauften Tarife (starter/growth/agency/scale/enterprise) bekamen nichts —
-- d.h. die Features waren nicht buchbar, obwohl sie beworben werden sollen.
--
-- Diese Migration ist rein additiv (nur neue Plan×Entitlement-Bindings) und
-- bricht keine bestehenden Legacy-Bindings oder RLS.
--
--   Automations (ai.tool.automations + limit.automation_runs_monthly):
--     free 3 (bereits gesetzt) · starter 25 · growth 100 · agency 500 ·
--     scale 2.500 · enterprise ∞  (Legacy-Staffel gespiegelt)
--
--   Kodee/VPS (ai.tool.vps_status + ai.tool.vps_action_advisor):
--     ab agency (Ops-lastiges Feature) · scale · enterprise
--     Das AI-Budget (limit.ai_calls/tokens/cost) hängt für agency+ bereits an
--     den Tarifen (siehe bots_entitlements), daher hier nur die Tool-Flags.

-- ─── 1. Automations: neue Tarife an die vorhandenen Entitlements binden ──────
WITH plan_def(plan_key, ent_key, val) AS (VALUES
    ('starter',    'ai.tool.automations',           1),
    ('starter',    'limit.automation_runs_monthly', 25),

    ('growth',     'ai.tool.automations',           1),
    ('growth',     'limit.automation_runs_monthly', 100),

    ('agency',     'ai.tool.automations',           1),
    ('agency',     'limit.automation_runs_monthly', 500),

    ('scale',      'ai.tool.automations',           1),
    ('scale',      'limit.automation_runs_monthly', 2500),

    ('enterprise', 'ai.tool.automations',           1),
    ('enterprise', 'limit.automation_runs_monthly', -1)
)
INSERT INTO public.product_entitlements (product_id, entitlement_id, value)
SELECT p.id, e.id, pd.val
  FROM plan_def pd
  JOIN public.products p     ON p.default_for_plan_key = pd.plan_key
  JOIN public.entitlements e ON e.key = pd.ent_key
ON CONFLICT (product_id, entitlement_id) DO NOTHING;

-- ─── 2. Kodee/VPS: ab Agency an die aktuellen Tarife binden ──────────────────
WITH plan_def(plan_key, ent_key, val) AS (VALUES
    ('agency',     'ai.tool.vps_status',         1),
    ('agency',     'ai.tool.vps_action_advisor', 1),

    ('scale',      'ai.tool.vps_status',         1),
    ('scale',      'ai.tool.vps_action_advisor', 1),

    ('enterprise', 'ai.tool.vps_status',         1),
    ('enterprise', 'ai.tool.vps_action_advisor', 1)
)
INSERT INTO public.product_entitlements (product_id, entitlement_id, value)
SELECT p.id, e.id, pd.val
  FROM plan_def pd
  JOIN public.products p     ON p.default_for_plan_key = pd.plan_key
  JOIN public.entitlements e ON e.key = pd.ent_key
ON CONFLICT (product_id, entitlement_id) DO NOTHING;
