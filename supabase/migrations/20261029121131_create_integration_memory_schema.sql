-- RealSync second memory: integration_memory schema
-- Project: RealSyncDynamicsLive (ebljyceifhnlzhjfyxup)
-- Rules: no secrets in plaintext; RLS on all tables; tenant isolation via tenant_id

CREATE SCHEMA IF NOT EXISTS integration_memory;

-- Shared trigger for updated_at
CREATE OR REPLACE FUNCTION integration_memory.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- ========== APP_REGISTRY ==========
CREATE TABLE IF NOT EXISTS integration_memory.app_registry (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  source text NOT NULL,
  agent_id text NOT NULL,
  confidence numeric(3,2) NOT NULL DEFAULT 1.00 CHECK (confidence >= 0 AND confidence <= 1),
  project_id text,
  validity_status text NOT NULL DEFAULT 'active' CHECK (validity_status IN ('active','deprecated','archived','draft')),
  change_log jsonb NOT NULL DEFAULT '[]'::jsonb,
  tenant_id uuid,
  app_key text NOT NULL,
  display_name text NOT NULL,
  function_summary text,
  category text,
  auth_method text,
  webhook_support boolean,
  rate_limits jsonb,
  cost_notes text,
  data_residency text,
  privacy_risks text,
  dependencies jsonb NOT NULL DEFAULT '[]'::jsonb,
  last_connection_test_at timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb
);

-- ========== CONNECTION_REGISTRY ==========
CREATE TABLE IF NOT EXISTS integration_memory.connection_registry (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  source text NOT NULL,
  agent_id text NOT NULL,
  confidence numeric(3,2) NOT NULL DEFAULT 1.00 CHECK (confidence >= 0 AND confidence <= 1),
  project_id text,
  validity_status text NOT NULL DEFAULT 'active' CHECK (validity_status IN ('active','deprecated','archived','draft')),
  change_log jsonb NOT NULL DEFAULT '[]'::jsonb,
  tenant_id uuid,
  app_key text NOT NULL,
  connection_status text NOT NULL CHECK (connection_status IN (
    'CONNECTED','DISCONNECTED','DEGRADED','AUTH_REQUIRED','NOT_VERIFIED','ERROR'
  )),
  mcp_namespace text,
  server_id text,
  tool_count integer,
  permissions_scope text,
  auth_procedure text,
  secret_ref text,
  last_tested_at timestamptz,
  last_test_evidence jsonb,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb
);

-- ========== BOT_REGISTRY ==========
CREATE TABLE IF NOT EXISTS integration_memory.bot_registry (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  source text NOT NULL,
  agent_id text NOT NULL,
  confidence numeric(3,2) NOT NULL DEFAULT 1.00 CHECK (confidence >= 0 AND confidence <= 1),
  project_id text,
  validity_status text NOT NULL DEFAULT 'active' CHECK (validity_status IN ('active','deprecated','archived','draft')),
  change_log jsonb NOT NULL DEFAULT '[]'::jsonb,
  tenant_id uuid,
  bot_key text NOT NULL,
  display_name text NOT NULL,
  bot_uuid text,
  role_summary text,
  capabilities jsonb NOT NULL DEFAULT '[]'::jsonb,
  communication_interface text,
  reports_to text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb
);

-- ========== WORKFLOW_MEMORY ==========
CREATE TABLE IF NOT EXISTS integration_memory.workflow_memory (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  source text NOT NULL,
  agent_id text NOT NULL,
  confidence numeric(3,2) NOT NULL DEFAULT 1.00 CHECK (confidence >= 0 AND confidence <= 1),
  project_id text,
  validity_status text NOT NULL DEFAULT 'active' CHECK (validity_status IN ('active','deprecated','archived','draft')),
  change_log jsonb NOT NULL DEFAULT '[]'::jsonb,
  tenant_id uuid,
  workflow_id text NOT NULL,
  trigger_def jsonb NOT NULL DEFAULT '{}'::jsonb,
  input_schema jsonb,
  responsible_agent text,
  steps jsonb NOT NULL DEFAULT '[]'::jsonb,
  permission_context text,
  error_handling jsonb,
  retry_strategy jsonb,
  idempotency_key text,
  audit_log jsonb NOT NULL DEFAULT '[]'::jsonb,
  success_criteria text,
  rollback_strategy jsonb,
  last_run_at timestamptz,
  last_run_status text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb
);

-- ========== ERROR_MEMORY ==========
CREATE TABLE IF NOT EXISTS integration_memory.error_memory (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  source text NOT NULL,
  agent_id text NOT NULL,
  confidence numeric(3,2) NOT NULL DEFAULT 1.00 CHECK (confidence >= 0 AND confidence <= 1),
  project_id text,
  validity_status text NOT NULL DEFAULT 'active' CHECK (validity_status IN ('active','deprecated','archived','draft')),
  change_log jsonb NOT NULL DEFAULT '[]'::jsonb,
  tenant_id uuid,
  error_code text,
  error_signature text NOT NULL,
  cause text,
  impact text,
  remediation jsonb,
  recurrence_risk text,
  related_connection text,
  related_workflow text,
  resolved boolean NOT NULL DEFAULT false,
  resolved_at timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb
);

