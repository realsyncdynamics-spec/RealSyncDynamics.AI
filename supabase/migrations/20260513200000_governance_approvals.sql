-- ============================================================
-- Governance Approvals
-- ============================================================
-- Whenever the policy engine stamps an event with
-- policy_action='require_approval', a row is auto-created here in
-- status='pending'. A tenant admin must explicitly approve or
-- reject. Approvals/rejections leave a hash-chained evidence
-- record on the parent event for the audit trail.

CREATE TABLE IF NOT EXISTS public.governance_approvals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID,
  event_id UUID NOT NULL REFERENCES public.governance_events(id) ON DELETE CASCADE,
  policy_id UUID REFERENCES public.governance_policies(id) ON DELETE SET NULL,
  asset_id UUID REFERENCES public.governance_assets(id) ON DELETE SET NULL,

  status TEXT NOT NULL CHECK (
    status IN ('pending', 'approved', 'rejected', 'expired')
  ) DEFAULT 'pending',
  requested_action TEXT NOT NULL,
  resolved_by UUID,
  resolved_at TIMESTAMPTZ,
  resolution_reason TEXT,
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '7 days'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE(event_id)
);

CREATE INDEX IF NOT EXISTS idx_governance_approvals_tenant
  ON public.governance_approvals(tenant_id);

CREATE INDEX IF NOT EXISTS idx_governance_approvals_pending
  ON public.governance_approvals(tenant_id, created_at)
  WHERE status = 'pending';

ALTER TABLE public.governance_approvals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "governance_approvals_service_all" ON public.governance_approvals;
CREATE POLICY "governance_approvals_service_all"
ON public.governance_approvals
FOR ALL TO service_role
USING (true)
WITH CHECK (true);

DROP POLICY IF EXISTS "governance_approvals_tenant_read" ON public.governance_approvals;
CREATE POLICY "governance_approvals_tenant_read"
ON public.governance_approvals
FOR SELECT TO authenticated
USING (
  tenant_id IN (SELECT tenant_id FROM public.memberships WHERE user_id = auth.uid())
);
