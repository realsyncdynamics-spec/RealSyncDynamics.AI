CREATE TABLE IF NOT EXISTS public.incidents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID,
  triggering_event_id UUID REFERENCES public.governance_events(id) ON DELETE SET NULL,
  asset_id UUID REFERENCES public.governance_assets(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT,
  severity TEXT NOT NULL CHECK (severity IN ('low','medium','high','critical')) DEFAULT 'high',
  status TEXT NOT NULL CHECK (status IN ('open','investigating','contained','resolved','reported_to_authority')) DEFAULT 'open',
  breach_confirmed BOOLEAN DEFAULT FALSE,
  personal_data_affected BOOLEAN DEFAULT FALSE,
  affected_data_types TEXT[] DEFAULT '{}',
  estimated_affected_subjects INT,
  detected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  notification_deadline_at TIMESTAMPTZ GENERATED ALWAYS AS (detected_at + INTERVAL '72 hours') STORED,
  contained_at TIMESTAMPTZ,
  resolved_at TIMESTAMPTZ,
  reported_to_authority_at TIMESTAMPTZ,
  authority_reference TEXT,
  timeline JSONB DEFAULT '[]',
  assigned_to TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_incidents_tenant ON public.incidents(tenant_id);
CREATE INDEX IF NOT EXISTS idx_incidents_status ON public.incidents(status);
CREATE INDEX IF NOT EXISTS idx_incidents_deadline ON public.incidents(notification_deadline_at);
ALTER TABLE public.incidents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "incidents_service_all" ON public.incidents FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "incidents_tenant_read" ON public.incidents FOR SELECT TO authenticated
USING (tenant_id IN (SELECT tenant_id FROM public.memberships WHERE user_id = auth.uid()));
DROP TRIGGER IF EXISTS trg_incidents_updated_at ON public.incidents;
CREATE TRIGGER trg_incidents_updated_at BEFORE UPDATE ON public.incidents FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
