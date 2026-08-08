-- ═══════════════════════════════════════════════════════════════════════════
--  Governance Launch (349 € einmalig) — Produkt und Entitlements
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Legt das Produkt an, auf das ein `entitlement_grants`-Eintrag nach dem Kauf
-- zeigt, und bindet daran die Rechte des Plans aus `shared/pricing.ts`.
--
-- ── Warum diese Migration ihre Keys selbst seedet ──────────────────────────
--   `product_entitlements` wird über einen JOIN auf `entitlements.key`
--   befüllt. Ein Key, der im Katalog fehlt, wird vom INNER JOIN STILL
--   verworfen — der Kunde bezahlte dann für Rechte, die er nie bekommt.
--
--   Der Katalog im Repo ist NICHT der Katalog in Produktion. Prüfung der
--   Live-DB am 2026-08-08 (Projekt ebljyceifhnlzhjfyxup): 47 Keys vorhanden,
--   davon fehlten acht der hier benötigten — `dashboard.access`,
--   `governance.dsgvo_directory`, `policy.packs`, `evidence.basic_vault`,
--   `website.scan`, `reports.export`, `limit.automation_runs_monthly`,
--   `limit.evidence_storage_gb`. Sie stammen aus Migrationen, die nie
--   angewandt wurden.
--
--   Diese Migration setzt deshalb keinen Key voraus, sondern legt jeden
--   benötigten Key additiv und idempotent selbst an. Damit ist sie unabhängig
--   davon korrekt, wie weit der Migrations-Rückstand aufgeholt ist. Der
--   Assert am Ende beweist, dass am Ende jede Bindung steht.
--
-- Additiv: bestehende Keys, Produkte, Bindungen und Policies bleiben unberührt.

-- ─── 1. Benötigte Katalog-Keys sicherstellen ────────────────────────────────
-- ON CONFLICT DO NOTHING: existiert der Key bereits (Repo-Stand oder durch
-- eine später nachgezogene Migration), bleibt seine Definition unverändert.
INSERT INTO public.entitlements (key, description, kind) VALUES
  ('dashboard.access',              'Zugang zum Governance-Dashboard',              'boolean'),
  ('governance.dsgvo_directory',    'DSGVO-Verarbeitungsverzeichnis',               'boolean'),
  ('policy.packs',                  'Policy Packs (regulatorische Rahmenwerke)',    'boolean'),
  ('evidence.basic_vault',          'Evidence Vault (Nachweisspeicher)',            'boolean'),
  ('website.scan',                  'Runtime-Scan einer Domain',                    'boolean'),
  ('reports.export',                'Berichte exportieren (PDF/JSON)',              'boolean'),
  ('limit.automation_runs_monthly', 'Automationslaeufe pro Monat',                  'limit'),
  ('limit.evidence_storage_gb',     'Nachweisspeicher im Evidence Vault in GB',     'limit')
ON CONFLICT (key) DO NOTHING;

-- ─── 2. Produkt für den Plan-Key ────────────────────────────────────────────
-- Sentinel-Preis. Die echte Stripe-Price-ID traegt Ops nach dem Anlegen nach:
--   UPDATE public.products
--      SET stripe_price_id = 'price_xxx'
--    WHERE default_for_plan_key = 'governance_launch';
-- Bis dahin weist `stripe-checkout` den Kauf mit PRICE_NOT_CONFIGURED ab —
-- es entsteht kein Checkout ins Leere.
INSERT INTO public.products (stripe_price_id, name, default_for_plan_key)
VALUES ('internal_default_governance_launch', 'Governance Launch (einmalig)', 'governance_launch')
ON CONFLICT (stripe_price_id) DO NOTHING;

-- ─── 3. Rechte des Plans binden ─────────────────────────────────────────────
-- Spiegelt Module, Berechtigungen und Limits aus shared/pricing.ts.
-- Bewusst NICHT gesetzt, weil der Plan sie nicht fuehrt: api.access,
-- webhooks.enabled, monitoring.*, bulk.jobs, whitelabel.*, sla.priority,
-- sso.enabled, org.governance.
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
  -- Limits: 1 Domain · 3 Sitze · 5 GB Nachweise · 5 Berichte · 10 Laeufe
  ('limit.domains',                     1),
  ('limit.team_seats',                  3),
  ('limit.evidence_storage_gb',         5),
  ('limit.compliance_exports_monthly',  5),
  ('limit.automation_runs_monthly',     10),
  -- Ein Governance-Bot fuer die Website mit 1.000 Antworten
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
      'Governance Launch: % von % Entitlement-Bindungen geschrieben — fehlender Key in public.entitlements?',
      v_actual, v_expected;
  END IF;
END $$;
