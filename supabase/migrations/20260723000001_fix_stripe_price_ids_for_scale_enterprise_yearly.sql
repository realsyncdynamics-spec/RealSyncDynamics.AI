-- Fix: Replace placeholder price IDs with proper Stripe Price IDs or sentinels.
--
-- Background:
--   Migration 20260707100000 inserted placeholder values (STRIPE_PRICE_SCALE_MONTHLY_XXX, etc.)
--   These placeholders don't match the "real Stripe price" pattern (price_1...) nor the
--   sentinel pattern (internal_default_*), causing stripe-checkout to fail with 400 PRICE_NOT_CONFIGURED.
--
-- Solution:
--   1. Replace placeholders with internal_default_* sentinels (temp placeholder until real IDs available)
--   2. Add Enterprise product with internal_default_enterprise sentinel
--   3. Document where the REAL Stripe Price IDs need to be injected via separate UPDATE
--
-- Next Steps (for ops):
--   1. Create these products in Stripe Dashboard (Products → Create):
--      - Scale (Partner): 1.999 €/month recurring
--      - Scale (Yearly): 19.000 €/year recurring
--      - Starter (Yearly): 790 €/year recurring
--      - Growth (Yearly): 2.490 €/year recurring
--      - Agency (Yearly): 6.900 €/year recurring
--      - Enterprise: 1.249 €/month recurring
--   2. Copy the price_* IDs from Stripe Dashboard
--   3. Run these UPDATEs to wire them:
--      UPDATE public.products SET stripe_price_id = 'price_...' WHERE default_for_plan_key = 'scale';
--      UPDATE public.products SET stripe_price_id = 'price_...' WHERE default_for_plan_key = 'scale_yearly';
--      UPDATE public.products SET stripe_price_id = 'price_...' WHERE default_for_plan_key = 'starter_yearly';
--      UPDATE public.products SET stripe_price_id = 'price_...' WHERE default_for_plan_key = 'growth_yearly';
--      UPDATE public.products SET stripe_price_id = 'price_...' WHERE default_for_plan_key = 'agency_yearly';
--      UPDATE public.products SET stripe_price_id = 'price_...' WHERE default_for_plan_key = 'enterprise';

-- ─── Wire Scale (monatlich): 1.999 € ─────────────────────────────────────────
-- Real Stripe Price ID from Stripe Dashboard (Product: prod_UnU98kpW1Tz49g)
UPDATE public.products
   SET stripe_price_id = 'price_1TntAwREjTWueUcGh3FKldMF'
 WHERE default_for_plan_key = 'scale'
   AND stripe_price_id = 'STRIPE_PRICE_SCALE_MONTHLY_XXX';

-- ─── Fix Scale (jährlich): 19.000 € ──────────────────────────────────────────
UPDATE public.products
   SET stripe_price_id = 'internal_default_scale_yearly'
 WHERE default_for_plan_key = 'scale_yearly'
   AND stripe_price_id = 'STRIPE_PRICE_SCALE_YEARLY_XXX';

-- ─── Fix Starter (jährlich): 790 € ───────────────────────────────────────────
-- Replace placeholder with proper sentinel (migration 20260707045811 already inserted the sentinel,
-- but if the UPDATE ran and left a placeholder, fix it here)
UPDATE public.products
   SET stripe_price_id = 'internal_default_starter_yearly'
 WHERE default_for_plan_key = 'starter_yearly'
   AND stripe_price_id = 'STRIPE_PRICE_STARTER_YEARLY_XXX';

-- ─── Fix Growth (jährlich): 2.490 € ──────────────────────────────────────────
UPDATE public.products
   SET stripe_price_id = 'internal_default_growth_yearly'
 WHERE default_for_plan_key = 'growth_yearly'
   AND stripe_price_id = 'STRIPE_PRICE_GROWTH_YEARLY_XXX';

-- ─── Fix Agency (jährlich): 6.900 € ──────────────────────────────────────────
UPDATE public.products
   SET stripe_price_id = 'internal_default_agency_yearly'
 WHERE default_for_plan_key = 'agency_yearly'
   AND stripe_price_id = 'STRIPE_PRICE_AGENCY_YEARLY_XXX';

-- ─── Add Enterprise (1.249 €/Monat): Sentinel (manual invoicing) ──────────────
-- Enterprise is sold via /contact-sales, not self-service checkout.
-- The sentinel value prevents stripe-checkout from attempting a Stripe API call.
-- Once a real Stripe price is created, replace 'internal_default_enterprise' with 'price_...'
INSERT INTO public.products (default_for_plan_key, name, stripe_price_id)
VALUES ('enterprise', 'Enterprise (1.249 €/Monat)', 'internal_default_enterprise')
ON CONFLICT (default_for_plan_key) DO UPDATE
   SET stripe_price_id = 'internal_default_enterprise'
 WHERE public.products.default_for_plan_key = 'enterprise';

-- ─── Verification ────────────────────────────────────────────────────────────
-- After this migration, run:
--   SELECT default_for_plan_key, stripe_price_id, name
--   FROM public.products
--   WHERE default_for_plan_key IN ('starter','growth','agency','enterprise','scale','starter_yearly','growth_yearly','agency_yearly','scale_yearly')
--   ORDER BY default_for_plan_key;
--
-- Expected output:
--   agency                  | price_1TfsV9REjTWueUcGxJIBHYgC           | Agency
--   agency_yearly           | internal_default_agency_yearly          | Agency (Jährlich)
--   enterprise              | internal_default_enterprise             | Enterprise (1.249 €/Monat)
--   growth                  | price_1TfsV4REjTWueUcGsGSfjudu          | Growth
--   growth_yearly           | internal_default_growth_yearly          | Growth (Jährlich)
--   scale                   | internal_default_scale                  | Partner
--   scale_yearly            | internal_default_scale_yearly           | Partner (Jährlich)
--   starter                 | price_1TfsV8REjTWueUcGCdOO6bT2          | Starter
--   starter_yearly          | internal_default_starter_yearly         | Starter (Jährlich)
