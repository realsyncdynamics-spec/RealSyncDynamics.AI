-- ═══════════════════════════════════════════════════════════════════════════
--  plan_catalog: Einmalprodukte zulassen
-- ═══════════════════════════════════════════════════════════════════════════
--
-- `plan_catalog.purchase_mode` erlaubte bisher nur ('free','checkout',
-- 'inquiry'). Die Pricing-SSoT kennt seit Governance Launch zusätzlich
-- 'one_time'. Ohne Erweiterung scheitert die nachfolgende Katalog-Migration
-- an der CHECK-Constraint (23514) und bricht den Migrations-Durchlauf ab.
--
-- Ausserdem: eine Spalte für den Einmalpreis. `price_monthly_eur` ist bei
-- Einmalprodukten korrekt 0 (nichts wird wiederkehrend abgerechnet) und wäre
-- als Preisangabe irreführend.
--
-- ── Warum diese Migration die Tabelle notfalls selbst anlegt ───────────────
--   Die Tabelle stammt aus 20260802001000. Prüfung der Live-DB am 2026-08-08
--   (Projekt ebljyceifhnlzhjfyxup): `plan_catalog` und `plan_addons`
--   existieren dort NICHT — die Migration wurde nie angewandt. Ein blosses
--   `ALTER TABLE public.plan_catalog` würde in Produktion mit 42P01
--   ("relation does not exist") abbrechen.
--
--   Statt eine Reihenfolge vorauszusetzen, die faktisch nicht gilt, legt
--   diese Migration die Tabellen bei Bedarf idempotent an (identische
--   Definition wie 20260802001000, inklusive RLS — eine Tabelle ohne RLS ist
--   in diesem Projekt unzulässig). Läuft der Rückstand später regulär nach,
--   sind alle Anweisungen dort IF-NOT-EXISTS-geschützt und bleiben folgenlos.
--
-- Additiv: Constraint wird erweitert (nie verengt), Spalte ist nullable.

-- ─── 1. Tabellen sicherstellen (No-op, wenn bereits vorhanden) ──────────────
CREATE TABLE IF NOT EXISTS public.plan_catalog (
  plan_key               TEXT PRIMARY KEY,
  plan_id                TEXT NOT NULL,
  name                   TEXT NOT NULL,
  outcome_headline       TEXT NOT NULL,
  technical_subheadline  TEXT NOT NULL,
  price_monthly_eur      NUMERIC(10,2) NOT NULL,
  price_yearly_eur       NUMERIC(10,2),
  currency               TEXT NOT NULL DEFAULT 'EUR',
  purchase_mode          TEXT NOT NULL,
  trial_days             INTEGER NOT NULL DEFAULT 0,
  recurring              BOOLEAN NOT NULL DEFAULT false,
  max_bots               INTEGER NOT NULL DEFAULT 0,
  max_answers_per_month  INTEGER NOT NULL DEFAULT 0,
  limits                 JSONB NOT NULL DEFAULT '{}'::jsonb,
  modules                JSONB NOT NULL DEFAULT '[]'::jsonb,
  permissions            JSONB NOT NULL DEFAULT '{}'::jsonb,
  channels               JSONB NOT NULL DEFAULT '[]'::jsonb,
  addons                 JSONB NOT NULL DEFAULT '[]'::jsonb,
  features               JSONB NOT NULL DEFAULT '{}'::jsonb,
  support                TEXT NOT NULL DEFAULT 'email',
  active                 BOOLEAN NOT NULL DEFAULT true,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.plan_addons (
  addon_id       TEXT PRIMARY KEY,
  name           TEXT NOT NULL,
  description    TEXT NOT NULL,
  price_eur      NUMERIC(10,2) NOT NULL,
  price_note     TEXT NOT NULL DEFAULT '',
  interval       TEXT NOT NULL DEFAULT 'month',
  available_for  JSONB NOT NULL DEFAULT '[]'::jsonb,
  active         BOOLEAN NOT NULL DEFAULT true,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS plan_catalog_plan_id_idx ON public.plan_catalog (plan_id);
CREATE INDEX IF NOT EXISTS plan_catalog_active_idx  ON public.plan_catalog (active) WHERE active;

-- ─── 2. RLS: öffentlich lesbar, schreibend nur Service-Role ─────────────────
-- Der Katalog enthält genau die Informationen, die auch auf /pricing stehen.
ALTER TABLE public.plan_catalog ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.plan_addons  ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "plan_catalog anyone-read" ON public.plan_catalog;
CREATE POLICY "plan_catalog anyone-read"
  ON public.plan_catalog FOR SELECT
  USING (active = true);

DROP POLICY IF EXISTS "plan_catalog service-write" ON public.plan_catalog;
CREATE POLICY "plan_catalog service-write"
  ON public.plan_catalog FOR ALL
  USING ((SELECT auth.role()) = 'service_role')
  WITH CHECK ((SELECT auth.role()) = 'service_role');

DROP POLICY IF EXISTS "plan_addons anyone-read" ON public.plan_addons;
CREATE POLICY "plan_addons anyone-read"
  ON public.plan_addons FOR SELECT
  USING (active = true);

DROP POLICY IF EXISTS "plan_addons service-write" ON public.plan_addons;
CREATE POLICY "plan_addons service-write"
  ON public.plan_addons FOR ALL
  USING ((SELECT auth.role()) = 'service_role')
  WITH CHECK ((SELECT auth.role()) = 'service_role');

-- ─── 3. Kaufmodus 'one_time' zulassen ───────────────────────────────────────
-- Erweitert die Constraint unabhängig davon, ob die Tabelle gerade erst
-- angelegt wurde (ohne Constraint) oder aus 20260802001000 stammt (mit der
-- alten Drei-Werte-Constraint).
ALTER TABLE public.plan_catalog
  DROP CONSTRAINT IF EXISTS plan_catalog_purchase_mode_check;

ALTER TABLE public.plan_catalog
  ADD CONSTRAINT plan_catalog_purchase_mode_check
  CHECK (purchase_mode IN ('free', 'checkout', 'inquiry', 'one_time'));

-- ─── 4. Einmalpreis ─────────────────────────────────────────────────────────
ALTER TABLE public.plan_catalog
  ADD COLUMN IF NOT EXISTS price_one_time_eur NUMERIC(10,2);

COMMENT ON COLUMN public.plan_catalog.price_one_time_eur IS
  'Einmalpreis in Euro. Nur für purchase_mode = one_time gesetzt, sonst NULL. Spiegelt price.oneTimeEur aus shared/pricing.ts.';
