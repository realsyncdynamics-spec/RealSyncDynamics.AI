-- Stripe-Pilot-Price-IDs fuer Agency Pilot (Multi-Website Governance Monitoring).
--
-- IMPORTANT: Vor Apply die echten Stripe-Price-IDs aus dem Stripe-Dashboard
-- (Products) eintragen. Drei SKUs, alle in EUR, Pilot-Scope nur:
--
--   1. Agency Pilot Small     —   499 €    einmalig   (5 Mandanten-Websites)
--   2. Agency Pilot Large     — 1.500 €    einmalig   (bis 20 Mandanten-Websites)
--   3. Agency Pilot Sub       —   299 €/Monat recurring, 3 Cycles
--      (Stripe: subscription mit cancel_at = now + 3 months ODER
--       price + cycle-cap im Checkout-Session-Code)
--
-- Schema-Stand: gleiches Schema wie docs/stripe-pricing-seed.template.sql
--   public.products columns: id (uuid), stripe_price_id (text),
--                            name (text), default_for_plan_key (text),
--                            created_at (timestamptz)
--
-- Anwendungsweg:
--   1. Stripe-Dashboard (Test-Mode zuerst, Live erst nach Pilot-Vertrag):
--      Drei Products + Prices anlegen, IDs notieren.
--   2. Diese Datei kopieren -> price_REPLACE_*_ID durch echte IDs ersetzen
--   3. Im Supabase-SQL-Editor ausfuehren (oder als Migration committen).
--   4. Stripe-Dashboard -> Settings -> Public details:
--      Support email = support@realsyncdynamicsai.de
--      Public business name = RealSync Dynamics
--      Statement descriptor = REALSYNC PILOT (max 22 chars)
--
-- Idempotent dank ON CONFLICT (stripe_price_id) DO NOTHING.

-- ─── Agency Pilot Small (499 € einmalig, 5 Sites) ────────────────────────────
INSERT INTO public.products (stripe_price_id, name, default_for_plan_key)
VALUES ('price_REPLACE_AGENCY_PILOT_SMALL_ID',
        'Agency Pilot Small (5 Mandanten-Websites, 14 Tage)',
        'agency_pilot_small')
ON CONFLICT (stripe_price_id) DO NOTHING;

-- ─── Agency Pilot Large (1.500 € einmalig, bis 20 Sites) ─────────────────────
INSERT INTO public.products (stripe_price_id, name, default_for_plan_key)
VALUES ('price_REPLACE_AGENCY_PILOT_LARGE_ID',
        'Agency Pilot Large (bis 20 Mandanten-Websites, 14 Tage)',
        'agency_pilot_large')
ON CONFLICT (stripe_price_id) DO NOTHING;

-- ─── Agency Pilot Sub (299 €/Monat, 3 Zyklen) ────────────────────────────────
-- Stripe: Recurring price, monthly. Cycle-Cap auf 3 wird im
-- Checkout-Session-Code gesetzt (subscription_data.cancel_at oder
-- billing_cycle_anchor + cancellation_details).
INSERT INTO public.products (stripe_price_id, name, default_for_plan_key)
VALUES ('price_REPLACE_AGENCY_PILOT_SUB_ID',
        'Agency Pilot Subscription (299 €/Monat, 3 Zyklen)',
        'agency_pilot_sub')
ON CONFLICT (stripe_price_id) DO NOTHING;

-- ─── Verifikation nach dem Insert ────────────────────────────────────────────
-- SELECT default_for_plan_key, stripe_price_id, name
-- FROM public.products
-- WHERE default_for_plan_key LIKE 'agency_pilot%'
-- ORDER BY default_for_plan_key;
--
-- Erwartete 3 Rows:
--   agency_pilot_large  price_1...
--   agency_pilot_small  price_1...
--   agency_pilot_sub    price_1...
