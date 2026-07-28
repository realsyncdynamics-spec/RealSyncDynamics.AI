-- Enterprise-Stripe-Prices in public.products einspielen (Self-Service-Checkout).
--
-- Bisher gab es fuer plan_key='enterprise'/'enterprise_yearly' KEINE Zeile in
-- public.products — die Edge Function stripe-checkout lieferte daher
-- PRICE_NOT_CONFIGURED, und CheckoutPage leitete Enterprise auf /contact-sales
-- um. Enterprise ist laut Pricing-Config aber ein self-service-Tier.
--
-- Die Prices existieren im Stripe-Account acct_1TYVIyREjTWueUcG ("RealSync
-- Dynamics IA", Produkt prod_UxG9V9clbqV7qw, livemode):
--   - enterprise         1.249 €/Monat  -> price_1TxLdLREjTWueUcGRaXie8Vs
--   - enterprise_yearly 12.490 €/Jahr   -> price_1Ty8ntREjTWueUcGJHOCMAlU
-- Betraege gegen src/config/pricing.ts verifiziert (priceEur 1249 / 12490).
--
-- stripe-checkout waehlt pro plan_key die erste stripe_price_id, die NICHT mit
-- 'internal_default_' beginnt — echte price_-IDs werden also sofort verwendet.
-- Additiv: ON CONFLICT (default_for_plan_key) DO NOTHING.

INSERT INTO public.products (stripe_price_id, name, default_for_plan_key)
VALUES
  ('price_1TxLdLREjTWueUcGRaXie8Vs', 'RealSync Dynamics Enterprise',            'enterprise'),
  ('price_1Ty8ntREjTWueUcGJHOCMAlU', 'RealSync Dynamics Enterprise (Yearly)',   'enterprise_yearly')
ON CONFLICT (default_for_plan_key) DO NOTHING;
