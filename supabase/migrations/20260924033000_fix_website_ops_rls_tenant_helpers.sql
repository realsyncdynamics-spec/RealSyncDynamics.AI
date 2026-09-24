-- P0: Fix broken RLS on website_operations_core tables.
--
-- Root cause: policies used
--   tenant_id = (SELECT tenant_id FROM auth.users WHERE id = auth.uid())
-- which (a) requires SELECT on auth.users (permission denied for table users)
-- and (b) assumes a non-existent tenant_id column on auth.users.
-- Live Postgres rewrote the subquery against the outer table alias, still
-- touching auth.users without grant.
--
-- Fix: reuse public.is_tenant_member(tenant_id) (memberships-based),
-- matching public.websites RLS. Service-role insert/update policies on
-- deployment_logs / website_compliance_reports are left unchanged.

-- ---------------------------------------------------------------------------
-- website_projects
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Users can view their tenant's website projects" ON public.website_projects;
DROP POLICY IF EXISTS "Users can insert website projects for their tenant" ON public.website_projects;
DROP POLICY IF EXISTS "Users can update their tenant's website projects" ON public.website_projects;
DROP POLICY IF EXISTS "Users can delete their tenant's website projects" ON public.website_projects;

CREATE POLICY "website_projects_tenant_select"
  ON public.website_projects FOR SELECT
  USING (public.is_tenant_member(tenant_id));

CREATE POLICY "website_projects_tenant_insert"
  ON public.website_projects FOR INSERT
  WITH CHECK (public.is_tenant_member(tenant_id));

CREATE POLICY "website_projects_tenant_update"
  ON public.website_projects FOR UPDATE
  USING (public.is_tenant_member(tenant_id))
  WITH CHECK (public.is_tenant_member(tenant_id));

CREATE POLICY "website_projects_tenant_delete"
  ON public.website_projects FOR DELETE
  USING (public.is_tenant_member(tenant_id));

-- ---------------------------------------------------------------------------
-- website_domains (Custom Domain path /app/websites)
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Users can view their tenant's domains" ON public.website_domains;
DROP POLICY IF EXISTS "Users can insert domains for their projects" ON public.website_domains;
DROP POLICY IF EXISTS "Users can update their tenant's domains" ON public.website_domains;
DROP POLICY IF EXISTS "Users can delete their tenant's domains" ON public.website_domains;

CREATE POLICY "website_domains_tenant_select"
  ON public.website_domains FOR SELECT
  USING (public.is_tenant_member(tenant_id));

CREATE POLICY "website_domains_tenant_insert"
  ON public.website_domains FOR INSERT
  WITH CHECK (public.is_tenant_member(tenant_id));

CREATE POLICY "website_domains_tenant_update"
  ON public.website_domains FOR UPDATE
  USING (public.is_tenant_member(tenant_id))
  WITH CHECK (public.is_tenant_member(tenant_id));

CREATE POLICY "website_domains_tenant_delete"
  ON public.website_domains FOR DELETE
  USING (public.is_tenant_member(tenant_id));

-- ---------------------------------------------------------------------------
-- deployment_logs (read path; service-role insert kept)
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Users can view their tenant's deployment logs" ON public.deployment_logs;

CREATE POLICY "deployment_logs_tenant_select"
  ON public.deployment_logs FOR SELECT
  USING (public.is_tenant_member(tenant_id));

-- ---------------------------------------------------------------------------
-- website_compliance_reports (read path; service-role write kept)
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Users can view their tenant's compliance reports" ON public.website_compliance_reports;

CREATE POLICY "website_compliance_reports_tenant_select"
  ON public.website_compliance_reports FOR SELECT
  USING (public.is_tenant_member(tenant_id));
