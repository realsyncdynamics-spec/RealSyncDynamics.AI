-- Additive Layout-Tabelle für das automatische Cockpit (Produktbereich E).
--
-- NICHT anwenden, bevor Dominik die Migration ausdrücklich freigibt.
-- Diese Datei liegt dem Draft-PR I-2 nur als vorbereiteter Stand bei. NICHT anwenden.
-- Kein Ersatz für public.dashboard_user_preferences (bestehende User-Prefs).
-- Mitgliedschaft kanonisch über public.memberships / is_tenant_member(),
-- nicht über public.tenant_memberships (Security-Fix-Plan Abschnitt 3, P1-3).

CREATE TABLE IF NOT EXISTS public.dashboard_layouts (
  tenant_id uuid PRIMARY KEY REFERENCES public.tenants(id) ON DELETE CASCADE,
  plan_key text,
  source text NOT NULL DEFAULT 'auto' CHECK (source IN ('auto', 'user')),
  -- JSON-Array von Widget-IDs aus dem Code-Katalog
  -- (src/features/dashboard/widget-registry/catalog.ts). Keine freien IDs
  -- ohne Registry-Eintrag schreiben.
  widgets jsonb NOT NULL DEFAULT '[]'::jsonb,
  generated_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES auth.users(id)
);

COMMENT ON TABLE public.dashboard_layouts IS
  'Ein Layout je Mandant für das automatische Cockpit. Quelle auto = aus Entitlements generiert, user = von Owner/Admin angepasst. RLS über public.memberships.';

CREATE INDEX IF NOT EXISTS idx_dashboard_layouts_plan_key
  ON public.dashboard_layouts (plan_key);

ALTER TABLE public.dashboard_layouts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS dashboard_layouts_member_read ON public.dashboard_layouts;
CREATE POLICY dashboard_layouts_member_read
  ON public.dashboard_layouts
  FOR SELECT
  TO authenticated
  USING (public.is_tenant_member(tenant_id));

DROP POLICY IF EXISTS dashboard_layouts_admin_insert ON public.dashboard_layouts;
CREATE POLICY dashboard_layouts_admin_insert
  ON public.dashboard_layouts
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_tenant_owner_or_admin(tenant_id));

DROP POLICY IF EXISTS dashboard_layouts_admin_update ON public.dashboard_layouts;
CREATE POLICY dashboard_layouts_admin_update
  ON public.dashboard_layouts
  FOR UPDATE
  TO authenticated
  USING (public.is_tenant_owner_or_admin(tenant_id))
  WITH CHECK (public.is_tenant_owner_or_admin(tenant_id));

DROP POLICY IF EXISTS dashboard_layouts_service_role_all ON public.dashboard_layouts;
CREATE POLICY dashboard_layouts_service_role_all
  ON public.dashboard_layouts
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

REVOKE ALL ON public.dashboard_layouts FROM PUBLIC, anon;
GRANT SELECT, INSERT, UPDATE ON public.dashboard_layouts TO authenticated;
GRANT ALL ON public.dashboard_layouts TO service_role;
