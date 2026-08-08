-- ═══════════════════════════════════════════════════════════════════════════
--  plan_catalog: Einmalprodukte zulassen
-- ═══════════════════════════════════════════════════════════════════════════
--
-- `plan_catalog.purchase_mode` erlaubte bisher nur ('free','checkout',
-- 'inquiry'). Die Pricing-SSoT kennt seit Governance Launch zusätzlich
-- 'one_time'. Ohne diese Erweiterung würde die generierte Katalog-Migration
-- an der CHECK-Constraint scheitern (23514) und den gesamten
-- Migrations-Durchlauf abbrechen.
--
-- Außerdem: eine Spalte für den Einmalpreis. Ohne sie stünde Governance
-- Launch im Katalog mit 0 € — `price_monthly_eur` ist bei Einmalprodukten
-- korrekt 0, weil nichts wiederkehrend abgerechnet wird, und wäre als
-- Preisangabe irreführend.
--
-- Additiv: Constraint wird erweitert (nie verengt), Spalte ist nullable.
-- Muss VOR der neu generierten Katalog-Migration laufen (Zeitstempel-Ordnung).

ALTER TABLE public.plan_catalog
  DROP CONSTRAINT IF EXISTS plan_catalog_purchase_mode_check;

ALTER TABLE public.plan_catalog
  ADD CONSTRAINT plan_catalog_purchase_mode_check
  CHECK (purchase_mode IN ('free', 'checkout', 'inquiry', 'one_time'));

ALTER TABLE public.plan_catalog
  ADD COLUMN IF NOT EXISTS price_one_time_eur NUMERIC(10,2);

COMMENT ON COLUMN public.plan_catalog.price_one_time_eur IS
  'Einmalpreis in Euro. Nur für purchase_mode = one_time gesetzt, sonst NULL. Spiegelt price.oneTimeEur aus shared/pricing.ts.';
