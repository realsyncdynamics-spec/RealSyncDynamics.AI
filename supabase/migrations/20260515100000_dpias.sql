-- DPIAs — Data Protection Impact Assessments
CREATE TABLE IF NOT EXISTS public.dpias (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID,
  asset_id UUID REFERENCES public.governance_assets(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('draft','in_review','approved','rejected')) DEFAULT 'draft',
  necessity_assessment TEXT,
  proportionality_assessment TEXT,
  risk_description TEXT,
  mitigation_measures TEXT,
  dpo_consulted BOOLEAN DEFAULT FALSE,
  dpo_email TEXT,
  approved_by TEXT,
  approved_at TIMESTAMPTZ,
  review_due_at TIMESTAMPTZ,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_dpias_tenant ON public.dpias(tenant_id);
CREATE INDEX IF NOT EXISTS idx_dpias_asset ON public.dpias(asset_id);
CREATE INDEX IF NOT EXISTS idx_dpias_status ON public.dpias(status);
ALTER TABLE public.dpias ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "dpias_service_all" ON public.dpias;
CREATE POLICY "dpias_service_all" ON public.dpias FOR ALL TO service_role USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "dpias_tenant_read" ON public.dpias;
CREATE POLICY "dpias_tenant_read" ON public.dpias FOR SELECT TO authenticated
USING (tenant_id IN (SELECT tenant_id FROM public.memberships WHERE user_id = auth.uid()));
DROP TRIGGER IF EXISTS trg_dpias_updated_at ON public.dpias;
CREATE TRIGGER trg_dpias_updated_at BEFORE UPDATE ON public.dpias
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
