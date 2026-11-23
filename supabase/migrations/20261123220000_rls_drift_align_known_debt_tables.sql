-- Drift-Abgleich: RLS fuer die acht Tabellen der "BEKANNTEN SCHULD" (F-08).
--
-- Ausgangslage (NOVA-Baseline 23.11.2026, Befund H1/M2):
-- Das Repo legt diese Tabellen ohne `ENABLE ROW LEVEL SECURITY` an. Ein
-- Neuaufbau aus dem Repo (CI, Staging, Notfall-Wiederherstellung) hat sie
-- daher offen fuer anon/authenticated.
--
-- Produktion ist bereits gehaertet (gemessen 23.11.2026, 21:54 MEZ, lesend):
--   - alle acht: relrowsecurity = true
--   - _circuit_breakers, _operation_metrics, _rate_limits,
--     memory_retention_policies, seo_marketing_audit_log,
--     social_publishing_metrics_hourly: Tabellenrechte nur postgres und
--     service_role, keine Policy (service-role-only)
--   - provenance_records, subscription_addons: Policy "<tabelle> deny_all"
--     (USING false / WITH CHECK false, aus 20260506170000); Grants an anon und
--     authenticated bestehen, greifen wegen deny_all aber nicht.
--
-- Diese Migration schreibt genau diesen Zustand ins Repo zurueck. Auf
-- Produktion ist jeder Schritt ein No-op (ENABLE RLS und REVOKE sind
-- idempotent; die Grants der beiden deny_all-Tabellen bleiben unveraendert).
-- Kein DROP, keine Datenaenderung.
--
-- DO-Bloecke mit undefined_table-Abfang wie in 20260506170000: Einzelne
-- Tabellen koennen in einem frischen CI-Bootstrap fehlen.

-- 1. Interne Tabellen: RLS an, keine Policy, nur service_role
DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    '_circuit_breakers',
    '_operation_metrics',
    '_rate_limits',
    'memory_retention_policies',
    'seo_marketing_audit_log',
    'social_publishing_metrics_hourly'
  ] LOOP
    BEGIN
      EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
      EXECUTE format('REVOKE ALL ON TABLE public.%I FROM anon, authenticated, public', t);
      EXECUTE format('GRANT ALL ON TABLE public.%I TO service_role', t);
    EXCEPTION WHEN undefined_table THEN
      RAISE NOTICE 'Tabelle public.% fehlt in dieser Umgebung, uebersprungen', t;
    END;
  END LOOP;
END $$;

-- 2. Tabellen mit deny_all-Policy: RLS an, Policy sicherstellen
DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['provenance_records', 'subscription_addons'] LOOP
    BEGIN
      EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
      IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'public'
          AND tablename = t
          AND policyname = t || ' deny_all'
      ) THEN
        EXECUTE format(
          'CREATE POLICY %I ON public.%I FOR ALL USING (false) WITH CHECK (false)',
          t || ' deny_all', t);
      END IF;
    EXCEPTION WHEN undefined_table THEN
      RAISE NOTICE 'Tabelle public.% fehlt in dieser Umgebung, uebersprungen', t;
    END;
  END LOOP;
END $$;
