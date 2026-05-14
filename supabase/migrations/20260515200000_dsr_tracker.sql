CREATE TABLE IF NOT EXISTS public.dsr_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID,
  request_type TEXT NOT NULL CHECK (request_type IN ('access','erasure','portability','rectification','restriction','objection')),
  status TEXT NOT NULL CHECK (status IN ('received','in_progress','pending_verification','completed','rejected','overdue')) DEFAULT 'received',
  requester_name TEXT,
  requester_email TEXT NOT NULL,
  subject_description TEXT,
  affected_assets TEXT[] DEFAULT '{}',
  received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deadline_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '30 days'),
  completed_at TIMESTAMPTZ,
  response_notes TEXT,
  assigned_to TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_dsr_requests_tenant ON public.dsr_requests(tenant_id);
CREATE INDEX IF NOT EXISTS idx_dsr_requests_status ON public.dsr_requests(status);
CREATE INDEX IF NOT EXISTS idx_dsr_requests_deadline ON public.dsr_requests(deadline_at);
ALTER TABLE public.dsr_requests ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "dsr_requests_service_all" ON public.dsr_requests;
CREATE POLICY "dsr_requests_service_all" ON public.dsr_requests FOR ALL TO service_role USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "dsr_requests_tenant_read" ON public.dsr_requests;
CREATE POLICY "dsr_requests_tenant_read" ON public.dsr_requests FOR SELECT TO authenticated
USING (tenant_id IN (SELECT tenant_id FROM public.memberships WHERE user_id = auth.uid()));
DROP TRIGGER IF EXISTS trg_dsr_requests_updated_at ON public.dsr_requests;
CREATE TRIGGER trg_dsr_requests_updated_at BEFORE UPDATE ON public.dsr_requests FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
