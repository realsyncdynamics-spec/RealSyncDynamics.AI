-- Stripe-Real-Price-IDs fuer die 4 Pricing-Tiers (Free / Starter / Growth / Enterprise).
--
-- IMPORTANT: Vor Apply die echten Stripe-Price-IDs aus dem Stripe-Dashboard
-- (Products) eintragen. Die internal_default_* Sentinels sind der Defacto-
-- Wechsel-Pattern aus 20260508050000_website_rebuild_product_placeholders.sql:
-- der stripe-checkout-Endpoint laeuft fuer Tiers mit Sentinel-IDs in einen
-- INTERNAL_FALLBACK statt Stripe-Checkout zu erstellen.
--
-- Anwendungsweg auf Production:
--   1. Stripe-Dashboard: Products + Prices anlegen, Price-IDs kopieren
--   2. Diese Migration kopieren -> Sentinels durch echte IDs ersetzen
--   3. Datei mit neuem Datum (heute+1) als 20260511_stripe_pricing_seed.sql
--      committen + deploy
--   4. Per supabase db push anwenden
--
-- Optional: stattdessen direkt im SQL-Editor (Supabase Dashboard) ausfuehren.
-- Idempotent dank ON CONFLICT DO NOTHING.

-- Sentinels (REPLACE_ME im finalen Migration-File):
-- price_FREE_REPLACE_ME      → Stripe-Price-ID fuer Free Audit (0 € one-time)
-- price_STARTER_REPLACE_ME   → 49 €/Monat recurring
-- price_GROWTH_REPLACE_ME    → 199 €/Monat recurring
-- price_ENT_REPLACE_ME       → Enterprise (custom, evtl. NULL fuer manual invoicing)

-- Free Audit
insert into public.products (stripe_price_id, name, default_for_plan_key, currency)
values ('price_FREE_REPLACE_ME', 'Free Audit', 'free_audit', 'eur')
on conflict (stripe_price_id) do nothing;

-- Starter
insert into public.products (stripe_price_id, name, default_for_plan_key, currency)
values ('price_STARTER_REPLACE_ME', 'Starter', 'starter', 'eur')
on conflict (stripe_price_id) do nothing;

-- Growth
insert into public.products (stripe_price_id, name, default_for_plan_key, currency)
values ('price_GROWTH_REPLACE_ME', 'Growth', 'growth', 'eur')
on conflict (stripe_price_id) do nothing;

-- Enterprise — entweder echte Price-ID oder weglassen (manual invoicing)
insert into public.products (stripe_price_id, name, default_for_plan_key, currency)
values ('price_ENT_REPLACE_ME', 'Enterprise', 'enterprise', 'eur')
on conflict (stripe_price_id) do nothing;

-- Cleanup: ggf. veraltete internal_default_* fuer dieselben plan_keys deaktivieren
-- (statt loeschen wegen FK-Integritaet auf subscriptions)
update public.products
set    is_active = false
where  default_for_plan_key in ('free_audit', 'starter', 'growth', 'enterprise')
  and  stripe_price_id like 'internal_default_%';
