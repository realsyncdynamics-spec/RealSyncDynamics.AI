-- Stripe Live Price IDs — acct_1TYVIyREjTWueUcG (livemode)
-- Canonical: migration 20260913000000 (UEm* = ACTIVE, tax inclusive).
-- Prefer that migration over hand-running this. Do not re-seed inactive TfsV/… IDs.
-- Self-service: starter/growth/agency only. Enterprise=inquiry. No yearly prices.

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