-- ========== DECISION_MEMORY ==========
CREATE TABLE IF NOT EXISTS integration_memory.decision_memory (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  source text NOT NULL,
  agent_id text NOT NULL,
  confidence numeric(3,2) NOT NULL DEFAULT 1.00 CHECK (confidence >= 0 AND confidence <= 1),
  project_id text,
  validity_status text NOT NULL DEFAULT 'active' CHECK (validity_status IN ('active','deprecated','archived','draft')),
  change_log jsonb NOT NULL DEFAULT '[]'::jsonb,
  tenant_id uuid,
  decision_key text NOT NULL,
  title text NOT NULL,
  rationale text,
  approved_by text,
  approval_evidence jsonb,
  status text NOT NULL DEFAULT 'proposed' CHECK (status IN ('proposed','approved','rejected','superseded')),
  effective_from timestamptz,
  effective_until timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb
);

-- ========== PROJECT_MEMORY ==========
CREATE TABLE IF NOT EXISTS integration_memory.project_memory (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  source text NOT NULL,
  agent_id text NOT NULL,
  confidence numeric(3,2) NOT NULL DEFAULT 1.00 CHECK (confidence >= 0 AND confidence <= 1),
  project_id text NOT NULL,
  validity_status text NOT NULL DEFAULT 'active' CHECK (validity_status IN ('active','deprecated','archived','draft')),
  change_log jsonb NOT NULL DEFAULT '[]'::jsonb,
  tenant_id uuid,
  title text NOT NULL,
  objective text,
  milestones jsonb NOT NULL DEFAULT '[]'::jsonb,
  blockers jsonb NOT NULL DEFAULT '[]'::jsonb,
  status text NOT NULL DEFAULT 'planned',
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb
);

-- ========== KNOWLEDGE_MEMORY ==========
CREATE TABLE IF NOT EXISTS integration_memory.knowledge_memory (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  source text NOT NULL,
  agent_id text NOT NULL,
  confidence numeric(3,2) NOT NULL DEFAULT 1.00 CHECK (confidence >= 0 AND confidence <= 1),
  project_id text,
  validity_status text NOT NULL DEFAULT 'active' CHECK (validity_status IN ('active','deprecated','archived','draft')),
  change_log jsonb NOT NULL DEFAULT '[]'::jsonb,
  tenant_id uuid,
  knowledge_key text NOT NULL,
  title text NOT NULL,
  content text,
  content_url text,
  tags jsonb NOT NULL DEFAULT '[]'::jsonb,
  verified_at timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb
);

