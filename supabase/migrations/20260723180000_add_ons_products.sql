-- Add-ons Product Registration
-- Migration: 2026-07-23 18:00:00
--
-- Registers pricing add-ons (response packs, channel extensions, voice bots)
-- as Stripe products. Adds is_addon column to products table for filtering.

-- Add is_addon column to products table
ALTER TABLE IF EXISTS public.products
ADD COLUMN IF NOT EXISTS is_addon BOOLEAN DEFAULT false;

-- Register response pack add-on
INSERT INTO public.products (stripe_price_id, name, is_addon, created_at)
VALUES (
  'price_internal_addon_response_pack_5k',
  'Response Pack 5K',
  true,
  now()
)
ON CONFLICT (stripe_price_id) DO NOTHING;

-- Register WhatsApp channel add-on
INSERT INTO public.products (stripe_price_id, name, is_addon, created_at)
VALUES (
  'price_internal_addon_whatsapp_channel',
  'WhatsApp Bot Extension',
  true,
  now()
)
ON CONFLICT (stripe_price_id) DO NOTHING;

-- Register voice bot add-on
INSERT INTO public.products (stripe_price_id, name, is_addon, created_at)
VALUES (
  'price_internal_addon_voice_bot',
  'Voice Bot Add-on',
  true,
  now()
)
ON CONFLICT (stripe_price_id) DO NOTHING;

-- Register SMS channel add-on
INSERT INTO public.products (stripe_price_id, name, is_addon, created_at)
VALUES (
  'price_internal_addon_sms_channel',
  'SMS Channel Extension',
  true,
  now()
)
ON CONFLICT (stripe_price_id) DO NOTHING;

-- Register dedicated IP add-on
INSERT INTO public.products (stripe_price_id, name, is_addon, created_at)
VALUES (
  'price_internal_addon_dedicated_ip',
  'Dedicated IP Address',
  true,
  now()
)
ON CONFLICT (stripe_price_id) DO NOTHING;

-- Register priority support add-on
INSERT INTO public.products (stripe_price_id, name, is_addon, created_at)
VALUES (
  'price_internal_addon_priority_support',
  'Priority Support Package',
  true,
  now()
)
ON CONFLICT (stripe_price_id) DO NOTHING;

-- Add index for efficient add-on queries
CREATE INDEX IF NOT EXISTS idx_products_is_addon
  ON public.products(is_addon)
  WHERE is_addon = true;
