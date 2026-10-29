-- Tenant-Spaltenschutz (#1381, Inventar #2058).
--
-- Befund: Policy "tenants owner-update" (20260430180000) erlaubt einem Owner
-- UPDATE auf ALLE Spalten von public.tenants direkt per PostgREST — inkl.
-- trial_expires_at, partner_id, custom_domain, billing_email,
-- auto_invoice_passthrough, claimed_at, run_count. RLS filtert nur Zeilen,
-- nicht Spalten. Gleiches Muster wie der #2019-Befund (korrigiert in #2056).
--
-- Änderung: Die Zeilen-Policy bleibt (nur Owner, nur eigener Mandant).
-- Zusätzlich wird das Tabellen-UPDATE-Privileg für anon/authenticated
-- entzogen und nur für die Profilspalten wieder vergeben, die das Frontend
-- heute legitim schreibt (activationApi, SetupAssistant, tenantProfileService,
-- PolicyPacksView, AiResidencySettings). Alle übrigen Spalten schreibt
-- ausschließlich service_role (Edge Functions, Webhooks, Partner-Provisioning,
-- tenant-branding-update).
--
-- Spalten, die es in einer Umgebung nicht gibt, werden übersprungen, damit
-- die Migration auf allen Ständen idempotent läuft.

REVOKE UPDATE ON public.tenants FROM PUBLIC, anon, authenticated;

DO $$
DECLARE
  col text;
  allowed text[] := ARRAY[
    'company_name',
    'org_name',
    'tenant_type',
    'org_size_employees',
    'industry',
    'company_size',
    'ai_data_residency_policy',
    'onboarded_at'
  ];
BEGIN
  FOREACH col IN ARRAY allowed LOOP
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = 'tenants' AND column_name = col
    ) THEN
      EXECUTE format('GRANT UPDATE (%I) ON public.tenants TO authenticated', col);
    END IF;
  END LOOP;
END
$$;
