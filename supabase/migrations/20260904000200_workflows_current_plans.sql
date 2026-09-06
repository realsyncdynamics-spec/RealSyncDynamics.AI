-- ═══════════════════════════════════════════════════════════════════════════
--  Workflows für die aktuellen Pläne freischalten — ein bezahlter, gesperrter Key
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Befund vom 2026-09-01 (Zugriffsregister, docs/product/addon-booking.md §6):
-- `ai.tool.workflows` und `limit.workflow_runs_monthly` wurden mit
-- 20260503100000 angelegt und AUSSCHLIESSLICH der Fremdleiter zugeordnet
-- (silver, gold, enterprise_public). Kein aktueller Plan trägt den Key —
-- auch nicht Growth, dessen `plan.modules` seit jeher `workflows` nennt und
-- dessen Feature-Liste die Workflow-Engine verspricht.
--
-- Wirkung bis heute: `/app/workflows` prüft `ai.tool.workflows` (WorkflowsView)
-- und `workflow-trigger` gated denselben Key — beides war für JEDEN zahlenden
-- Kunden gesperrt. Ein Feature, das verkauft wird, aber niemand erreichen
-- kann, ist die teuerste Art von fertigem Code (CLAUDE.md §14).
--
-- Werte: Growth 100 Läufe (wie `limit.automation_runs_monthly` dort),
-- Agency 1.000 (der Vorwert von gold), Enterprise unbegrenzt, Partner 2.500
-- (wie seine Automationsläufe). Starter bleibt außen vor — `workflows` ist
-- laut Quelle ein Growth-Modul.
--
-- Additiv: Ein bestehender Wert wird nie gesenkt (-1 schlägt alles).

BEGIN;

WITH plan_def(plan_key, ent_key, val) AS (VALUES
  ('growth',     'ai.tool.workflows',           1),
  ('growth',     'limit.workflow_runs_monthly', 100),
  ('agency',     'ai.tool.workflows',           1),
  ('agency',     'limit.workflow_runs_monthly', 1000),
  ('enterprise', 'ai.tool.workflows',           1),
  ('enterprise', 'limit.workflow_runs_monthly', -1),
  ('partner',    'ai.tool.workflows',           1),
  ('partner',    'limit.workflow_runs_monthly', 2500),
  -- Altdaten: das Partner-Produkt kann noch unter seinem früheren Key stehen.
  ('scale',      'ai.tool.workflows',           1),
  ('scale',      'limit.workflow_runs_monthly', 2500)
)
INSERT INTO public.product_entitlements (product_id, entitlement_id, value)
SELECT p.id, e.id, pd.val
  FROM plan_def pd
  JOIN public.products p
    ON p.default_for_plan_key = pd.plan_key
    OR p.default_for_plan_key = pd.plan_key || '_yearly'
  JOIN public.entitlements e ON e.key = pd.ent_key
ON CONFLICT (product_id, entitlement_id) DO UPDATE
  SET value = CASE
    WHEN public.product_entitlements.value = -1 OR EXCLUDED.value = -1 THEN -1
    ELSE GREATEST(public.product_entitlements.value, EXCLUDED.value)
  END;

COMMIT;
