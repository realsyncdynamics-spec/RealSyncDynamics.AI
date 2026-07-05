-- Dashboard Intelligence Layer
--
-- Real-time analytics and AI-powered insights for compliance dashboards.
-- Tracks KPIs, compliance scores, risk trends, and actionable recommendations.

-- 1. Compliance score history (daily snapshots)
CREATE TABLE IF NOT EXISTS public.compliance_score_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,

  -- Daily snapshot of compliance metrics
  score_overall INT NOT NULL CHECK (score_overall >= 0 AND score_overall <= 100),
  score_gdpr INT,
  score_nis2 INT,
  score_dsa INT,
  score_ai_act INT,

  -- Breakdown by category
  policy_compliance INT,
  vendor_risk INT,
  incident_response INT,
  data_governance INT,

  -- Trend indicators
  trend_direction TEXT CHECK (trend_direction IN ('improving', 'stable', 'declining')),
  trend_change_percent NUMERIC(5, 2),

  recorded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_compliance_score_tenant_date ON public.compliance_score_history(tenant_id, recorded_at DESC);
CREATE INDEX IF NOT EXISTS idx_compliance_score_overall ON public.compliance_score_history(score_overall);

COMMENT ON TABLE public.compliance_score_history IS 'Daily snapshots of tenant compliance scores for trend analysis';

-- 2. Risk indicators and alerts summary
CREATE TABLE IF NOT EXISTS public.risk_dashboard_summary (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE UNIQUE,

  -- Current risk metrics
  critical_risks_count INT NOT NULL DEFAULT 0,
  high_risks_count INT NOT NULL DEFAULT 0,
  medium_risks_count INT NOT NULL DEFAULT 0,
  low_risks_count INT NOT NULL DEFAULT 0,

  -- Active issues
  open_incidents_count INT NOT NULL DEFAULT 0,
  overdue_remediations INT NOT NULL DEFAULT 0,
  dpia_assessments_pending INT NOT NULL DEFAULT 0,

  -- Vendor/third-party status
  vendors_requiring_review INT NOT NULL DEFAULT 0,
  sub_processors_added_this_month INT NOT NULL DEFAULT 0,
  vendor_audit_pending INT NOT NULL DEFAULT 0,

  -- Timeline
  last_audit_at TIMESTAMPTZ,
  next_audit_due_at TIMESTAMPTZ,
  last_dpia_completed_at TIMESTAMPTZ,

  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_risk_summary_tenant ON public.risk_dashboard_summary(tenant_id);

COMMENT ON TABLE public.risk_dashboard_summary IS 'Real-time summary of all active risks and compliance issues';

-- 3. Actionable insights and recommendations from AI
CREATE TABLE IF NOT EXISTS public.dashboard_insights (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,

  -- Insight metadata
  insight_type TEXT NOT NULL CHECK (insight_type IN (
    'risk_mitigation', 'policy_gap', 'vendor_concern', 'incident_pattern',
    'dpia_required', 'compliance_opportunity', 'performance_trend', 'automation_opportunity'
  )),

  title TEXT NOT NULL,
  description TEXT,
  severity TEXT CHECK (severity IN ('info', 'warning', 'critical')),

  -- AI-generated recommendation
  recommended_action TEXT,
  estimated_impact TEXT,
  effort_level TEXT CHECK (effort_level IN ('low', 'medium', 'high')),

  -- Relevance and confidence
  confidence_score INT CHECK (confidence_score >= 0 AND confidence_score <= 100),
  is_automated_generated BOOLEAN DEFAULT false,
  source_agent_id TEXT,

  -- Status
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'dismissed', 'actioned', 'resolved')),
  dismissed_at TIMESTAMPTZ,
  resolved_at TIMESTAMPTZ,

  -- Related entities
  entity_type TEXT,
  entity_id TEXT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_insights_tenant_status ON public.dashboard_insights(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_insights_type ON public.dashboard_insights(insight_type);
CREATE INDEX IF NOT EXISTS idx_insights_severity ON public.dashboard_insights(severity);
CREATE INDEX IF NOT EXISTS idx_insights_created ON public.dashboard_insights(created_at DESC);

COMMENT ON TABLE public.dashboard_insights IS 'AI-generated insights and actionable recommendations';

-- 4. Performance metrics and KPIs
CREATE TABLE IF NOT EXISTS public.dashboard_kpis (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE UNIQUE,

  -- Compliance metrics
  domains_active INT NOT NULL DEFAULT 0,
  policies_documented INT NOT NULL DEFAULT 0,
  dpia_assessments_completed INT NOT NULL DEFAULT 0,
  vendors_managed INT NOT NULL DEFAULT 0,

  -- Efficiency metrics
  avg_incident_response_hours NUMERIC(8, 2),
  evidence_collection_completeness NUMERIC(5, 2), -- percentage
  audit_coverage_percent NUMERIC(5, 2),

  -- Cost metrics
  estimated_compliance_spend_monthly NUMERIC(12, 2),
  cost_per_policy_per_year NUMERIC(12, 2),

  -- Timeline
  days_since_last_audit INT,
  days_until_next_audit INT,

  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_kpis_tenant ON public.dashboard_kpis(tenant_id);

COMMENT ON TABLE public.dashboard_kpis IS 'Key performance indicators for compliance dashboards';

-- 5. Dashboard customization and preferences
CREATE TABLE IF NOT EXISTS public.dashboard_user_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Widget visibility and order
  visible_widgets TEXT[] DEFAULT ARRAY['score_card', 'risk_summary', 'incidents', 'insights'],
  widget_order JSONB,

  -- Filter preferences
  preferred_frameworks TEXT[] DEFAULT ARRAY['gdpr', 'nis2'],
  preferred_severity_filter TEXT DEFAULT 'medium', -- 'low', 'medium', 'high', 'critical'

  -- Notification preferences
  digest_frequency TEXT CHECK (digest_frequency IN ('daily', 'weekly', 'monthly', 'never')),
  alert_on_critical BOOLEAN DEFAULT true,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE(tenant_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_dashboard_prefs_tenant_user ON public.dashboard_user_preferences(tenant_id, user_id);

COMMENT ON TABLE public.dashboard_user_preferences IS 'Per-user dashboard customization';

-- 6. Enable RLS
ALTER TABLE public.compliance_score_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.risk_dashboard_summary ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dashboard_insights ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dashboard_kpis ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dashboard_user_preferences ENABLE ROW LEVEL SECURITY;

-- RLS Policies: tenant members can view their own dashboard data
CREATE POLICY compliance_scores_tenant_read ON public.compliance_score_history
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.memberships m
      WHERE m.tenant_id = compliance_score_history.tenant_id
        AND m.user_id = auth.uid()
    )
  );

CREATE POLICY risk_summary_tenant_read ON public.risk_dashboard_summary
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.memberships m
      WHERE m.tenant_id = risk_dashboard_summary.tenant_id
        AND m.user_id = auth.uid()
    )
  );

