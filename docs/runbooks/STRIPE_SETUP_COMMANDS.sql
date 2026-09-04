-- STRIPE CHECKOUT SETUP — SQL-Befehle
-- Kopiere diese Befehle in den Supabase SQL Editor und führe sie nacheinander aus.
-- Quelle: supabase/functions/stripe-checkout/index.ts
-- Datum: 2026-09-04

-- ──────────────────────────────────────────────────────────────────────────
-- 1. STRIPE SECRET IN DEN VAULT LEGEN
-- ──────────────────────────────────────────────────────────────────────────
-- Quelle: Stripe Dashboard → https://dashboard.stripe.com/apikeys
-- 1. Oben rechts nach „Publishable key" / „Secret key"
-- 2. Secret key kopieren (Präfix: sk_live_)
-- 3. HIER einsetzen:

SELECT public.set_app_secret('stripe_secret_key', 'sk_live_YOUR_ACTUAL_SECRET_KEY_HERE');

-- Verifizierung (sollte true zurückgeben):
SELECT public.get_app_secret('stripe_secret_key') IS NOT NULL AS "Secret ist gespeichert";


-- ──────────────────────────────────────────────────────────────────────────
-- 2. AKTUELLE PRODUKTE ANSCHAUEN (Diagnose)
-- ──────────────────────────────────────────────────────────────────────────
SELECT
  id,
  stripe_price_id,
  default_for_plan_key,
  name,
  CASE
    WHEN stripe_price_id IS NULL THEN '❌ NULL'
    WHEN stripe_price_id LIKE 'price_%' THEN '✅ LIVE'
    ELSE '⚠️  SENTINEL'
  END AS status
FROM public.products
ORDER BY default_for_plan_key;

-- Achtung: Die `stripe_price_id` muss mit `price_` beginnen!
-- Alles andere wird von der Edge Function abgelehnt.


-- ──────────────────────────────────────────────────────────────────────────
-- 3. STRIPE PRICE IDS EINTRAGEN
-- ──────────────────────────────────────────────────────────────────────────
-- Für jeden Plan: Stripe Dashboard aufsuchen, die ID kopieren und hier einsetzen.
--
-- Beispiel-Mapping (anpassen!):
-- - Starter Monatlich → price_1PKNG0IU12345678ABCD
-- - Starter Jahresabonnement → price_1PKNG0IU87654321ZYXW
-- - Growth Monatlich → price_1PKNG1IU12345678ABCD
-- - Growth Jahresabonnement → price_1PKNG1IU87654321ZYXW
-- - Enterprise Monatlich → price_1PKNG2IU12345678ABCD

-- STARTER MONATLICH
UPDATE public.products
SET stripe_price_id = 'price_1PKNG0IU12345678ABCD'
WHERE default_for_plan_key = 'starter';

-- GROWTH MONATLICH
UPDATE public.products
SET stripe_price_id = 'price_1PKNG1IU12345678ABCD'
WHERE default_for_plan_key = 'growth';

-- ENTERPRISE MONATLICH
UPDATE public.products
SET stripe_price_id = 'price_1PKNG2IU12345678ABCD'
WHERE default_for_plan_key = 'enterprise';

-- (Optional) JAHRESABONNEMENTS — falls angeboten
-- UPDATE public.products
-- SET stripe_price_id = 'price_1PKNG0IU87654321ZYXW'
-- WHERE default_for_plan_key = 'starter_yearly';


-- ──────────────────────────────────────────────────────────────────────────
-- 4. VERIFIZIERUNG — Nochmal prüfen, ob alle korrekt sind
-- ──────────────────────────────────────────────────────────────────────────
SELECT
  default_for_plan_key,
  stripe_price_id,
  CASE
    WHEN stripe_price_id LIKE 'price_%' THEN '✅'
    ELSE '❌'
  END AS valid
FROM public.products
WHERE default_for_plan_key IN ('starter', 'growth', 'enterprise')
ORDER BY default_for_plan_key;

-- Erwartet: Alle drei Zeilen zeigen ✅


-- ──────────────────────────────────────────────────────────────────────────
-- 5. OPTIONAL: Alte Sentinel-Werte anschauen (falls nötig)
-- ──────────────────────────────────────────────────────────────────────────
-- (Nur zum Debuggen, nicht notwendig für die Freigabe)
SELECT * FROM public.products
WHERE stripe_price_id LIKE 'internal%' OR stripe_price_id LIKE 'STRIPE%';
