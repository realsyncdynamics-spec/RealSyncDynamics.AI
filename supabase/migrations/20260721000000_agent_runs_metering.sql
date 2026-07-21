-- Agent-Runs Metering
--
-- Führt eine zählbare Nutzungsgröße für Enterprise-AI-OS-Agentenläufe ein und
-- schaltet sie als metered frei, damit stripe-meter-sync die monatliche Nutzung
-- pro Mandant als Overage an Stripe meldet. Additiv — bestehende RLS/Policies
-- bleiben unberührt.
--
-- Billing-Modell: „Included allowance + metered overage" (analog zu
-- limit.ai_tokens_monthly / limit.api_calls_monthly): jeder Plan enthält ein
-- monatliches Kontingent an Agentenläufen; Läufe darüber hinaus werden über
-- Stripe abgerechnet. Die Kontingente unten sind bewusst konservativ gewählt
-- und können jederzeit über product_entitlements angepasst werden.
--
-- Der eigentliche Preis pro Lauf ist Stripe-seitig konfiguriert (Preis am
-- metered subscription item); metered_subscription_items verknüpft Mandanten-
-- Abos mit dem passenden Stripe-Item zur Laufzeit.

-- 1) Entitlement-Registry: neue Limit-Größe
INSERT INTO public.entitlements (key, description, kind) VALUES
    ('limit.agent_runs_monthly', 'Enterprise-AI-OS Agentenläufe pro Monat', 'limit')
ON CONFLICT (key) DO NOTHING;

-- 2) Billing-Mode: metered (Overage via Stripe)
INSERT INTO public.usage_limits_config (entitlement_key, hard_limit, soft_limit, billing_mode, description) VALUES
    ('limit.agent_runs_monthly', NULL, NULL, 'metered', 'Agentenläufe; im Plan enthaltenes Kontingent + metered Overage via Stripe.')
ON CONFLICT (entitlement_key) DO NOTHING;

-- 3) Pro-Plan-Kontingente (included allowance). -1 = unbegrenzt, 0 = kein Kontingent.
--    Nur Pläne mit passendem products.default_for_plan_key erhalten eine Zeile.
WITH plan_def(plan_key, ent_key, val) AS (VALUES
    ('free',              'limit.agent_runs_monthly',    0),
    ('starter',           'limit.agent_runs_monthly',  100),
    ('bronze',            'limit.agent_runs_monthly',  100),
    ('silver',            'limit.agent_runs_monthly',  500),
    ('gold',              'limit.agent_runs_monthly', 2000),
    ('business',          'limit.agent_runs_monthly', 5000),
    ('enterprise',        'limit.agent_runs_monthly',   -1),
    ('enterprise_public', 'limit.agent_runs_monthly',   -1)
)
INSERT INTO public.product_entitlements (product_id, entitlement_id, value)
SELECT p.id, e.id, pd.val
  FROM plan_def pd
  JOIN public.products p     ON p.default_for_plan_key = pd.plan_key
  JOIN public.entitlements e ON e.key = pd.ent_key
ON CONFLICT (product_id, entitlement_id) DO NOTHING;
