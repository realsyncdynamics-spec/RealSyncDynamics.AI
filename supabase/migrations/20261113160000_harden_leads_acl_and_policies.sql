-- =============================================================================
-- P1: Lead-PII härten — eine Vertrauensquelle (is_platform_operator),
-- schmale Grants, FORCE RLS, Operator-RPCs für die Roh-Tabs.
--
-- Draft, nicht live anwenden. Rollback: 20261113160000_harden_leads_acl_and_policies.ROLLBACK.sql
-- Gestapelt auf P0 v2.1 (anon hat auf is_platform_operator bereits kein EXECUTE
-- mehr, sobald v2.1 gilt; hier festgezogen). gdpr_audits.tenant_read bleibt
-- unverändert und wird in dieser Migration weder entfernt noch neu angelegt.
-- =============================================================================

BEGIN;

-- ---------- Policies: eine Vertrauensquelle --------------------------------
DROP POLICY IF EXISTS "sales_leads super_admin_read" ON public.sales_leads;
CREATE POLICY "sales_leads operator_read"
  ON public.sales_leads
  FOR SELECT
  TO authenticated
  USING (public.is_platform_operator());

DROP POLICY IF EXISTS "newsletter super_admin_read" ON public.newsletter_subscribers;
CREATE POLICY "newsletter operator_read"
  ON public.newsletter_subscribers
  FOR SELECT
  TO authenticated
  USING (public.is_platform_operator());

DROP POLICY IF EXISTS "waitlist super_admin_read" ON public.waitlist_signups;
CREATE POLICY "waitlist operator_read"
  ON public.waitlist_signups
  FOR SELECT
  TO authenticated
  USING (public.is_platform_operator());

DROP POLICY IF EXISTS "waitlist super_admin_update" ON public.waitlist_signups;
-- Schreibzugriff bleibt über service_role / DEFINER-RPCs, nicht über Client-UPDATE.

DROP POLICY IF EXISTS "gdpr_audits super_admin_read" ON public.gdpr_audits;
CREATE POLICY "gdpr_audits operator_read"
  ON public.gdpr_audits
  FOR SELECT
  TO authenticated
  USING (public.is_platform_operator());

-- tenant_read BLEIBT. Begründung (siehe PR-TEXT / NOTES):
-- Die Policy lautet
--   tenant_id IS NOT NULL AND public.is_tenant_member(tenant_id)
-- und is_tenant_member prüft ausschließlich
--   memberships.tenant_id = p_tenant_id AND memberships.user_id = auth.uid().
-- Anonyme Zeilen (tenant_id IS NULL) sind unsichtbar (is_tenant_member(NULL)
-- wäre NULL, nicht false — der explizite IS NOT NULL-Guard schließt das).
-- Kein Zugriff auf die globale Operator-Liste. Mitglieder sehen nur
-- beanspruchte Audits des eigenen Mandanten (inkl. E-Mail) — produktseitig
-- der Anspruch-Pfad, nicht der Admin-Pfad. Deshalb nicht entfernen.
-- (Die Policy existierte bereits; hier nur bestätigt, nicht umgeschrieben.)

-- ---------- Grants: keine vollen DML-Rechte mehr für anon/PUBLIC ------------
REVOKE ALL ON TABLE public.sales_leads,
                public.gdpr_audits,
                public.newsletter_subscribers,
                public.waitlist_signups
  FROM PUBLIC, anon;

REVOKE ALL ON TABLE public.sales_leads,
                public.gdpr_audits,
                public.newsletter_subscribers,
                public.waitlist_signups
  FROM authenticated;

GRANT SELECT ON TABLE public.sales_leads,
                      public.gdpr_audits,
                      public.newsletter_subscribers,
                      public.waitlist_signups
  TO authenticated;

GRANT ALL ON TABLE public.sales_leads,
                  public.gdpr_audits,
                  public.newsletter_subscribers,
                  public.waitlist_signups
  TO service_role;

-- ---------- FORCE RLS -------------------------------------------------------
-- Wirkt auf den Tabelleneigentümer, nicht auf Superuser und nicht auf Rollen
-- mit BYPASSRLS (service_role im Localtest / typisch auch Supabase-postgres).
-- DEFINER-RPCs, die als postgres (Superuser) laufen, bleiben davon unberührt.
-- Geprüft im Localtest; siehe Testbericht.
ALTER TABLE public.sales_leads FORCE ROW LEVEL SECURITY;
ALTER TABLE public.gdpr_audits FORCE ROW LEVEL SECURITY;
ALTER TABLE public.newsletter_subscribers FORCE ROW LEVEL SECURITY;
ALTER TABLE public.waitlist_signups FORCE ROW LEVEL SECURITY;

-- ---------- is_platform_operator: kein anon-EXECUTE -------------------------
REVOKE ALL ON FUNCTION public.is_platform_operator() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_platform_operator() TO authenticated, service_role;

-- admin_* festziehen (bereits ohne anon, idempotent)
REVOKE ALL ON FUNCTION public.admin_funnel_leads(text, integer) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_funnel_kpis(integer) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_erase_lead_data(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_funnel_leads(text, integer) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.admin_funnel_kpis(integer) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.admin_erase_lead_data(text) TO authenticated, service_role;

-- ---------- Operator-RPCs für die Roh-Tabs (ersetzen Client-SELECT) ---------
CREATE OR REPLACE FUNCTION public.admin_sales_leads(p_limit integer DEFAULT 500)
RETURNS TABLE (
  id uuid,
  name text,
  email text,
  company text,
  use_case text,
  message text,
  source text,
  path text,
  created_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $fn$
BEGIN
  IF NOT public.is_platform_operator() THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY
  SELECT sl.id, sl.name, sl.email, sl.company, sl.use_case, sl.message,
         sl.source, sl.path, sl.created_at
    FROM public.sales_leads sl
   ORDER BY sl.created_at DESC
   LIMIT GREATEST(1, LEAST(COALESCE(p_limit, 500), 500));
END;
$fn$;

CREATE OR REPLACE FUNCTION public.admin_gdpr_audits(p_limit integer DEFAULT 500)
RETURNS TABLE (
  id uuid,
  url text,
  domain text,
  email text,
  company text,
  score integer,
  severity text,
  fetched_status integer,
  created_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $fn$
BEGIN
  IF NOT public.is_platform_operator() THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY
  SELECT g.id, g.url, g.domain, g.email, g.company, g.score, g.severity,
         g.fetched_status, g.created_at
    FROM public.gdpr_audits g
   ORDER BY g.created_at DESC
   LIMIT GREATEST(1, LEAST(COALESCE(p_limit, 500), 500));
END;
$fn$;

REVOKE ALL ON FUNCTION public.admin_sales_leads(integer) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_gdpr_audits(integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_sales_leads(integer) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.admin_gdpr_audits(integer) TO authenticated, service_role;

COMMIT;
