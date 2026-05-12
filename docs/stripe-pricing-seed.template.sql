-- Stripe-Real-Price-IDs fuer die 4 Pricing-Tiers (Free / Starter / Growth / Agency / Enterprise).
--
-- IMPORTANT: Vor Apply die echten Stripe-Price-IDs aus dem Stripe-Dashboard
-- (Products) eintragen. Free + Enterprise brauchen keine Stripe-Price (Free
-- = Kein Charge, Enterprise = manual invoicing via /contact-sales).
--
-- Schema-Stand 2026-05-10 (verifiziert via Supabase MCP):
--   public.products columns: id (uuid), stripe_price_id (text),
--                            name (text), default_for_plan_key (text),
--                            created_at (timestamptz)
--   KEINE Spalten: currency, is_active, recurring, etc.
--
-- Anwendungsweg:
--   1. Stripe-Dashboard (Test-Mode oder Live): 3 Products + Prices anlegen
--      - Starter: 79 € / Monat recurring
--      - Growth:  249 € / Monat recurring
--      - Agency:  699 € / Monat recurring
--   2. Diese Datei kopieren -> price_REPLACE_*_ID durch echte IDs ersetzen
--   3. Im Supabase-SQL-Editor ausfuehren (oder als Migration committen)
--
-- Idempotent dank ON CONFLICT (stripe_price_id) DO NOTHING.

-- ─── Starter (79 €/Monat) ────────────────────────────────────────────────────
INSERT INTO public.products (stripe_price_id, name, default_for_plan_key)
VALUES ('price_REPLACE_STARTER_ID', 'Starter', 'starter')
ON CONFLICT (stripe_price_id) DO NOTHING;

-- ─── Growth (249 €/Monat) ────────────────────────────────────────────────────
INSERT INTO public.products (stripe_price_id, name, default_for_plan_key)
VALUES ('price_REPLACE_GROWTH_ID', 'Growth', 'growth')
ON CONFLICT (stripe_price_id) DO NOTHING;

-- ─── Agency (699 €/Monat) ────────────────────────────────────────────────────
INSERT INTO public.products (stripe_price_id, name, default_for_plan_key)
VALUES ('price_REPLACE_AGENCY_ID', 'Agency', 'agency')
ON CONFLICT (stripe_price_id) DO NOTHING;

-- ─── Free (kein Stripe-Charge, Sentinel) ─────────────────────────────────────
-- Wenn 'free' Plan-Key im Code-Pfad genutzt wird, sorgt der Sentinel-Eintrag
-- dafuer dass die Edge-Function NICHT in Stripe-API-Call laeuft.
INSERT INTO public.products (stripe_price_id, name, default_for_plan_key)
VALUES ('internal_default_free_audit', 'Free Audit (sentinel)', 'free')
ON CONFLICT (stripe_price_id) DO NOTHING;

-- ─── Enterprise (manual invoicing, Sentinel) ─────────────────────────────────
INSERT INTO public.products (stripe_price_id, name, default_for_plan_key)
VALUES ('internal_default_enterprise', 'Enterprise (sentinel · manual invoicing)', 'enterprise')
ON CONFLICT (stripe_price_id) DO NOTHING;

-- ─── Verifikation nach dem Insert ────────────────────────────────────────────
-- SELECT default_for_plan_key, stripe_price_id, name
-- FROM public.products
-- WHERE default_for_plan_key IN ('free','starter','growth','agency','enterprise')
-- ORDER BY default_for_plan_key;
--
-- Erwartete 5 Rows:
--   agency      price_1...
--   enterprise  internal_default_enterprise
--   free        internal_default_free_audit
--   growth      price_1...
--   starter     price_1...
