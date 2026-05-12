-- ============================================================
-- Governance Event Architecture
-- ============================================================
-- Foundation tables for Operational AI Governance Infrastructure:
--   Runtime Telemetry · Policy Engine · Evidence Vault ·
--   AI Governance Graph · Asset/Control Mapping.
--
-- tenant_id is UUID (no FK yet) — wired to tenants table in a
-- later migration once tenant membership enforcement is added
-- to RLS. For now service_role manages writes; authenticated
-- users only read framework_controls.

CREATE TABLE IF NOT EXISTS public.governance_assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID,
  asset_type TEXT NOT NULL CHECK (
    asset_type IN (
      'website',
      'ai_system',
      'vendor',
      'model',
      'agent',
      'api',
      'dataset',
      'repository',
      'workflow'
    )
  ),
  name TEXT NOT NULL,
  description TEXT,
  owner_email TEXT,
  vendor TEXT,
  system_url TEXT,
  data_types TEXT[] DEFAULT '{}',
  risk_score INT DEFAULT 0 CHECK (risk_score >= 0 AND risk_score <= 100),
  ai_act_class TEXT CHECK (
    ai_act_class IN ('minimal','limited','high','prohibited','unknown')
  ) DEFAULT 'unknown',
  status TEXT CHECK (
    status IN ('draft','active','under_review','approved','archived')
  ) DEFAULT 'draft',
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.governance_policies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID,
  name TEXT NOT NULL,
  description TEXT,
  policy_type TEXT NOT NULL CHECK (
    policy_type IN (
      'data_transfer',
      'model_usage',
      'human_review',
      'logging_required',
      'vendor_restriction',
      'retention',
      'security',
      'ai_act',
      'gdpr'
    )
  ),
  severity TEXT NOT NULL CHECK (
    severity IN ('info','low','medium','high','critical')
  ) DEFAULT 'medium',
  action TEXT NOT NULL CHECK (
    action IN ('allow','log','warn','block','require_approval')
  ) DEFAULT 'warn',
  condition JSONB DEFAULT '{}',
  enabled BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.governance_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID,
  asset_id UUID REFERENCES public.governance_assets(id) ON DELETE SET NULL,
  policy_id UUID REFERENCES public.governance_policies(id) ON DELETE SET NULL,

  event_type TEXT NOT NULL,
  event_source TEXT NOT NULL CHECK (
    event_source IN (
      'website_scanner',
      'browser_extension',
      'sdk',
      'api',
      'github',
      'ci_cd',
      'manual',
      'agent_runtime'
    )
  ),

  title TEXT NOT NULL,
  summary TEXT,
  risk_level TEXT NOT NULL CHECK (
    risk_level IN ('info','low','medium','high','critical')
  ) DEFAULT 'info',

  actor_email TEXT,
  vendor TEXT,
  model_name TEXT,
  data_types TEXT[] DEFAULT '{}',
  policy_action TEXT CHECK (
    policy_action IN ('allow','log','warn','block','require_approval')
  ),

  payload JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.governance_evidence (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID,
  event_id UUID REFERENCES public.governance_events(id) ON DELETE CASCADE,
  asset_id UUID REFERENCES public.governance_assets(id) ON DELETE SET NULL,

  evidence_type TEXT NOT NULL CHECK (
    evidence_type IN (
      'screenshot',
      'har',
      'json',
      'log',
      'pdf',
      'hash',
      'policy_snapshot',
      'approval',
      'pull_request'
    )
  ),

  title TEXT NOT NULL,
  storage_path TEXT,
  content_hash TEXT,
  previous_hash TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.framework_controls (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  framework TEXT NOT NULL CHECK (
    framework IN (
      'GDPR',
      'TDDDG',
      'EU_AI_ACT',
      'ISO_27001',
      'SOC_2',
      'NIS2',
      'DORA',
      'CUSTOM'
    )
  ),
  control_code TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(framework, control_code)
);

CREATE TABLE IF NOT EXISTS public.asset_control_mappings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id UUID REFERENCES public.governance_assets(id) ON DELETE CASCADE,
  control_id UUID REFERENCES public.framework_controls(id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK (
    status IN ('not_started','in_progress','implemented','gap','not_applicable')
  ) DEFAULT 'not_started',
  evidence_id UUID REFERENCES public.governance_evidence(id) ON DELETE SET NULL,
  notes TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(asset_id, control_id)
);

CREATE INDEX IF NOT EXISTS idx_governance_assets_tenant
  ON public.governance_assets(tenant_id);

CREATE INDEX IF NOT EXISTS idx_governance_events_tenant
  ON public.governance_events(tenant_id);

CREATE INDEX IF NOT EXISTS idx_governance_events_asset
  ON public.governance_events(asset_id);

CREATE INDEX IF NOT EXISTS idx_governance_events_type
  ON public.governance_events(event_type);

CREATE INDEX IF NOT EXISTS idx_governance_events_risk
  ON public.governance_events(risk_level);

CREATE INDEX IF NOT EXISTS idx_governance_evidence_event
  ON public.governance_evidence(event_id);

CREATE INDEX IF NOT EXISTS idx_framework_controls_framework
  ON public.framework_controls(framework);

-- updated_at helper
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_governance_assets_updated_at ON public.governance_assets;
CREATE TRIGGER trg_governance_assets_updated_at
  BEFORE UPDATE ON public.governance_assets
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_governance_policies_updated_at ON public.governance_policies;
CREATE TRIGGER trg_governance_policies_updated_at
  BEFORE UPDATE ON public.governance_policies
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_asset_control_mappings_updated_at ON public.asset_control_mappings;
CREATE TRIGGER trg_asset_control_mappings_updated_at
  BEFORE UPDATE ON public.asset_control_mappings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- RLS
ALTER TABLE public.governance_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.governance_policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.governance_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.governance_evidence ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.framework_controls ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.asset_control_mappings ENABLE ROW LEVEL SECURITY;

-- authenticated read-own placeholder
-- tenant_id enforcement can later be connected to tenant membership table

CREATE POLICY "governance_assets_service_all"
ON public.governance_assets
FOR ALL TO service_role
USING (true)
WITH CHECK (true);

CREATE POLICY "governance_policies_service_all"
ON public.governance_policies
FOR ALL TO service_role
USING (true)
WITH CHECK (true);

CREATE POLICY "governance_events_service_all"
ON public.governance_events
FOR ALL TO service_role
USING (true)
WITH CHECK (true);

CREATE POLICY "governance_evidence_service_all"
ON public.governance_evidence
FOR ALL TO service_role
USING (true)
WITH CHECK (true);

CREATE POLICY "framework_controls_read_all"
ON public.framework_controls
FOR SELECT TO authenticated
USING (true);

CREATE POLICY "framework_controls_service_all"
ON public.framework_controls
FOR ALL TO service_role
USING (true)
WITH CHECK (true);

CREATE POLICY "asset_control_mappings_service_all"
ON public.asset_control_mappings
FOR ALL TO service_role
USING (true)
WITH CHECK (true);

-- Seed minimal controls
INSERT INTO public.framework_controls (framework, control_code, title, description)
VALUES
  ('GDPR', 'Art.5', 'Principles relating to processing', 'Lawfulness, fairness, transparency, purpose limitation, data minimisation and accountability.'),
  ('GDPR', 'Art.30', 'Records of processing activities', 'Maintain records of processing activities.'),
  ('GDPR', 'Art.35', 'Data protection impact assessment', 'Assess high-risk processing operations.'),
  ('EU_AI_ACT', 'Art.9', 'Risk management system', 'Establish and maintain a risk management system for high-risk AI systems.'),
  ('EU_AI_ACT', 'Art.12', 'Record keeping', 'Enable automatic logging and traceability.'),
  ('EU_AI_ACT', 'Art.14', 'Human oversight', 'Ensure appropriate human oversight.'),
  ('ISO_27001', 'A.5.1', 'Policies for information security', 'Define and review policies for information security.'),
  ('SOC_2', 'CC7.2', 'Monitoring and detection', 'Monitor system components and detect anomalies.')
ON CONFLICT (framework, control_code) DO NOTHING;
