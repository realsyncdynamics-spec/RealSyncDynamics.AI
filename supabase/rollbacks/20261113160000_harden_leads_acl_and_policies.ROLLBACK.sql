-- Rollback zu 20261113160000_harden_leads_acl_and_policies.sql
-- Stellt den Stand nach P0 v2.1 wieder her (Policies auf is_super_admin,
-- volle relacl für anon/authenticated, kein FORCE RLS).
-- is_platform_operator bleibt ohne anon-EXECUTE, wie von P0 v2.1 gesetzt.
-- gdpr_audits.tenant_read bleibt unangetastet.
-- Nicht live anwenden ohne Freigabe.

BEGIN;

DROP FUNCTION IF EXISTS public.admin_sales_leads(integer);
DROP FUNCTION IF EXISTS public.admin_gdpr_audits(integer);

ALTER TABLE public.sales_leads NO FORCE ROW LEVEL SECURITY;
ALTER TABLE public.gdpr_audits NO FORCE ROW LEVEL SECURITY;
ALTER TABLE public.newsletter_subscribers NO FORCE ROW LEVEL SECURITY;
ALTER TABLE public.waitlist_signups NO FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "sales_leads operator_read" ON public.sales_leads;
CREATE POLICY "sales_leads super_admin_read"
  ON public.sales_leads FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid() AND p.is_super_admin = true
  ));

DROP POLICY IF EXISTS "newsletter operator_read" ON public.newsletter_subscribers;
CREATE POLICY "newsletter super_admin_read"
  ON public.newsletter_subscribers FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid() AND p.is_super_admin = true
  ));

DROP POLICY IF EXISTS "waitlist operator_read" ON public.waitlist_signups;
CREATE POLICY "waitlist super_admin_read"
  ON public.waitlist_signups FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid() AND p.is_super_admin = true
  ));
CREATE POLICY "waitlist super_admin_update"
  ON public.waitlist_signups FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid() AND p.is_super_admin = true
  ));

DROP POLICY IF EXISTS "gdpr_audits operator_read" ON public.gdpr_audits;
CREATE POLICY "gdpr_audits super_admin_read"
  ON public.gdpr_audits FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid() AND p.is_super_admin = true
  ));
-- tenant_read wurde nicht entfernt und bleibt unangetastet.

GRANT ALL
  ON TABLE public.sales_leads,
           public.gdpr_audits,
           public.newsletter_subscribers,
           public.waitlist_signups
  TO PUBLIC, anon, authenticated;

-- Nicht zurück auf den Vor-P0-Stand: anon behält kein EXECUTE (P0 v2.1).
REVOKE ALL ON FUNCTION public.is_platform_operator() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_platform_operator() TO authenticated, service_role;

COMMIT;
