-- Autonomous Agent Runtime Core Tables
-- Enables self-executing governance workflows with scheduling, monitoring, and audit logging

-- ─── 1. Agent Registry ───

CREATE TABLE IF NOT EXISTS public.agents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,

  -- Identity & Classification
  name TEXT NOT NULL CHECK (length(name) BETWEEN 1 AND 128),
  type TEXT NOT NULL CHECK (type IN ('governance', 'remediation', 'monitoring', 'compliance-scorer', 'risk-assessor', 'custom')),
  description TEXT,

  -- Configuration
  enabled BOOLEAN DEFAULT true,
  schedule TEXT, -- cron expression: "0 2 * * *" for daily at 2am
  schedule_timezone TEXT DEFAULT 'UTC',

  config JSONB DEFAULT '{}', -- agent-specific config (thresholds, filters, etc.)
  parameters JSONB DEFAULT '{}', -- input params for workflow execution

  -- Lifecycle
  version INT DEFAULT 1,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  last_executed_at TIMESTAMPTZ,

  -- Constraints
  UNIQUE(tenant_id, name),
  UNIQUE(tenant_id, type) -- only one agent per type per tenant (can be overridden with custom types)
);

CREATE INDEX IF NOT EXISTS idx_agents_tenant_id ON public.agents(tenant_id);
CREATE INDEX IF NOT EXISTS idx_agents_enabled ON public.agents(enabled);
CREATE INDEX IF NOT EXISTS idx_agents_type ON public.agents(type);

-- ─── 2. Agent Execution Runs ───

-- Create agent_runs table only if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'agent_runs' AND table_schema = 'public') THEN
    CREATE TABLE public.agent_runs (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      agent_id UUID NOT NULL REFERENCES public.agents(id) ON DELETE CASCADE,
      tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,

      -- Execution Metadata
      triggered_by TEXT NOT NULL CHECK (triggered_by IN ('schedule', 'manual', 'webhook', 'system')),
      triggered_by_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,

      -- Status Tracking
      status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'completed', 'failed', 'cancelled')),
      started_at TIMESTAMPTZ,
      completed_at TIMESTAMPTZ,
      duration_ms INT,

      -- Input & Output
      input_params JSONB DEFAULT '{}',
      output JSONB DEFAULT '{}',

      -- Error Handling
      error_message TEXT,
      error_details JSONB,
      retry_count INT DEFAULT 0,
      max_retries INT DEFAULT 3,

      -- Audit
      created_at TIMESTAMPTZ DEFAULT now(),
      updated_at TIMESTAMPTZ DEFAULT now()
    );
  END IF;
END $$;

-- Create indexes on agent_runs (only if table exists and column exists)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'agent_runs' AND table_schema = 'public' AND column_name = 'agent_id') THEN
    CREATE INDEX IF NOT EXISTS idx_agent_runs_agent_id ON public.agent_runs(agent_id);
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'agent_runs' AND table_schema = 'public' AND column_name = 'tenant_id') THEN
    CREATE INDEX IF NOT EXISTS idx_agent_runs_tenant_id ON public.agent_runs(tenant_id);
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'agent_runs' AND table_schema = 'public' AND column_name = 'status') THEN
    CREATE INDEX IF NOT EXISTS idx_agent_runs_status ON public.agent_runs(status);
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'agent_runs' AND table_schema = 'public' AND column_name = 'triggered_by') THEN
    CREATE INDEX IF NOT EXISTS idx_agent_runs_triggered_by ON public.agent_runs(triggered_by);
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'agent_runs' AND table_schema = 'public' AND column_name = 'created_at') THEN
    CREATE INDEX IF NOT EXISTS idx_agent_runs_created_at ON public.agent_runs(created_at);
  END IF;
END $$;

-- ─── 3. Agent-Generated Tasks ───

-- Create agent_tasks table only if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'agent_tasks' AND table_schema = 'public') THEN
    CREATE TABLE public.agent_tasks (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      agent_id UUID NOT NULL REFERENCES public.agents(id) ON DELETE CASCADE,
      agent_run_id UUID NOT NULL REFERENCES public.agent_runs(id) ON DELETE CASCADE,
      tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,

      -- Task Details
      title TEXT NOT NULL,
      description TEXT,
      task_type TEXT NOT NULL CHECK (task_type IN ('remediation', 'review', 'approval', 'investigation', 'documentation', 'audit')),

      -- Assignment & Priority
      assigned_to UUID REFERENCES auth.users(id) ON DELETE SET NULL,
      priority TEXT DEFAULT 'medium' CHECK (priority IN ('critical', 'high', 'medium', 'low')),
      due_date TIMESTAMPTZ,

      -- Tracking
      status TEXT DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'completed', 'cancelled')),
      linked_gap_id UUID REFERENCES public.compliance_gaps(id) ON DELETE SET NULL,
      linked_evidence_id UUID REFERENCES public.evidence_items(id) ON DELETE SET NULL,

      -- Metadata
      metadata JSONB DEFAULT '{}',
      created_at TIMESTAMPTZ DEFAULT now(),
      completed_at TIMESTAMPTZ
    );
  END IF;
