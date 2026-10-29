-- Korrektur zu 20261029100000_last_owner_rls_hardening.sql (#2019).
--
-- Befund: Die dort angelegten PERMISSIVE-Policies öffnen Schreibrechte,
-- die vorher nicht existierten:
--   - "subscriptions owner-write" (FOR ALL TO authenticated): Ein Owner kann
--     seine Zeile in public.subscriptions direkt per PostgREST ändern
--     (plan_id, status, …). tenant_entitlements() liest daraus — das wäre ein
--     Selbst-Upgrade ohne Zahlung. Abos schreibt ausschließlich der
--     Stripe-Webhook (service_role).
--   - "tenants owner-delete" (FOR DELETE TO authenticated): Ein Owner kann den
--     Mandanten samt Kaskaden direkt aus dem Browser löschen, an jedem
--     Offboarding-/Aufbewahrungsprozess vorbei.
-- Vorher hatten authenticated auf beiden Tabellen keine Schreib-Policy
-- (deny by default). Dieser Zustand wird wiederhergestellt.
-- Der Last-Owner-Schutz auf public.memberships (RESTRICTIVE) bleibt.

DROP POLICY IF EXISTS "subscriptions owner-write" ON public.subscriptions;
DROP POLICY IF EXISTS "tenants owner-delete" ON public.tenants;
