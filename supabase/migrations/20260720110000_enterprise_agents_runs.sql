-- Enterprise Agent Runs tracking table
-- Stores execution history for all governance agents

CREATE TABLE IF NOT EXISTS public.enterprise_agent_runs (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
  agent_id TEXT NOT NULL,
  actor TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('success', 'blocked', 'requires_approval', 'error')),
  summary TEXT,
  findings JSONB DEFAULT '[]'::JSONB,
  recommendations JSONB DEFAULT '[]'::JSONB,
  audit_events JSONB DEFAULT '[]'::JSONB,
  metadata JSONB DEFAULT '{}'::JSONB,
  started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  completed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_enterprise_agent_runs_tenant_id
  ON public.enterprise_agent_runs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_enterprise_agent_runs_agent_id
  ON public.enterprise_agent_runs(agent_id);
CREATE INDEX IF NOT EXISTS idx_enterprise_agent_runs_status
  ON public.enterprise_agent_runs(status);
CREATE INDEX IF NOT EXISTS idx_enterprise_agent_runs_created_at
  ON public.enterprise_agent_runs(created_at DESC);

-- RLS Policies
ALTER TABLE public.enterprise_agent_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view runs from their tenant" ON public.enterprise_agent_runs
  FOR SELECT USING (
    tenant_id = (SELECT tenant_id FROM public.profiles WHERE id = auth.uid())
  );

CREATE POLICY "Service role can insert/update runs" ON public.enterprise_agent_runs
  FOR ALL USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- Audit logging trigger
CREATE OR REPLACE FUNCTION public.log_enterprise_agent_run_event()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.ai_tool_runs(
      tenant_id,
      tool_name,
      action,
      actor,
      status,
      result_summary,
      metadata
    ) VALUES (
      NEW.tenant_id,
      'enterprise-agent-' || NEW.agent_id,
      'execute_agent',
      NEW.actor,
      NEW.status,
      NEW.summary,
      jsonb_build_object(
        'agent_id', NEW.agent_id,
        'run_id', NEW.id,
        'findings_count', jsonb_array_length(COALESCE(NEW.findings, '[]'::JSONB)),
        'recommendations_count', jsonb_array_length(COALESCE(NEW.recommendations, '[]'::JSONB))
      )
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS enterprise_agent_run_audit_trigger ON public.enterprise_agent_runs;
CREATE TRIGGER enterprise_agent_run_audit_trigger
  AFTER INSERT ON public.enterprise_agent_runs
  FOR EACH ROW
  EXECUTE FUNCTION public.log_enterprise_agent_run_event();