-- ========== AUDIT_MEMORY ==========
CREATE TABLE IF NOT EXISTS integration_memory.audit_memory (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  source text NOT NULL,
  agent_id text NOT NULL,
  confidence numeric(3,2) NOT NULL DEFAULT 1.00 CHECK (confidence >= 0 AND confidence <= 1),
  project_id text,
  validity_status text NOT NULL DEFAULT 'active' CHECK (validity_status IN ('active','deprecated','archived','draft')),
  change_log jsonb NOT NULL DEFAULT '[]'::jsonb,
  tenant_id uuid,
  action text NOT NULL,
  actor text NOT NULL,
  target_type text,
  target_id text,
  before_state jsonb,
  after_state jsonb,
  ip_or_origin text,
  success boolean NOT NULL DEFAULT true,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_app_registry_tenant ON integration_memory.app_registry (tenant_id);
CREATE INDEX IF NOT EXISTS idx_app_registry_validity ON integration_memory.app_registry (validity_status);
CREATE UNIQUE INDEX IF NOT EXISTS uq_app_registry_platform_app ON integration_memory.app_registry (app_key) WHERE tenant_id IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_app_registry_tenant_app ON integration_memory.app_registry (tenant_id, app_key) WHERE tenant_id IS NOT NULL;


CREATE UNIQUE INDEX IF NOT EXISTS uq_connection_platform ON integration_memory.connection_registry (app_key, COALESCE(mcp_namespace, '')) WHERE tenant_id IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_connection_tenant ON integration_memory.connection_registry (tenant_id, app_key, COALESCE(mcp_namespace, '')) WHERE tenant_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_bot_platform ON integration_memory.bot_registry (bot_key) WHERE tenant_id IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_bot_tenant ON integration_memory.bot_registry (tenant_id, bot_key) WHERE tenant_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_workflow_platform ON integration_memory.workflow_memory (workflow_id) WHERE tenant_id IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_workflow_tenant ON integration_memory.workflow_memory (tenant_id, workflow_id) WHERE tenant_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_error_platform ON integration_memory.error_memory (error_signature) WHERE tenant_id IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_error_tenant ON integration_memory.error_memory (tenant_id, error_signature) WHERE tenant_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_decision_platform ON integration_memory.decision_memory (decision_key) WHERE tenant_id IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_decision_tenant ON integration_memory.decision_memory (tenant_id, decision_key) WHERE tenant_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_project_platform ON integration_memory.project_memory (project_id) WHERE tenant_id IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_project_tenant ON integration_memory.project_memory (tenant_id, project_id) WHERE tenant_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_knowledge_platform ON integration_memory.knowledge_memory (knowledge_key) WHERE tenant_id IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_knowledge_tenant ON integration_memory.knowledge_memory (tenant_id, knowledge_key) WHERE tenant_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_connection_registry_tenant ON integration_memory.connection_registry (tenant_id);
CREATE INDEX IF NOT EXISTS idx_connection_registry_status ON integration_memory.connection_registry (connection_status);
CREATE INDEX IF NOT EXISTS idx_connection_registry_app ON integration_memory.connection_registry (app_key);

CREATE INDEX IF NOT EXISTS idx_bot_registry_tenant ON integration_memory.bot_registry (tenant_id);
CREATE INDEX IF NOT EXISTS idx_workflow_memory_tenant ON integration_memory.workflow_memory (tenant_id);
CREATE INDEX IF NOT EXISTS idx_workflow_memory_wf ON integration_memory.workflow_memory (workflow_id);
CREATE INDEX IF NOT EXISTS idx_error_memory_tenant ON integration_memory.error_memory (tenant_id);
CREATE INDEX IF NOT EXISTS idx_error_memory_sig ON integration_memory.error_memory (error_signature);
CREATE INDEX IF NOT EXISTS idx_decision_memory_tenant ON integration_memory.decision_memory (tenant_id);
CREATE INDEX IF NOT EXISTS idx_project_memory_tenant ON integration_memory.project_memory (tenant_id);
CREATE INDEX IF NOT EXISTS idx_knowledge_memory_tenant ON integration_memory.knowledge_memory (tenant_id);
CREATE INDEX IF NOT EXISTS idx_audit_memory_tenant ON integration_memory.audit_memory (tenant_id);
CREATE INDEX IF NOT EXISTS idx_audit_memory_created ON integration_memory.audit_memory (created_at DESC);

-- updated_at triggers
DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'app_registry','connection_registry','bot_registry','workflow_memory',
    'error_memory','decision_memory','project_memory','knowledge_memory','audit_memory'
  ]
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_%s_updated_at ON integration_memory.%I', t, t);
    EXECUTE format(
      'CREATE TRIGGER trg_%s_updated_at BEFORE UPDATE ON integration_memory.%I FOR EACH ROW EXECUTE FUNCTION integration_memory.set_updated_at()',
      t, t
    );
  END LOOP;
END $$;

-- RLS: enable on all tables
ALTER TABLE integration_memory.app_registry ENABLE ROW LEVEL SECURITY;
ALTER TABLE integration_memory.connection_registry ENABLE ROW LEVEL SECURITY;
ALTER TABLE integration_memory.bot_registry ENABLE ROW LEVEL SECURITY;
ALTER TABLE integration_memory.workflow_memory ENABLE ROW LEVEL SECURITY;
ALTER TABLE integration_memory.error_memory ENABLE ROW LEVEL SECURITY;
ALTER TABLE integration_memory.decision_memory ENABLE ROW LEVEL SECURITY;
ALTER TABLE integration_memory.project_memory ENABLE ROW LEVEL SECURITY;
ALTER TABLE integration_memory.knowledge_memory ENABLE ROW LEVEL SECURITY;
ALTER TABLE integration_memory.audit_memory ENABLE ROW LEVEL SECURITY;

-- Revoke default API exposure until service_role / controlled grants
REVOKE ALL ON ALL TABLES IN SCHEMA integration_memory FROM PUBLIC, anon, authenticated;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA integration_memory FROM PUBLIC, anon, authenticated;
REVOKE ALL ON SCHEMA integration_memory FROM PUBLIC, anon, authenticated;

-- service_role retains full access (Supabase default for service_role bypasses RLS and has grants)
-- Platform-level rows: tenant_id IS NULL — only service_role should read/write via MCP
-- Tenant-scoped future: policies can be added when auth.jwt() tenant claim exists

COMMENT ON SCHEMA integration_memory IS 'RealSync App Connector second memory — no plaintext secrets; secret_ref only';
COMMENT ON COLUMN integration_memory.connection_registry.secret_ref IS 'Reference to vault/secret manager only — never store API keys or tokens here';
