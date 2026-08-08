-- ═══════════════════════════════════════════════════════════════════════════
--  Governance Launch (349 € einmalig) — Produkt und Entitlements
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Bindet das Einmalprodukt an den Entitlement-Katalog, damit
-- `tenant_entitlements()` nach dem Kauf einen echten Umfang liefert.
--
-- WICHTIG — Entitlement-Keys sind kanonisch:
--   `product_entitlements` wird über einen JOIN auf `entitlements.key`
--   befüllt. Ein Key, der im Katalog NICHT existiert, wird vom INNER JOIN
--   still verworfen — die Zeile fehlt dann lautlos und der Kunde bezahlt für
--   einen Umfang, den er nicht bekommt. Die Keys unten entsprechen deshalb
--   exakt dem bestehenden Katalog (siehe 20260430200000 und 20260618000000);
--   die Namen aus `shared/pricing.ts` (`evidenceStorageGb`, `auditReports…`)
--   sind NICHT die DB-Keys.
--   Am Ende dieser Migration prüft ein Assert, dass jede erwartete Bindung
--   tatsächlich geschrieben wurde.
--
-- Additiv: bestehende Produkte, Bindungen und Policies bleiben unverändert.

-- ─── 1. Fehlenden Katalog-Key ergänzen ──────────────────────────────────────
-- Der Nachweisspeicher ist in der Pricing-SSoT als Limit geführt
-- (`limits.evidenceStorageGb`), hatte in der DB aber noch keinen Key.
INSERT INTO public.entitlements (key, description, kind) VALUES
  ('limit.evidence_storage_gb', 'Nachweisspeicher im Evidence Vault in GB', 'limit')
ON CONFLICT (key) DO NOTHING;

-- ─── 2. Sentinel-Produkt für den Plan-Key ───────────────────────────────────
-- Die echte Stripe-Price-ID trägt Ops nach dem Anlegen des Preises nach:
--   UPDATE public.products
--      SET stripe_price_id = 'price_xxx'
--    WHERE default_for_plan_key = 'governance_launch';
-- `stripe-checkout` weist einen Kauf ab, solange nur der Sentinel steht
-- (PRICE_NOT_CONFIGURED) — es entsteht also kein Checkout ins Leere.
INSERT INTO public.products (stripe_price_id, name, default_for_plan_key)
VALUES ('internal_default_governance_launch', 'Governance Launch (default)', 'governance_launch')
ON CONFLICT (stripe_price_id) DO NOTHING;

-- ─── 3. Plan × Entitlement-Bindungen ────────────────────────────────────────
-- Spiegelt Module, Berechtigungen und Limits des Plans aus shared/pricing.ts.
-- Bewusst NICHT gesetzt (weil der Plan sie nicht führt): api.access,
-- webhooks.enabled, monitoring.*, bulk.jobs, whitelabel.*, sla.priority.
WITH governance_launch_entitlements(ent_key, val) AS (VALUES
  -- Module: dsgvo · policy_engine · evidence_vault · audit_center · compliance_reports
  ('dashboard.access',                  1),
  ('governance.dsgvo_directory',        1),
  ('dse.generator',                     1),
  ('policy.packs',                      1),
  ('evidence.basic_vault',              1),
  ('website.scan',                      1),
  -- Berechtigungen: evidenceVault · auditExport
  ('compliance.export',                 1),
  ('reports.export',                    1),
  -- Limits (1 Domain, 3 Sitze, 1 Bot mit 1.000 Antworten, 5 GB Nachweise)
  ('limit.domains',                     1),
  ('limit.team_seats',                  3),
  ('limit.evidence_storage_gb',         5),
  ('limit.compliance_exports_monthly',  5),
  ('limit.automation_runs_monthly',     10),
  ('bots.enabled',                      1),
  ('limit.bots',                        1),
  ('limit.bot_messages_monthly',        1000)
)
INSERT INTO public.product_entitlements (product_id, entitlement_id, value)
SELECT p.id, e.id, gl.val
FROM governance_launch_entitlements gl
JOIN public.products p     ON p.default_for_plan_key = 'governance_launch'
JOIN public.entitlements e ON e.key = gl.ent_key
ON CONFLICT (product_id, entitlement_id) DO UPDATE SET value = EXCLUDED.value;

-- ─── 4. Assert: keine Bindung darf lautlos fehlen ───────────────────────────
-- Schützt genau den Fehler, der bei einem Tippfehler im Key entstehen würde:
-- der JOIN oben verwirft ihn still, der Kunde bekommt weniger als bezahlt.
DO $$
DECLARE
  v_expected INTEGER := 16;
  v_actual   INTEGER;
BEGIN
  SELECT count(*) INTO v_actual
  FROM public.product_entitlements pe
  JOIN public.products p ON p.id = pe.product_id
  WHERE p.default_for_plan_key = 'governance_launch';

  IF v_actual <> v_expected THEN
    RAISE EXCEPTION
      'Governance Launch: % von % Entitlement-Bindungen geschrieben — fehlender Key im Katalog public.entitlements?',
      v_actual, v_expected;
  END IF;
END $$;
