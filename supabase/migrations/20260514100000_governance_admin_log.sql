-- ============================================================
-- Governance Admin Audit Log
-- ============================================================
-- Every owner/admin write through governance-keys / -resources /
-- -webhooks / -approvals leaves a row here. Auditors get a
-- chronological "who-did-what-when" trail per tenant.

CREATE TABLE IF NOT EXISTS public.governance_admin_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  actor_user_id UUID,
  actor_email TEXT,
  action TEXT NOT NULL,
  target_type TEXT NOT NULL,
  target_id TEXT,
  payload JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_governance_admin_log_tenant
  ON public.governance_admin_log(tenant_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_governance_admin_log_actor
  ON public.governance_admin_log(actor_user_id);

ALTER TABLE public.governance_admin_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "governance_admin_log_service_all" ON public.governance_admin_log;
CREATE POLICY "governance_admin_log_service_all"
ON public.governance_admin_log
FOR ALL TO service_role
USING (true)
WITH CHECK (true);

DROP POLICY IF EXISTS "governance_admin_log_tenant_read" ON public.governance_admin_log;
CREATE POLICY "governance_admin_log_tenant_read"
ON public.governance_admin_log
FOR SELECT TO authenticated
USING (
  tenant_id IN (SELECT tenant_id FROM public.memberships WHERE user_id = auth.uid())
);
