-- Stripe Live Price IDs — acct_1TYVIyREjTWueUcG (RealSync Dynamics IA, livemode)
--
-- Canonical mapping (Dominik 2026-09-12). Prefer migration
-- `20260912055500_stripe_live_catalog_price_ids.sql` over hand-running this.
--
-- Self-service checkout: starter / growth / agency ONLY.
-- Enterprise price exists but purchaseMode=inquiry — no self-service.
-- Partner (legacy Scale) mapped for Bestand / webhook only.
-- No yearly prices in Stripe — yearly rows must stay non-price_* sentinels.

-- Starter €79 / month · prod_UY1ICcksf2MsnR
INSERT INTO public.products (stripe_price_id, name, default_for_plan_key)
VALUES ('price_1TfsV8REjTWueUcGCdOO6bT2', 'Starter', 'starter')
ON CONFLICT (stripe_price_id) DO UPDATE
  SET name = EXCLUDED.name, default_for_plan_key = EXCLUDED.default_for_plan_key;

-- Growth €249 / month · prod_UY1Ikvjy7sGXtl
INSERT INTO public.products (stripe_price_id, name, default_for_plan_key)
VALUES ('price_1TfsV4REjTWueUcGsGSfjudu', 'Growth', 'growth')
ON CONFLICT (stripe_price_id) DO UPDATE
  SET name = EXCLUDED.name, default_for_plan_key = EXCLUDED.default_for_plan_key;

-- Agency €699 / month · prod_UY1IwxkhfYlwb9
INSERT INTO public.products (stripe_price_id, name, default_for_plan_key)
VALUES ('price_1TfsV9REjTWueUcGxJIBHYgC', 'Agency', 'agency')
ON CONFLICT (stripe_price_id) DO UPDATE
  SET name = EXCLUDED.name, default_for_plan_key = EXCLUDED.default_for_plan_key;

-- Enterprise €1249 / month · prod_UxG9V9clbqV7qw — inquiry only
INSERT INTO public.products (stripe_price_id, name, default_for_plan_key)
VALUES ('price_1TxLdLREjTWueUcGRaXie8Vs', 'Enterprise (inquiry · no self-service checkout)', 'enterprise')
ON CONFLICT (stripe_price_id) DO UPDATE
  SET name = EXCLUDED.name, default_for_plan_key = EXCLUDED.default_for_plan_key;

-- Partner / Scale €1999 / month · prod_UnU98kpW1Tz49g — legacy
INSERT INTO public.products (stripe_price_id, name, default_for_plan_key)
VALUES ('price_1TntAwREjTWueUcGh3FKldMF', 'Partner (legacy Scale)', 'partner')
ON CONFLICT (stripe_price_id) DO UPDATE
  SET name = EXCLUDED.name, default_for_plan_key = EXCLUDED.default_for_plan_key;

-- Governance Launch €349 one-time · prod_V3tCqxqCh4g0mb
INSERT INTO public.products (stripe_price_id, name, default_for_plan_key)
VALUES ('price_1U3lQNREjTWueUcG6LX7WIQU', 'Governance Launch (einmalig)', 'governance_launch')
ON CONFLICT (stripe_price_id) DO UPDATE
  SET name = EXCLUDED.name, default_for_plan_key = EXCLUDED.default_for_plan_key;

-- Verify:
-- SELECT default_for_plan_key, stripe_price_id, name
-- FROM public.products
-- WHERE default_for_plan_key IN (
--   'starter','growth','agency','enterprise','partner','governance_launch'
-- )
-- ORDER BY default_for_plan_key;
