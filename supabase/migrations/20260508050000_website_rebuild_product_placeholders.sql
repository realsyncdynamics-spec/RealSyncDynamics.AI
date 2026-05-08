-- Placeholder-Products für DSGVO-Website-Rebuild-Tiers.
-- Sentinel stripe_price_id (internal_default_*) signalisiert dem
-- checkout-website-rebuild Edge-Function "noch nicht real wired" — die
-- Function antwortet dann mit PRICE_NOT_CONFIGURED, das Frontend zeigt
-- den Fallback-Text "bitte Beratung anfragen".
--
-- Sobald echte Stripe-Prices existieren, einfach UPDATE setzen:
--   UPDATE public.products
--      SET stripe_price_id = 'price_REAL_FROM_STRIPE'
--    WHERE default_for_plan_key = 'website_rebuild_managed';

INSERT INTO public.products (id, stripe_price_id, name, default_for_plan_key)
VALUES
  (gen_random_uuid(), 'internal_default_website_rebuild_managed',    'Website-Rebuild Managed',    'website_rebuild_managed'),
  (gen_random_uuid(), 'internal_default_website_rebuild_premium',    'Website-Rebuild Premium',    'website_rebuild_premium'),
  (gen_random_uuid(), 'internal_default_website_rebuild_enterprise', 'Website-Rebuild Enterprise', 'website_rebuild_enterprise')
ON CONFLICT DO NOTHING;
