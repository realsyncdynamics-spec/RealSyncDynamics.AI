-- Compliance Monitoring & Automated Alerts
--
-- Real-time risk detection, escalation, and auto-remediation for compliance issues.
-- Triggers alerts on audit changes, creates escalation chains, handles remediation.

-- 1. Compliance alert rules (tenant-configurable thresholds)
CREATE TABLE IF NOT EXISTS public.compliance_alert_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,

  -- Rule definition
  rule_name TEXT NOT NULL,
  description TEXT,
  enabled BOOLEAN NOT NULL DEFAULT true,

  -- Trigger condition
  trigger_event TEXT NOT NULL CHECK (trigger_event IN (
    'risk_detected', 'risk_escalated', 'audit_failed', 'dpia_overdue',
    'sub_processor_change', 'policy_violation', 'compliance_score_drop'
  )),
  severity_threshold TEXT CHECK (severity_threshold IN ('low', 'medium', 'high', 'critical')),
  scope_entity_type TEXT CHECK (scope_entity_type IN ('domain', 'vendor', 'policy', 'tenant')),

  -- Actions
  actions JSONB NOT NULL DEFAULT '[]'::jsonb,
  -- [{action: 'alert_email', recipients: ['...']}, {action: 'webhook', url: '...'}, {action: 'auto_remediate', ...}]

  -- Auto-remediation (optional)
  auto_remediate BOOLEAN DEFAULT false,
  remediation_template JSONB,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_compliance_rules_tenant ON public.compliance_alert_rules(tenant_id) WHERE enabled = true;
CREATE INDEX IF NOT EXISTS idx_compliance_rules_trigger ON public.compliance_alert_rules(trigger_event);

COMMENT ON TABLE public.compliance_alert_rules IS 'Configurable rules for compliance monitoring and alerting';

-- 2. Alert escalation chain
CREATE TABLE IF NOT EXISTS public.compliance_escalation_chain (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,

  rule_id UUID NOT NULL REFERENCES public.compliance_alert_rules(id) ON DELETE CASCADE,

  -- Escalation levels (0 = initial, 1-N = escalations)
  level INT NOT NULL CHECK (level >= 0 AND level <= 5),

  -- Escalation action (who/what to notify)
  escalation_action TEXT NOT NULL,
  -- email:<list>, webhook:<url>, sms:<phone>, slack:<channel>

  -- Delay before escalating to next level
  delay_minutes INT NOT NULL DEFAULT 0,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_escalation_rule_id ON public.compliance_escalation_chain(rule_id);

COMMENT ON TABLE public.compliance_escalation_chain IS 'Escalation policies: who gets alerted and when';

-- 3. Alert log (immutable audit trail)
CREATE TABLE IF NOT EXISTS public.compliance_alert_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,

  rule_id UUID REFERENCES public.compliance_alert_rules(id) ON DELETE SET NULL,
  trigger_event TEXT NOT NULL,

  -- What triggered the alert
  entity_type TEXT,
  entity_id TEXT,
  severity TEXT NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  description TEXT,

  -- Alert status
  status TEXT NOT NULL DEFAULT 'triggered' CHECK (status IN ('triggered', 'acknowledged', 'resolved', 'escalated')),
  acknowledged_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  acknowledged_at TIMESTAMPTZ,

  -- Actions taken
  actions_taken JSONB DEFAULT '[]'::jsonb,

  -- Optional: remediation applied
  remediation_id UUID,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_alerts_tenant_status ON public.compliance_alert_log(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_alerts_severity ON public.compliance_alert_log(severity);
CREATE INDEX IF NOT EXISTS idx_alerts_created ON public.compliance_alert_log(created_at DESC);

COMMENT ON TABLE public.compliance_alert_log IS 'Immutable log of all compliance alerts and actions';

-- 4. Remediation tasks (for auto-remediation)
CREATE TABLE IF NOT EXISTS public.compliance_remediation_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,

  alert_id UUID NOT NULL REFERENCES public.compliance_alert_log(id) ON DELETE CASCADE,

  -- Task definition
  task_type TEXT NOT NULL,
  -- 'update_ssl', 'disable_cookie', 'remove_vendor', 'enforce_mfa', etc.

  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,

  -- Status tracking
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'failed', 'skipped')),

  -- Execution details
  executed_at TIMESTAMPTZ,
  execution_result JSONB,
  error_message TEXT,

  -- Approval tracking (if required)
  requires_approval BOOLEAN DEFAULT false,
  approved_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  approved_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_remediation_status ON public.compliance_remediation_tasks(status);
CREATE INDEX IF NOT EXISTS idx_remediation_alert_id ON public.compliance_remediation_tasks(alert_id);