END $$;

-- Create indexes on agent_tasks (only if columns exist)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'agent_tasks' AND table_schema = 'public' AND column_name = 'agent_id') THEN
    CREATE INDEX IF NOT EXISTS idx_agent_tasks_agent_id ON public.agent_tasks(agent_id);
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'agent_tasks' AND table_schema = 'public' AND column_name = 'agent_run_id') THEN
    CREATE INDEX IF NOT EXISTS idx_agent_tasks_agent_run_id ON public.agent_tasks(agent_run_id);
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'agent_tasks' AND table_schema = 'public' AND column_name = 'tenant_id') THEN
    CREATE INDEX IF NOT EXISTS idx_agent_tasks_tenant_id ON public.agent_tasks(tenant_id);
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'agent_tasks' AND table_schema = 'public' AND column_name = 'assigned_to') THEN
    CREATE INDEX IF NOT EXISTS idx_agent_tasks_assigned_to ON public.agent_tasks(assigned_to);
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'agent_tasks' AND table_schema = 'public' AND column_name = 'status') THEN
    CREATE INDEX IF NOT EXISTS idx_agent_tasks_status ON public.agent_tasks(status);
  END IF;
END $$;

-- ─── 4. Agent Event Log (Audit Trail) ───

-- Create agent_events table only if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'agent_events' AND table_schema = 'public') THEN
    CREATE TABLE public.agent_events (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      agent_id UUID NOT NULL REFERENCES public.agents(id) ON DELETE CASCADE,
      tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,

      -- Event Details
      event_type TEXT NOT NULL CHECK (event_type IN ('created', 'enabled', 'disabled', 'configured', 'executed', 'scheduled', 'deleted', 'error')),
      actor_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,

      -- Context
      description TEXT,
      changes JSONB DEFAULT '{}', -- before/after for config changes
      related_run_id UUID REFERENCES public.agent_runs(id) ON DELETE SET NULL,

      -- Metadata
      created_at TIMESTAMPTZ DEFAULT now()
    );
  END IF;
END $$;

-- Create indexes on agent_events (only if columns exist)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'agent_events' AND table_schema = 'public' AND column_name = 'agent_id') THEN
    CREATE INDEX IF NOT EXISTS idx_agent_events_agent_id ON public.agent_events(agent_id);
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'agent_events' AND table_schema = 'public' AND column_name = 'tenant_id') THEN
    CREATE INDEX IF NOT EXISTS idx_agent_events_tenant_id ON public.agent_events(tenant_id);
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'agent_events' AND table_schema = 'public' AND column_name = 'event_type') THEN
    CREATE INDEX IF NOT EXISTS idx_agent_events_event_type ON public.agent_events(event_type);
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'agent_events' AND table_schema = 'public' AND column_name = 'created_at') THEN
    CREATE INDEX IF NOT EXISTS idx_agent_events_created_at ON public.agent_events(created_at);
  END IF;
END $$;

-- ─── 5. Row Level Security ───

ALTER TABLE public.agents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_events ENABLE ROW LEVEL SECURITY;

-- Agents: tenant members can view/manage
CREATE POLICY "agents tenant_read"
  ON public.agents FOR SELECT
  USING (public.is_tenant_member(tenant_id));

CREATE POLICY "agents tenant_write"
  ON public.agents FOR INSERT
  WITH CHECK (public.is_tenant_member(tenant_id));

CREATE POLICY "agents tenant_update"
  ON public.agents FOR UPDATE
  USING (public.is_tenant_member(tenant_id))
  WITH CHECK (public.is_tenant_member(tenant_id));

CREATE POLICY "agents service_only_delete"
  ON public.agents FOR DELETE
  USING (auth.role() = 'service_role');

-- Agent Runs: service role (scheduler) creates, all tenant members can read
CREATE POLICY "agent_runs tenant_read"
  ON public.agent_runs FOR SELECT
  USING (public.is_tenant_member(tenant_id));

CREATE POLICY "agent_runs service_insert"
  ON public.agent_runs FOR INSERT
  WITH CHECK (auth.role() = 'service_role' OR public.is_tenant_member(tenant_id));

CREATE POLICY "agent_runs service_update"
  ON public.agent_runs FOR UPDATE
  USING (auth.role() = 'service_role' OR public.is_tenant_member(tenant_id))
  WITH CHECK (auth.role() = 'service_role' OR public.is_tenant_member(tenant_id));

-- Agent Tasks: assigned users and admins can see
CREATE POLICY "agent_tasks tenant_read"
  ON public.agent_tasks FOR SELECT
  USING (public.is_tenant_member(tenant_id) OR auth.uid() = assigned_to);

CREATE POLICY "agent_tasks tenant_insert"
  ON public.agent_tasks FOR INSERT
  WITH CHECK (public.is_tenant_member(tenant_id) OR auth.role() = 'service_role');

CREATE POLICY "agent_tasks update"
  ON public.agent_tasks FOR UPDATE
  USING (public.is_tenant_member(tenant_id) OR auth.uid() = assigned_to)
  WITH CHECK (public.is_tenant_member(tenant_id) OR auth.uid() = assigned_to);

