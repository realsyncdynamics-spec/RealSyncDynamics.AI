-- ============================================================
-- Governance Risk Thresholds & Auto-Escalation
-- ============================================================
-- Defines automatic policy actions triggered when no explicit
-- policy matches, based on the event's risk_level alone.
--
-- Escalation strategy (default):
--   LOW      → log      (analysis & reporting)
--   MEDIUM   → warn     (stakeholder alert)
--   HIGH     → require_approval (owner review + escalation flag)
--   CRITICAL → block    (mandatory block + incident dispatch)
--
-- Tenants can override the default thresholds, or disable
-- auto-escalation entirely by setting enabled=false.

CREATE TABLE IF NOT EXISTS public.governance_risk_thresholds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID,
  risk_level TEXT NOT NULL CHECK (
    risk_level IN ('info', 'low', 'medium', 'high', 'critical')
  ),
  action TEXT NOT NULL CHECK (
    action IN ('allow', 'log', 'warn', 'block', 'require_approval')
  ),
  dispatch_incident BOOLEAN DEFAULT FALSE,
  enabled BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT unique_tenant_risk_level UNIQUE NULLS NOT DISTINCT (tenant_id, risk_level)
);

CREATE INDEX IF NOT EXISTS idx_governance_risk_thresholds_tenant
  ON public.governance_risk_thresholds(tenant_id, risk_level);

ALTER TABLE public.governance_risk_thresholds ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "risk_thresholds_service_all" ON public.governance_risk_thresholds;
CREATE POLICY "risk_thresholds_service_all"
ON public.governance_risk_thresholds
FOR ALL TO service_role
USING (true)
WITH CHECK (true);

DROP POLICY IF EXISTS "risk_thresholds_tenant_read" ON public.governance_risk_thresholds;
CREATE POLICY "risk_thresholds_tenant_read"
ON public.governance_risk_thresholds
FOR SELECT TO authenticated
USING (
  tenant_id IS NULL OR
  tenant_id IN (SELECT tenant_id FROM public.memberships WHERE user_id = auth.uid())
);

-- ============================================================
-- Global Risk Thresholds (tenant_id = NULL)
-- ============================================================
-- Default escalation rules for all tenants. Tenants can override
-- by inserting their own tenant-specific row.

INSERT INTO public.governance_risk_thresholds (
  tenant_id, risk_level, action, dispatch_incident, enabled
) VALUES
  (NULL, 'info',     'log',            FALSE, TRUE),
  (NULL, 'low',      'warn',           FALSE, TRUE),
  (NULL, 'medium',   'require_approval', FALSE, TRUE),
  (NULL, 'high',     'require_approval', TRUE,  TRUE),
  (NULL, 'critical', 'block',          TRUE,  TRUE)
ON CONFLICT (tenant_id, risk_level) DO NOTHING;

-- ============================================================
-- Governance Incidents (Auto-Escalation Events)
-- ============================================================
-- Tracks HIGH and CRITICAL events that trigger automatic
-- escalation (approval requirements or blocking).
-- Linked to the originating governance_event and the policy or
-- risk_threshold that triggered escalation.

CREATE TABLE IF NOT EXISTS public.governance_incidents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  event_id UUID NOT NULL REFERENCES public.governance_events(id) ON DELETE CASCADE,
  asset_id UUID REFERENCES public.governance_assets(id) ON DELETE SET NULL,

  risk_level TEXT NOT NULL CHECK (
    risk_level IN ('high', 'critical')
  ),
  escalation_source TEXT NOT NULL CHECK (
    escalation_source IN ('policy', 'risk_threshold')
  ),
  policy_id UUID REFERENCES public.governance_policies(id) ON DELETE SET NULL,
  threshold_id UUID REFERENCES public.governance_risk_thresholds(id) ON DELETE SET NULL,

  status TEXT NOT NULL CHECK (
    status IN ('open', 'acknowledged', 'in_progress', 'resolved', 'escalated')
  ) DEFAULT 'open',

  assigned_to UUID,
  priority TEXT DEFAULT 'high' CHECK (
    priority IN ('low', 'medium', 'high', 'critical')
  ),

  summary TEXT,
  description JSONB DEFAULT '{}',

  resolved_at TIMESTAMPTZ,
  resolved_by UUID,
  resolution_notes TEXT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_governance_incidents_tenant
  ON public.governance_incidents(tenant_id);

CREATE INDEX IF NOT EXISTS idx_governance_incidents_status
  ON public.governance_incidents(tenant_id, status)
  WHERE status IN ('open', 'in_progress');

CREATE INDEX IF NOT EXISTS idx_governance_incidents_event
  ON public.governance_incidents(event_id);

CREATE INDEX IF NOT EXISTS idx_governance_incidents_created
  ON public.governance_incidents(tenant_id, created_at DESC);

ALTER TABLE public.governance_incidents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "incidents_service_all" ON public.governance_incidents;
CREATE POLICY "incidents_service_all"
ON public.governance_incidents
FOR ALL TO service_role
USING (true)
WITH CHECK (true);

DROP POLICY IF EXISTS "incidents_tenant_read" ON public.governance_incidents;
CREATE POLICY "incidents_tenant_read"
ON public.governance_incidents
FOR SELECT TO authenticated
USING (
  tenant_id IN (SELECT tenant_id FROM public.memberships WHERE user_id = auth.uid())
);

DROP POLICY IF EXISTS "incidents_tenant_update_own" ON public.governance_incidents;
CREATE POLICY "incidents_tenant_update_own"
ON public.governance_incidents
FOR UPDATE TO authenticated
USING (
  tenant_id IN (SELECT tenant_id FROM public.memberships WHERE user_id = auth.uid())
  AND status IN ('open', 'acknowledged', 'in_progress')
)
WITH CHECK (
  tenant_id IN (SELECT tenant_id FROM public.memberships WHERE user_id = auth.uid())
);