COMMENT ON TABLE public.compliance_remediation_tasks IS 'Auto-remediation tasks triggered by compliance alerts';

-- 5. Enable RLS
ALTER TABLE public.compliance_alert_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.compliance_escalation_chain ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.compliance_alert_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.compliance_remediation_tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY compliance_rules_tenant_read ON public.compliance_alert_rules
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.memberships m
      WHERE m.tenant_id = compliance_alert_rules.tenant_id
        AND m.user_id = auth.uid()
    )
  );

CREATE POLICY compliance_rules_tenant_write ON public.compliance_alert_rules
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.memberships m
      WHERE m.tenant_id = compliance_alert_rules.tenant_id
        AND m.user_id = auth.uid()
        AND m.role IN ('owner', 'admin')
    )
  );

CREATE POLICY compliance_alerts_tenant_read ON public.compliance_alert_log
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.memberships m
      WHERE m.tenant_id = compliance_alert_log.tenant_id
        AND m.user_id = auth.uid()
    )
  );

CREATE POLICY compliance_alerts_service_role_all ON public.compliance_alert_log
  FOR ALL TO service_role USING (true);

CREATE POLICY compliance_remediation_tenant_read ON public.compliance_remediation_tasks
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.memberships m
      WHERE m.tenant_id = compliance_remediation_tasks.tenant_id
        AND m.user_id = auth.uid()
    )
  );

CREATE POLICY compliance_remediation_admin_write ON public.compliance_remediation_tasks
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.memberships m
      WHERE m.tenant_id = compliance_remediation_tasks.tenant_id
        AND m.user_id = auth.uid()
        AND m.role IN ('owner', 'admin')
    )
  );

-- 6. Helper: log compliance alert
CREATE OR REPLACE FUNCTION public.log_compliance_alert(
  p_tenant_id UUID,
  p_rule_id UUID,
  p_trigger_event TEXT,
  p_entity_type TEXT,
  p_entity_id TEXT,
  p_severity TEXT,
  p_description TEXT
)
RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_alert_id UUID;
BEGIN
  INSERT INTO public.compliance_alert_log (
    tenant_id, rule_id, trigger_event,
    entity_type, entity_id, severity, description
  ) VALUES (
    p_tenant_id, p_rule_id, p_trigger_event,
    p_entity_type, p_entity_id, p_severity, p_description
  )
  RETURNING id INTO v_alert_id;

  RETURN v_alert_id;
END;
$$;

REVOKE ALL ON FUNCTION public.log_compliance_alert(UUID, UUID, TEXT, TEXT, TEXT, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.log_compliance_alert(UUID, UUID, TEXT, TEXT, TEXT, TEXT, TEXT) TO anon, authenticated, service_role;

-- 7. Helper: acknowledge alert
CREATE OR REPLACE FUNCTION public.acknowledge_compliance_alert(
  p_alert_id UUID,
  p_user_id UUID
)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  UPDATE public.compliance_alert_log
  SET status = 'acknowledged',
      acknowledged_by = p_user_id,
      acknowledged_at = now()
  WHERE id = p_alert_id;
END;
$$;

REVOKE ALL ON FUNCTION public.acknowledge_compliance_alert(UUID, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.acknowledge_compliance_alert(UUID, UUID) TO anon, authenticated, service_role;

-- 8. Helper: resolve alert
CREATE OR REPLACE FUNCTION public.resolve_compliance_alert(
  p_alert_id UUID
)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  UPDATE public.compliance_alert_log
  SET status = 'resolved',
      resolved_at = now()
  WHERE id = p_alert_id;
END;
$$;

REVOKE ALL ON FUNCTION public.resolve_compliance_alert(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.resolve_compliance_alert(UUID) TO anon, authenticated, service_role;

-- 9. Helper: get unresolved alerts for tenant
CREATE OR REPLACE FUNCTION public.get_unresolved_alerts(p_tenant_id UUID)
RETURNS TABLE (
  id UUID,
  severity TEXT,
  trigger_event TEXT,
  entity_type TEXT,
  created_at TIMESTAMPTZ,
  description TEXT
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  RETURN QUERY
  SELECT
    compliance_alert_log.id,
    compliance_alert_log.severity,
    compliance_alert_log.trigger_event,
    compliance_alert_log.entity_type,
    compliance_alert_log.created_at,
    compliance_alert_log.description
  FROM public.compliance_alert_log
  WHERE tenant_id = p_tenant_id
    AND status != 'resolved'
  ORDER BY created_at DESC;
END;
$$;

REVOKE ALL ON FUNCTION public.get_unresolved_alerts(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_unresolved_alerts(UUID) TO anon, authenticated, service_role;
