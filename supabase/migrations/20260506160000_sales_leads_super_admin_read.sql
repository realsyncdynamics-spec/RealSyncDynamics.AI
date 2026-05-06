-- /admin/leads dashboard reads sales_leads via authenticated user JWT.
-- Without a SELECT policy + RLS-enabled table, super_admins see 0 rows.
-- This adds the missing read policy. Service-role inserts (sales-lead
-- Edge Function) keep working unchanged.

DROP POLICY IF EXISTS "sales_leads super_admin_read" ON public.sales_leads;
CREATE POLICY "sales_leads super_admin_read"
  ON public.sales_leads FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid() AND p.is_super_admin = true
  ));
