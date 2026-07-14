-- Add yearly plan products to public.products table.
-- These entries allow the stripe-checkout function to resolve yearly plan price IDs.
-- Plan keys: starter_yearly, growth_yearly, agency_yearly, scale_yearly
--
-- Sentinel prices (internal_default_*_yearly) are placeholders; real Stripe
-- price_xxx IDs are injected via environment variables at build time
-- (VITE_STRIPE_PRICE_*_YEARLY) or updated directly in this table.

INSERT INTO public.products (
  default_for_plan_key,
  name,
  stripe_price_id
) VALUES
  ('starter_yearly', 'Starter (Yearly)', 'internal_default_starter_yearly'),
  ('growth_yearly', 'Growth (Yearly)', 'internal_default_growth_yearly'),
  ('agency_yearly', 'Agency (Yearly)', 'internal_default_agency_yearly'),
  ('scale_yearly', 'Scale (Yearly)', 'internal_default_scale_yearly')
ON CONFLICT (default_for_plan_key) DO NOTHING;
