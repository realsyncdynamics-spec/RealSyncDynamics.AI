-- Stripe Live Price IDs — acct_1TYVIyREjTWueUcG (RealSync Dynamics IA, livemode)
--
-- Canonical mapping (Dominik 2026-09-13). Prefer migration
-- `20260913000000_stripe_live_catalog_tax_inclusive_price_ids.sql` over hand-running this.
--
-- UEm* Price IDs are canonical: ACTIVE, tax inclusive.
-- Previous TfsV / TxLdL / TntAw / U3lQN IDs are inactive — do not re-seed them.
--
-- Self-service checkout: starter / growth / agency ONLY.
-- Enterprise price exists but purchaseMode=inquiry — no self-service.
-- Partner (legacy Scale) mapped for Bestand / webhook only.
-- No yearly prices in Stripe — yearly rows must stay non-price_* sentinels.

-- Starter €79 / month
INSERT INTO public.products (stripe_price_id, name, default_for_plan_key)
VALUES ('price_1UEmHiREjTWueUcGX2cfEi25', 'Starter', 'starter')
ON CONFLICT (stripe_price_id) DO UPDATE
  SET name = EXCLUDED.name, default_for_plan_key = EXCLUDED.default_for_plan_key;

-- Growth €249 / month
INSERT INTO public.products (stripe_price_id, name, default_for_plan_key)
VALUES ('price_1UEmHmREjTWueUcGiCQMB8H4', 'Growth', 'growth')
ON CONFLICT (stripe_price_id) DO UPDATE
  SET name = EXCLUDED.name, default_for_plan_key = EXCLUDED.default_for_plan_key;

-- Agency €699 / month
INSERT INTO public.products (stripe_price_id, name, default_for_plan_key)
VALUES ('price_1UEmHoREjTWueUcGqeO4LGud', 'Agency', 'agency')
ON CONFLICT (stripe_price_id) DO UPDATE
  SET name = EXCLUDED.name, default_for_plan_key = EXCLUDED.default_for_plan_key;

-- Enterprise €1249 / month — inquiry only
INSERT INTO public.products (stripe_price_id, name, default_for_plan_key)
VALUES ('price_1UEmHqREjTWueUcG0oqZkb5O', 'Enterprise (inquiry · no self-service checkout)', 'enterprise')
ON CONFLICT (stripe_price_id) DO UPDATE
  SET name = EXCLUDED.name, default_for_plan_key = EXCLUDED.default_for_plan_key;

-- Partner / Scale €1999 / month — legacy
INSERT INTO public.products (stripe_price_id, name, default_for_plan_key)
VALUES ('price_1UEmHsREjTWueUcGFlIItOiz', 'Partner (legacy Scale)', 'partner')
ON CONFLICT (stripe_price_id) DO UPDATE
  SET name = EXCLUDED.name, default_for_plan_key = EXCLUDED.default_for_plan_key;

-- Governance Launch €349 one-time
INSERT INTO public.products (stripe_price_id, name, default_for_plan_key)
VALUES ('price_1UEmHtREjTWueUcGhjY7Gvhp', 'Governance Launch (einmalig)', 'governance_launch')
ON CONFLICT (stripe_price_id) DO UPDATE
  SET name = EXCLUDED.name, default_for_plan_key = EXCLUDED.default_for_plan_key;

-- Verify:
-- SELECT default_for_plan_key, stripe_price_id, name
-- FROM public.products
-- WHERE default_for_plan_key IN (
--   'starter','growth','agency','enterprise','partner','governance_launch'
-- )
-- ORDER BY default_for_plan_key;
