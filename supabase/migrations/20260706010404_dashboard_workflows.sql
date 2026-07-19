-- Dashboard Workflows Table
-- Stores workflow progress and completion for users

CREATE TABLE IF NOT EXISTS dashboard_workflows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  workflow_id TEXT NOT NULL,
  workflow_name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'in_progress' CHECK (status IN ('in_progress', 'completed', 'abandoned')),
  current_step_index INTEGER NOT NULL DEFAULT 0,
  completed_step_indices INTEGER[] DEFAULT ARRAY[]::INTEGER[],
  step_data JSONB DEFAULT '{}',
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  abandoned_at TIMESTAMPTZ,
  last_updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE dashboard_workflows ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view own workflow progress"
  ON dashboard_workflows
  FOR SELECT
  USING (auth.uid() = user_id);

-- [hotfix] auth.users hat keine Spalte active_tenant_id (weder in Supabase
-- noch im CI-Stub) — Migration konnte nie angewendet werden. Tenant-Bindung
-- läuft wie überall sonst über die Membership-Prüfung.
CREATE POLICY "Users can create own workflows"
  ON dashboard_workflows
  FOR INSERT
  WITH CHECK (auth.uid() = user_id AND public.is_tenant_member(tenant_id));

CREATE POLICY "Users can update own workflows"
  ON dashboard_workflows
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own workflows"
  ON dashboard_workflows
  FOR DELETE
  USING (auth.uid() = user_id);

-- Indexes
CREATE INDEX idx_dashboard_workflows_tenant_user
  ON dashboard_workflows(tenant_id, user_id);

CREATE INDEX idx_dashboard_workflows_workflow_id
  ON dashboard_workflows(tenant_id, workflow_id);

CREATE INDEX idx_dashboard_workflows_status
  ON dashboard_workflows(tenant_id, status);

CREATE INDEX idx_dashboard_workflows_created_at
  ON dashboard_workflows(tenant_id, created_at DESC);

-- Update trigger for updated_at
CREATE OR REPLACE FUNCTION update_dashboard_workflows_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_dashboard_workflows_updated_at
BEFORE UPDATE ON dashboard_workflows
FOR EACH ROW
EXECUTE FUNCTION update_dashboard_workflows_updated_at();

-- Helper function to save workflow progress
CREATE OR REPLACE FUNCTION save_workflow_progress(
  p_tenant_id UUID,
  p_workflow_id TEXT,
  p_workflow_name TEXT,
  p_current_step_index INTEGER,
  p_completed_step_indices INTEGER[],
  p_step_data JSONB
)
RETURNS UUID AS $$
DECLARE
  v_workflow_row_id UUID;
BEGIN
  -- Try to update existing workflow, otherwise insert new one
  INSERT INTO dashboard_workflows (
    tenant_id,
    user_id,
    workflow_id,
    workflow_name,
    current_step_index,
    completed_step_indices,
    step_data
  ) VALUES (
    p_tenant_id,
    auth.uid(),
    p_workflow_id,
    p_workflow_name,
    p_current_step_index,
    p_completed_step_indices,
    p_step_data
  )
  ON CONFLICT (id) DO UPDATE SET
    current_step_index = EXCLUDED.current_step_index,
    completed_step_indices = EXCLUDED.completed_step_indices,
    step_data = EXCLUDED.step_data,
    last_updated_at = NOW(),
    updated_at = NOW()
  RETURNING id INTO v_workflow_row_id;

  RETURN v_workflow_row_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Helper function to complete workflow
CREATE OR REPLACE FUNCTION complete_workflow(
  p_workflow_id UUID
)
RETURNS VOID AS $$
BEGIN
  UPDATE dashboard_workflows
  SET
    status = 'completed',
    completed_at = NOW(),
    updated_at = NOW()
  WHERE id = p_workflow_id
    AND user_id = auth.uid();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Helper function to get active workflows for tenant
CREATE OR REPLACE FUNCTION get_active_workflows(
  p_tenant_id UUID
)
RETURNS TABLE (
  id UUID,
  workflow_id TEXT,
  workflow_name TEXT,
  status TEXT,
  current_step_index INTEGER,
  completed_step_indices INTEGER[],
  started_at TIMESTAMPTZ,
  last_updated_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    dashboard_workflows.id,
    dashboard_workflows.workflow_id,
    dashboard_workflows.workflow_name,
    dashboard_workflows.status,
    dashboard_workflows.current_step_index,
    dashboard_workflows.completed_step_indices,
    dashboard_workflows.started_at,
    dashboard_workflows.last_updated_at
  FROM dashboard_workflows
  WHERE dashboard_workflows.tenant_id = p_tenant_id
    AND dashboard_workflows.user_id = auth.uid()
    AND dashboard_workflows.status = 'in_progress'
  ORDER BY dashboard_workflows.last_updated_at DESC;
END;
$$ LANGUAGE plpgsql STABLE;
