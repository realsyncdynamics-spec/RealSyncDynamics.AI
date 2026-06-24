-- Stripe-Live-Price-IDs für Starter/Growth/Agency einspielen.
--
-- Ersetzt die Sentinel-Platzhalter aus 20260618000000_pricing_tier_alignment.sql
-- durch die echten, im Stripe-Account (acct_1TYVIyREjTWueUcG, "RealSync
-- Dynamics IA") angelegten Price-IDs. Beträge gegen src/config/pricing.ts
-- verifiziert: Starter 79€, Growth 249€, Agency 699€ / Monat.
--
-- stripe-checkout (supabase/functions/stripe-checkout/index.ts) wählt pro
-- plan_key automatisch die erste stripe_price_id, die NICHT mit
-- 'internal_default_' beginnt — daher reicht ein additives UPDATE.

UPDATE public.products
   SET stripe_price_id = 'price_1TfsV8REjTWueUcGCdOO6bT2'
 WHERE default_for_plan_key = 'starter'
   AND stripe_price_id = 'internal_default_starter';

UPDATE public.products
   SET stripe_price_id = 'price_1TfsV4REjTWueUcGsGSfjudu'
 WHERE default_for_plan_key = 'growth'
   AND stripe_price_id = 'internal_default_growth';

UPDATE public.products
   SET stripe_price_id = 'price_1TfsV9REjTWueUcGxJIBHYgC'
 WHERE default_for_plan_key = 'agency'
   AND stripe_price_id = 'internal_default_agency';