CREATE POLICY insights_tenant_read ON public.dashboard_insights
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.memberships m
      WHERE m.tenant_id = dashboard_insights.tenant_id
        AND m.user_id = auth.uid()
    )
  );

CREATE POLICY kpis_tenant_read ON public.dashboard_kpis
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.memberships m
      WHERE m.tenant_id = dashboard_kpis.tenant_id
        AND m.user_id = auth.uid()
    )
  );

-- Preferences: users can only see/edit their own
CREATE POLICY dashboard_prefs_user_read ON public.dashboard_user_preferences
  FOR SELECT USING (
    user_id = auth.uid()
  );

CREATE POLICY dashboard_prefs_user_write ON public.dashboard_user_preferences
  FOR ALL USING (
    user_id = auth.uid()
  );

-- Service role can write to dashboard tables
CREATE POLICY compliance_scores_service_role_all ON public.compliance_score_history
  FOR ALL TO service_role USING (true);

CREATE POLICY risk_summary_service_role_all ON public.risk_dashboard_summary
  FOR ALL TO service_role USING (true);

CREATE POLICY insights_service_role_all ON public.dashboard_insights
  FOR ALL TO service_role USING (true);

CREATE POLICY kpis_service_role_all ON public.dashboard_kpis
  FOR ALL TO service_role USING (true);

-- 7. Helper function: update compliance score history
CREATE OR REPLACE FUNCTION public.update_compliance_score(
  p_tenant_id UUID,
  p_score_overall INT,
  p_score_gdpr INT,
  p_score_nis2 INT,
  p_score_dsa INT,
  p_score_ai_act INT,
  p_policy_compliance INT,
  p_vendor_risk INT,
  p_incident_response INT,
  p_data_governance INT
)
RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_prev_score INT;
  v_trend_direction TEXT;
  v_trend_change NUMERIC;
  v_record_id UUID;
