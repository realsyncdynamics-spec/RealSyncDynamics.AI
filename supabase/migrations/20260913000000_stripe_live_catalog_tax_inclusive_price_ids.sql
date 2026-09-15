-- Live Stripe catalog (acct_1TYVIyREjTWueUcG, RealSync Dynamics IA, livemode).
--
-- Dominik 2026-09-13: Remap public.products to NEW active Price IDs (tax inclusive).
-- Previous mapping in 20260912055500 pointed at inactive prices (TfsV / TxLdL /
-- TntAw / U3lQN). Canonical live prices are now the UEm* series below.
--
-- Do NOT create Stripe products/prices here — only map what already exists.
--
-- Self-service checkout (stripe-checkout) uses ONLY price_* for starter/growth/agency.
-- Enterprise remains inquiry / priceOnRequest — stripe-checkout still rejects via
-- purchaseMode + ENTERPRISE_SELF_SERVICE_BLOCKED.
-- Partner (legacy Scale) is mapped for Bestandskunden / webhook resolution only
-- (normalizePlanKey maps scale→partner).
-- Governance Launch is the one-time goaieu.de price (mode=payment).
--
-- NO yearly prices exist in Stripe. Yearly rows keep non-price_* sentinels so
-- stripe-checkout returns PRICE_NOT_CONFIGURED; CheckoutPage redirects to monthly.

-- Helper: make the live price row the sole default_for_plan_key owner.
-- Clears any previous default (incl. inactive TfsV/… rows), then upserts by stripe_price_id.

-- ── Starter €79 / month ───────────────────────────────────────────────────
UPDATE public.products
   SET default_for_plan_key = NULL
 WHERE default_for_plan_key = 'starter'
   AND stripe_price_id IS DISTINCT FROM 'price_1UEmHiREjTWueUcGX2cfEi25';

INSERT INTO public.products (stripe_price_id, name, default_for_plan_key)
VALUES ('price_1UEmHiREjTWueUcGX2cfEi25', 'Starter', 'starter')
ON CONFLICT (stripe_price_id) DO UPDATE
  SET name = EXCLUDED.name,
      default_for_plan_key = EXCLUDED.default_for_plan_key;

-- ── Growth €249 / month ───────────────────────────────────────────────────
UPDATE public.products
   SET default_for_plan_key = NULL
 WHERE default_for_plan_key = 'growth'
   AND stripe_price_id IS DISTINCT FROM 'price_1UEmHmREjTWueUcGiCQMB8H4';

INSERT INTO public.products (stripe_price_id, name, default_for_plan_key)
VALUES ('price_1UEmHmREjTWueUcGiCQMB8H4', 'Growth', 'growth')
ON CONFLICT (stripe_price_id) DO UPDATE
  SET name = EXCLUDED.name,
      default_for_plan_key = EXCLUDED.default_for_plan_key;

-- ── Agency €699 / month ───────────────────────────────────────────────────
UPDATE public.products
   SET default_for_plan_key = NULL
 WHERE default_for_plan_key = 'agency'
   AND stripe_price_id IS DISTINCT FROM 'price_1UEmHoREjTWueUcGqeO4LGud';

INSERT INTO public.products (stripe_price_id, name, default_for_plan_key)
VALUES ('price_1UEmHoREjTWueUcGqeO4LGud', 'Agency', 'agency')
ON CONFLICT (stripe_price_id) DO UPDATE
  SET name = EXCLUDED.name,
      default_for_plan_key = EXCLUDED.default_for_plan_key;

-- ── Enterprise €1249 / month — catalog only, NOT self-service checkout ────
-- Live Price exists; product policy stays inquiry.
UPDATE public.products
   SET default_for_plan_key = NULL
 WHERE default_for_plan_key = 'enterprise'
   AND stripe_price_id IS DISTINCT FROM 'price_1UEmHqREjTWueUcG0oqZkb5O';

INSERT INTO public.products (stripe_price_id, name, default_for_plan_key)
VALUES (
  'price_1UEmHqREjTWueUcG0oqZkb5O',
  'Enterprise (inquiry · no self-service checkout)',
  'enterprise'
)
ON CONFLICT (stripe_price_id) DO UPDATE
  SET name = EXCLUDED.name,
      default_for_plan_key = EXCLUDED.default_for_plan_key;

-- ── Partner / Scale €1999 / month — legacy Bestand ────────────────────────
UPDATE public.products
   SET default_for_plan_key = NULL
 WHERE default_for_plan_key IN ('partner', 'scale')
   AND stripe_price_id IS DISTINCT FROM 'price_1UEmHsREjTWueUcGFlIItOiz';

INSERT INTO public.products (stripe_price_id, name, default_for_plan_key)
VALUES (
  'price_1UEmHsREjTWueUcGFlIItOiz',
  'Partner (legacy Scale)',
  'partner'
)
ON CONFLICT (stripe_price_id) DO UPDATE
  SET name = EXCLUDED.name,
      default_for_plan_key = EXCLUDED.default_for_plan_key;

-- ── Governance Launch €349 one-time (goaieu.de) ───────────────────────────
UPDATE public.products
   SET default_for_plan_key = NULL
 WHERE default_for_plan_key = 'governance_launch'
   AND stripe_price_id IS DISTINCT FROM 'price_1UEmHtREjTWueUcGhjY7Gvhp';

INSERT INTO public.products (stripe_price_id, name, default_for_plan_key)
VALUES (
  'price_1UEmHtREjTWueUcGhjY7Gvhp',
  'Governance Launch (einmalig)',
  'governance_launch'
)
ON CONFLICT (stripe_price_id) DO UPDATE
  SET name = EXCLUDED.name,
      default_for_plan_key = EXCLUDED.default_for_plan_key;

-- ── Yearly: keep non-price_* sentinels (no yearly prices in Stripe) ───────
UPDATE public.products
   SET stripe_price_id = 'STRIPE_PRICE_STARTER_YEARLY_XXX'
 WHERE default_for_plan_key = 'starter_yearly'
   AND stripe_price_id LIKE 'price_%';

UPDATE public.products
   SET stripe_price_id = 'STRIPE_PRICE_GROWTH_YEARLY_XXX'
 WHERE default_for_plan_key = 'growth_yearly'
   AND stripe_price_id LIKE 'price_%';

UPDATE public.products
   SET stripe_price_id = 'STRIPE_PRICE_AGENCY_YEARLY_XXX'
 WHERE default_for_plan_key = 'agency_yearly'
   AND stripe_price_id LIKE 'price_%';

UPDATE public.products
   SET stripe_price_id = 'STRIPE_PRICE_SCALE_YEARLY_XXX'
 WHERE default_for_plan_key IN ('partner_yearly', 'scale_yearly')
   AND stripe_price_id LIKE 'price_%';

UPDATE public.products
   SET stripe_price_id = 'STRIPE_PRICE_ENTERPRISE_YEARLY_XXX'
 WHERE default_for_plan_key = 'enterprise_yearly'
   AND stripe_price_id LIKE 'price_%';
