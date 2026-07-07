-- Stripe-Price-IDs für Scale + Yearly-Plans einspielen.
--
-- Diese Migration ersetzt die Sentinel-Platzhalter für:
--   - scale (1.999 €/Monat)
--   - scale_yearly (19.000 €/Jahr)
--   - starter_yearly (790 €/Jahr)
--   - growth_yearly (2.490 €/Jahr)
--   - agency_yearly (6.900 €/Jahr)
--
-- Voraussetzung: Diese Plans müssen VORHER in Stripe Dashboard erstellt werden.
-- Die Price-IDs folgen dem Muster: price_1ABC...XYZ
--
-- Anleitung:
--   1. Öffne Stripe Dashboard → Products
--   2. Erstelle die Prices für jeden Plan:
--      - Scale: 1999 EUR/month (recurring)
--      - Scale (Yearly): 19000 EUR/year (recurring)
--      - Starter (Yearly): 790 EUR/year (recurring)
--      - Growth (Yearly): 2490 EUR/year (recurring)
--      - Agency (Yearly): 6900 EUR/year (recurring)
--   3. Kopiere die Price-IDs (price_...) in diese Migration
--   4. Ersetze die XXXXX-Platzhalter mit echten IDs
--   5. supabase db push

-- Scale (monatlich): 1.999 €
-- WICHTIG: Trage die echte Stripe Price-ID ein:
UPDATE public.products
   SET stripe_price_id = 'STRIPE_PRICE_SCALE_MONTHLY_XXX'
 WHERE default_for_plan_key = 'scale'
   AND stripe_price_id = 'internal_default_scale';

-- Scale (jährlich): 19.000 € (12 Monate zum Preis von 10 = 2-Monate-Rabatt)
UPDATE public.products
   SET stripe_price_id = 'STRIPE_PRICE_SCALE_YEARLY_XXX'
 WHERE default_for_plan_key = 'scale_yearly'
   AND stripe_price_id = 'internal_default_scale_yearly';

-- Starter (jährlich): 790 € (79 × 10)
UPDATE public.products
   SET stripe_price_id = 'STRIPE_PRICE_STARTER_YEARLY_XXX'
 WHERE default_for_plan_key = 'starter_yearly'
   AND stripe_price_id = 'internal_default_starter_yearly';

-- Growth (jährlich): 2.490 € (249 × 10)
UPDATE public.products
   SET stripe_price_id = 'STRIPE_PRICE_GROWTH_YEARLY_XXX'
 WHERE default_for_plan_key = 'growth_yearly'
   AND stripe_price_id = 'internal_default_growth_yearly';

-- Agency (jährlich): 6.900 € (699 × 10)
UPDATE public.products
   SET stripe_price_id = 'STRIPE_PRICE_AGENCY_YEARLY_XXX'
 WHERE default_for_plan_key = 'agency_yearly'
   AND stripe_price_id = 'internal_default_agency_yearly';