BEGIN
  -- Get previous score for trend calculation
  SELECT score_overall INTO v_prev_score
  FROM public.compliance_score_history
  WHERE tenant_id = p_tenant_id
  ORDER BY recorded_at DESC
  LIMIT 1;

  -- Calculate trend
  IF v_prev_score IS NOT NULL THEN
    v_trend_change := ROUND(((p_score_overall::NUMERIC - v_prev_score::NUMERIC) / v_prev_score::NUMERIC * 100)::NUMERIC, 2);
    IF v_trend_change > 2 THEN
      v_trend_direction := 'improving';
    ELSIF v_trend_change < -2 THEN
      v_trend_direction := 'declining';
    ELSE
      v_trend_direction := 'stable';
    END IF;
  ELSE
    v_trend_change := 0;
    v_trend_direction := 'stable';
  END IF;

  -- Insert new score record
  INSERT INTO public.compliance_score_history (
    tenant_id, score_overall, score_gdpr, score_nis2, score_dsa, score_ai_act,
    policy_compliance, vendor_risk, incident_response, data_governance,
    trend_direction, trend_change_percent
  ) VALUES (
    p_tenant_id, p_score_overall, p_score_gdpr, p_score_nis2, p_score_dsa, p_score_ai_act,
    p_policy_compliance, p_vendor_risk, p_incident_response, p_data_governance,
    v_trend_direction, v_trend_change
  )
  RETURNING id INTO v_record_id;

  RETURN v_record_id;
END;
$$;

REVOKE ALL ON FUNCTION public.update_compliance_score(UUID, INT, INT, INT, INT, INT, INT, INT, INT, INT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.update_compliance_score(UUID, INT, INT, INT, INT, INT, INT, INT, INT, INT) TO anon, authenticated, service_role;

-- 8. Helper function: get latest dashboard summary
CREATE OR REPLACE FUNCTION public.get_dashboard_summary(p_tenant_id UUID)
RETURNS JSON
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_summary JSON;
BEGIN
  SELECT json_build_object(
    'compliance_score', (
      SELECT row_to_json(r) FROM (
        SELECT score_overall, score_gdpr, score_nis2, trend_direction, recorded_at
        FROM public.compliance_score_history
        WHERE tenant_id = p_tenant_id
        ORDER BY recorded_at DESC
        LIMIT 1
      ) r
    ),
    'risks', (
      SELECT row_to_json(r) FROM (
        SELECT critical_risks_count, high_risks_count, medium_risks_count, low_risks_count,
               open_incidents_count, overdue_remediations, updated_at
        FROM public.risk_dashboard_summary
        WHERE tenant_id = p_tenant_id
      ) r
    ),
    'insights', (
      SELECT json_agg(json_build_object(
        'id', id, 'type', insight_type, 'title', title,
        'severity', severity, 'status', status, 'created_at', created_at
      ) ORDER BY created_at DESC) FILTER (WHERE status = 'active')
      FROM public.dashboard_insights
      WHERE tenant_id = p_tenant_id
      LIMIT 5
    ),
    'kpis', (
      SELECT row_to_json(r) FROM (
        SELECT domains_active, policies_documented, vendors_managed,
               avg_incident_response_hours, audit_coverage_percent
        FROM public.dashboard_kpis
        WHERE tenant_id = p_tenant_id
      ) r
    )
  ) INTO v_summary;

  RETURN v_summary;
END;
$$;

REVOKE ALL ON FUNCTION public.get_dashboard_summary(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_dashboard_summary(UUID) TO anon, authenticated, service_role;

-- 9. Helper function: add dashboard insight
CREATE OR REPLACE FUNCTION public.add_dashboard_insight(
  p_tenant_id UUID,
  p_insight_type TEXT,
  p_title TEXT,
  p_description TEXT,
  p_severity TEXT,
  p_recommended_action TEXT,
  p_confidence_score INT,
  p_is_automated BOOLEAN,
  p_source_agent_id TEXT
)
RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_insight_id UUID;
BEGIN
  INSERT INTO public.dashboard_insights (
    tenant_id, insight_type, title, description, severity,
    recommended_action, confidence_score, is_automated_generated, source_agent_id
  ) VALUES (
    p_tenant_id, p_insight_type, p_title, p_description, p_severity,
    p_recommended_action, p_confidence_score, p_is_automated, p_source_agent_id
  )
  RETURNING id INTO v_insight_id;

  RETURN v_insight_id;
END;
$$;

REVOKE ALL ON FUNCTION public.add_dashboard_insight(UUID, TEXT, TEXT, TEXT, TEXT, TEXT, INT, BOOLEAN, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.add_dashboard_insight(UUID, TEXT, TEXT, TEXT, TEXT, TEXT, INT, BOOLEAN, TEXT) TO anon, authenticated, service_role;
