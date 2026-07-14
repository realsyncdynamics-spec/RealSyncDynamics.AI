-- Migration: 20260714000000_workflows_automation.sql
-- Description: Workflow automation tables for scheduled compliance checks and n8n integration

-- Workflows: Store workflow configurations for automated compliance checks
CREATE TABLE IF NOT EXISTS public.workflows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name VARCHAR NOT NULL,
  description TEXT,
  workflow_type VARCHAR NOT NULL CHECK (workflow_type IN ('compliance_check', 'asset_scan', 'audit_export')),
  config JSONB NOT NULL DEFAULT '{}',
  n8n_workflow_id VARCHAR,
  enabled BOOLEAN DEFAULT false,
  last_run_at TIMESTAMP WITH TIME ZONE,
  next_run_at TIMESTAMP WITH TIME ZONE,
  run_count INTEGER DEFAULT 0,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  CONSTRAINT workflows_tenant_fk FOREIGN KEY (tenant_id) REFERENCES public.tenants(id)
);

-- RLS for workflows
ALTER TABLE public.workflows ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their tenant's workflows"
  ON public.workflows
  FOR SELECT
  USING (
    tenant_id = (SELECT tenant_id FROM auth.users WHERE id = auth.uid() LIMIT 1)
  );

CREATE POLICY "Users can create workflows"
  ON public.workflows
  FOR INSERT
  WITH CHECK (
    tenant_id = (SELECT tenant_id FROM auth.users WHERE id = auth.uid() LIMIT 1)
  );

CREATE POLICY "Users can update workflows"
  ON public.workflows
  FOR UPDATE
  USING (
    tenant_id = (SELECT tenant_id FROM auth.users WHERE id = auth.uid() LIMIT 1)
  )
  WITH CHECK (
    tenant_id = (SELECT tenant_id FROM auth.users WHERE id = auth.uid() LIMIT 1)
  );

CREATE POLICY "Users can delete workflows"
  ON public.workflows
  FOR DELETE
  USING (
    tenant_id = (SELECT tenant_id FROM auth.users WHERE id = auth.uid() LIMIT 1)
  );

CREATE INDEX idx_workflows_tenant_id ON public.workflows(tenant_id);
CREATE INDEX idx_workflows_enabled ON public.workflows(enabled);
CREATE INDEX idx_workflows_next_run_at ON public.workflows(next_run_at);

-- Workflow runs: Track execution history
CREATE TABLE IF NOT EXISTS public.workflow_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_id UUID NOT NULL REFERENCES public.workflows(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  status VARCHAR NOT NULL CHECK (status IN ('pending', 'running', 'success', 'failed', 'cancelled')),
  started_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  error_message TEXT,
  result JSONB DEFAULT '{}',
  triggered_by VARCHAR NOT NULL CHECK (triggered_by IN ('schedule', 'manual', 'webhook')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  CONSTRAINT workflow_runs_tenant_fk FOREIGN KEY (tenant_id) REFERENCES public.tenants(id)
);

-- RLS for workflow_runs
ALTER TABLE public.workflow_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their tenant's workflow runs"
  ON public.workflow_runs
  FOR SELECT
  USING (
    tenant_id = (SELECT tenant_id FROM auth.users WHERE id = auth.uid() LIMIT 1)
  );

CREATE POLICY "Users can create workflow runs"
  ON public.workflow_runs
  FOR INSERT
  WITH CHECK (
    tenant_id = (SELECT tenant_id FROM auth.users WHERE id = auth.uid() LIMIT 1)
  );

CREATE INDEX idx_workflow_runs_workflow_id ON public.workflow_runs(workflow_id);
CREATE INDEX idx_workflow_runs_status ON public.workflow_runs(status);
CREATE INDEX idx_workflow_runs_created_at ON public.workflow_runs(created_at DESC);
CREATE INDEX idx_workflow_runs_tenant_id ON public.workflow_runs(tenant_id);

COMMENT ON TABLE public.workflows IS 'Automated workflow configurations for compliance checks, scans, and exports. Integrated with n8n for orchestration.';
COMMENT ON TABLE public.workflow_runs IS 'Execution history and results for workflows. Tracks timing, status, and errors.';
