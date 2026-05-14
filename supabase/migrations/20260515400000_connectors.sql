-- Integration Connectors + Remediation Actions (PR #157).
-- Outbound integrations (Jira / GitHub / Linear / ServiceNow / Slack / Teams)
-- and a log of what each connector did for a given governance event.

CREATE TABLE IF NOT EXISTS public.integration_connectors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID,
  connector_type TEXT NOT NULL CHECK (connector_type IN ('jira','github','linear','servicenow','slack','teams')),
  name TEXT NOT NULL,
  config JSONB NOT NULL DEFAULT '{}',
  enabled BOOLEAN DEFAULT TRUE,
  trigger_on_risk_level TEXT[] DEFAULT ARRAY['high','critical'],
  trigger_on_policy_action TEXT[] DEFAULT ARRAY['block','require_approval'],
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.remediation_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID,
  event_id UUID REFERENCES public.governance_events(id) ON DELETE SET NULL,
  connector_id UUID REFERENCES public.integration_connectors(id) ON DELETE SET NULL,
  action_type TEXT NOT NULL CHECK (action_type IN ('create_ticket','create_issue','send_notification','create_pr')),
  status TEXT NOT NULL CHECK (status IN ('pending','executing','completed','failed')) DEFAULT 'pending',
  external_id TEXT,
  external_url TEXT,
  payload JSONB DEFAULT '{}',
  error_message TEXT,
  executed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_connectors_tenant ON public.integration_connectors(tenant_id);
CREATE INDEX IF NOT EXISTS idx_remediation_actions_tenant ON public.remediation_actions(tenant_id, created_at DESC);

ALTER TABLE public.integration_connectors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.remediation_actions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "connectors_service_all" ON public.integration_connectors;
CREATE POLICY "connectors_service_all" ON public.integration_connectors FOR ALL TO service_role USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "remediation_actions_service_all" ON public.remediation_actions;
CREATE POLICY "remediation_actions_service_all" ON public.remediation_actions FOR ALL TO service_role USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "connectors_tenant_read" ON public.integration_connectors;
CREATE POLICY "connectors_tenant_read" ON public.integration_connectors FOR SELECT TO authenticated
USING (tenant_id IN (SELECT tenant_id FROM public.memberships WHERE user_id = auth.uid()));
DROP POLICY IF EXISTS "remediation_actions_tenant_read" ON public.remediation_actions;
CREATE POLICY "remediation_actions_tenant_read" ON public.remediation_actions FOR SELECT TO authenticated
USING (tenant_id IN (SELECT tenant_id FROM public.memberships WHERE user_id = auth.uid()));

DROP TRIGGER IF EXISTS trg_connectors_updated_at ON public.integration_connectors;
CREATE TRIGGER trg_connectors_updated_at BEFORE UPDATE ON public.integration_connectors
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
