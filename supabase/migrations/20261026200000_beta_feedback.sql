-- WP-4: Beta-Feedback-Tabelle
-- Nutzer können Feedback aus dem Dashboard einreichen.
-- tenant owner/admin können Feedback ihres Mandanten lesen.
-- Super-Admin (is_super_admin) kann alles lesen.

CREATE TABLE IF NOT EXISTS public.beta_feedback (
  id         UUID         NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id  UUID         REFERENCES public.tenants(id) ON DELETE SET NULL,
  user_id    UUID         REFERENCES auth.users(id)     ON DELETE SET NULL,
  route      TEXT         NOT NULL DEFAULT '',
  text       TEXT         NOT NULL,
  created_at TIMESTAMPTZ  NOT NULL DEFAULT now()
);

ALTER TABLE public.beta_feedback ENABLE ROW LEVEL SECURITY;

-- Jeder angemeldete Nutzer kann eigenes Feedback einfügen
CREATE POLICY beta_feedback_insert ON public.beta_feedback
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Tenant owner/admin können das Feedback ihres Mandanten lesen
CREATE POLICY beta_feedback_tenant_read ON public.beta_feedback
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.tenant_members tm
      WHERE tm.tenant_id = beta_feedback.tenant_id
        AND tm.user_id   = auth.uid()
        AND tm.role       IN ('owner', 'admin')
    )
  );

-- Super-Admin liest alles
CREATE POLICY beta_feedback_superadmin_read ON public.beta_feedback
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.is_super_admin = TRUE
    )
  );

GRANT INSERT, SELECT ON public.beta_feedback TO authenticated;
GRANT SELECT ON public.beta_feedback TO service_role;
