-- ============================================================
-- Governance Agent Registry
-- ============================================================
-- Minimal metadata registry for AI agents managed by the
-- governance runtime. Tracks agent capabilities, versions,
-- and status for discovery and orchestration.
--
-- Used by:
--   - governance-agent: registers itself + discovered agents
--   - governance-agents-list: public discovery endpoint
--   - governance-orchestrate (future): agent routing/selection
--
-- Single source of truth for what agents are available in
-- the tenant's governance runtime.

CREATE TABLE IF NOT EXISTS public.governance_agent_registry (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID,
  agent_name TEXT NOT NULL,
  description TEXT,
  version TEXT DEFAULT '1.0.0',
  status TEXT NOT NULL CHECK (
    status IN ('active', 'archived', 'deprecated')
  ) DEFAULT 'active',

  owner_email TEXT,

  -- Capabilities this agent exposes (e.g., 'policy_review', 'remediation', 'scanning')
  capabilities TEXT[] DEFAULT '{}',

  -- Runtime / framework (e.g., 'deno', 'node', 'python')
  runtime TEXT,

  -- Metadata for extensibility (tags, config, custom fields)
  metadata JSONB DEFAULT '{}',

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Unique constraint for tenant-scoped agents (tenant_id IS NOT NULL)
CREATE UNIQUE INDEX IF NOT EXISTS idx_governance_agent_registry_unique_tenant_agent
  ON public.governance_agent_registry(tenant_id, agent_name)
  WHERE tenant_id IS NOT NULL;

-- Unique constraint for global agents (tenant_id IS NULL)
CREATE UNIQUE INDEX IF NOT EXISTS idx_governance_agent_registry_unique_global_agent
  ON public.governance_agent_registry(agent_name)
  WHERE tenant_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_governance_agent_registry_tenant
  ON public.governance_agent_registry(tenant_id);

CREATE INDEX IF NOT EXISTS idx_governance_agent_registry_status
  ON public.governance_agent_registry(tenant_id, status)
  WHERE status IN ('active', 'archived');

CREATE INDEX IF NOT EXISTS idx_governance_agent_registry_capabilities
  ON public.governance_agent_registry USING GIN(capabilities);

ALTER TABLE public.governance_agent_registry ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "agent_registry_service_all" ON public.governance_agent_registry;
CREATE POLICY "agent_registry_service_all"
ON public.governance_agent_registry
FOR ALL TO service_role
USING (true)
WITH CHECK (true);

DROP POLICY IF EXISTS "agent_registry_tenant_read" ON public.governance_agent_registry;
CREATE POLICY "agent_registry_tenant_read"
ON public.governance_agent_registry
FOR SELECT TO authenticated
USING (
  tenant_id IS NULL OR
  tenant_id IN (SELECT tenant_id FROM public.memberships WHERE user_id = auth.uid())
);

DROP POLICY IF EXISTS "agent_registry_tenant_write" ON public.governance_agent_registry;
CREATE POLICY "agent_registry_tenant_write"
ON public.governance_agent_registry
FOR INSERT, UPDATE, DELETE TO service_role
USING (true)
WITH CHECK (true);