-- Agent Events: audit log (tenant members can read)
CREATE POLICY "agent_events tenant_read"
  ON public.agent_events FOR SELECT
  USING (public.is_tenant_member(tenant_id));

CREATE POLICY "agent_events service_insert"
  ON public.agent_events FOR INSERT
  WITH CHECK (auth.role() = 'service_role' OR public.is_tenant_member(tenant_id));

-- ─── 6. Helper RPC: Get or Create Default Agents ───

CREATE OR REPLACE FUNCTION public.get_or_create_default_agents(p_tenant_id UUID)
RETURNS TABLE (
  agent_id UUID,
  agent_name TEXT,
  agent_type TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_governance_agent UUID;
  v_remediation_agent UUID;
  v_monitoring_agent UUID;
BEGIN
  -- Create governance agent if it doesn't exist
  INSERT INTO public.agents (tenant_id, name, type, description, schedule, enabled, config)
  VALUES (
    p_tenant_id,
    'Governance Analyzer',
    'governance',
    'Automatically analyzes compliance gaps and generates insights',
    '0 2 * * *', -- daily at 2am UTC
    true,
    '{"auto_create_gaps": true, "threshold_risk": "high", "include_frameworks": ["iso27001", "dsgvo", "ai_act"]}'::jsonb
  )
  ON CONFLICT (tenant_id, name) DO NOTHING
  RETURNING id INTO v_governance_agent;

  -- Get it if it already exists
  IF v_governance_agent IS NULL THEN
    SELECT id INTO v_governance_agent
    FROM public.agents
    WHERE tenant_id = p_tenant_id AND type = 'governance';
  END IF;

  -- Create remediation agent if it doesn't exist
  INSERT INTO public.agents (tenant_id, name, type, description, schedule, enabled, config)
  VALUES (
    p_tenant_id,
    'Remediation Planner',
    'remediation',
    'Generates remediation plans for identified compliance gaps',
    '0 3 * * *', -- daily at 3am UTC
    true,
    '{"auto_assign": false, "estimate_timeline": true}'::jsonb
  )
  ON CONFLICT (tenant_id, name) DO NOTHING
  RETURNING id INTO v_remediation_agent;

  IF v_remediation_agent IS NULL THEN
    SELECT id INTO v_remediation_agent
    FROM public.agents
    WHERE tenant_id = p_tenant_id AND type = 'remediation';
  END IF;

  -- Create monitoring agent if it doesn't exist
  INSERT INTO public.agents (tenant_id, name, type, description, schedule, enabled, config)
  VALUES (
    p_tenant_id,
    'Compliance Monitor',
    'monitoring',
    'Monitors compliance status, deadlines, and drift',
    '0 */6 * * *', -- every 6 hours
    true,
    '{"check_deadlines": true, "alert_threshold_days": 14, "track_drift": true}'::jsonb
  )
  ON CONFLICT (tenant_id, name) DO NOTHING
  RETURNING id INTO v_monitoring_agent;

  IF v_monitoring_agent IS NULL THEN
    SELECT id INTO v_monitoring_agent
    FROM public.agents
    WHERE tenant_id = p_tenant_id AND type = 'monitoring';
  END IF;

  -- Return all three agents
  RETURN QUERY
  SELECT id, name, type FROM public.agents
  WHERE tenant_id = p_tenant_id AND type IN ('governance', 'remediation', 'monitoring');
END;
$$;

-- ─── 7. Audit Logging Trigger ───

CREATE OR REPLACE FUNCTION public.log_agent_events()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.agent_events (agent_id, tenant_id, event_type, actor_id, description)
    VALUES (NEW.id, NEW.tenant_id, 'created', auth.uid(), 'Agent created: ' || NEW.name);
  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.enabled != OLD.enabled THEN
      INSERT INTO public.agent_events (agent_id, tenant_id, event_type, actor_id, description, changes)
      VALUES (
        NEW.id,
        NEW.tenant_id,
        CASE WHEN NEW.enabled THEN 'enabled' ELSE 'disabled' END,
        auth.uid(),
        CASE WHEN NEW.enabled THEN 'Agent enabled' ELSE 'Agent disabled' END,
        jsonb_build_object('enabled', OLD.enabled || ' -> ' || NEW.enabled)
      );
    ELSIF NEW.config != OLD.config OR NEW.schedule != OLD.schedule THEN
      INSERT INTO public.agent_events (agent_id, tenant_id, event_type, actor_id, description, changes)
      VALUES (
        NEW.id,
        NEW.tenant_id,
        'configured',
        auth.uid(),
        'Agent configuration updated',
        jsonb_build_object('old_config', OLD.config, 'new_config', NEW.config, 'old_schedule', OLD.schedule, 'new_schedule', NEW.schedule)
      );
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER agents_audit_log
  AFTER INSERT OR UPDATE ON public.agents
  FOR EACH ROW
  EXECUTE FUNCTION public.log_agent_events();
