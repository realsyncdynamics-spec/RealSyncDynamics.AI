-- Compliance & Audit Logging for SEO-Marketing-Dashboard
-- Tracks all dashboard access, exports, and operations for DSGVO & EU AI Act compliance

-- Create audit log table for dashboard operations
CREATE TABLE IF NOT EXISTS seo_dashboard_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  operation_type VARCHAR(50) NOT NULL, -- view, export, filter_apply, sync_trigger, integration_connect
  resource_type VARCHAR(50) NOT NULL, -- dashboard, metrics, export, integration, tool_config
  resource_id TEXT,
  action_details JSONB DEFAULT '{}', -- stores operation params (filters, export format, etc)
  data_sensitivity_level VARCHAR(20) DEFAULT 'high', -- high, medium, low based on data exported
  ip_address INET,
  user_agent TEXT,
  success BOOLEAN DEFAULT TRUE,
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  archived_at TIMESTAMP WITH TIME ZONE
);

-- Create data retention policy table
CREATE TABLE IF NOT EXISTS seo_dashboard_data_policies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL UNIQUE REFERENCES public.tenants(id) ON DELETE CASCADE,
  retention_days_operational INT DEFAULT 90, -- how long to keep operational metrics
  retention_days_audit INT DEFAULT 365, -- how long to keep audit logs
  retention_days_exports INT DEFAULT 30, -- how long to keep export records
  gdpr_right_to_deletion_enabled BOOLEAN DEFAULT TRUE,
  auto_anonymize_old_records BOOLEAN DEFAULT TRUE,
  anonymization_threshold_days INT DEFAULT 180,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create export registry for tracking data exports
CREATE TABLE IF NOT EXISTS seo_dashboard_exports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  export_type VARCHAR(20) NOT NULL, -- csv, json, pdf
  record_count INT DEFAULT 0,
  data_classification VARCHAR(50) DEFAULT 'business', -- business, sensitive, financial, personal
  file_path TEXT, -- path to stored export file
  checksum TEXT, -- sha256 hash for integrity verification
  deleted_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create compliance report template table
CREATE TABLE IF NOT EXISTS seo_dashboard_compliance_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  generated_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  report_type VARCHAR(50) NOT NULL, -- dsgvo_access_log, eu_ai_act_audit, data_processing, export_history
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  summary JSONB, -- key metrics about the period
  audit_records_count INT DEFAULT 0,
  compliance_checks JSONB DEFAULT '{}', -- results of compliance validations
  generated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  archived_at TIMESTAMP WITH TIME ZONE
);

-- Enable RLS on all new tables
ALTER TABLE seo_dashboard_audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE seo_dashboard_data_policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE seo_dashboard_exports ENABLE ROW LEVEL SECURITY;
ALTER TABLE seo_dashboard_compliance_reports ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can only see audit logs for their tenant
CREATE POLICY seo_dashboard_audit_log_tenant_access ON public.seo_dashboard_audit_log
  FOR SELECT
  USING (public.is_tenant_member(tenant_id));

-- RLS Policy: Users can insert audit logs for their tenant
CREATE POLICY seo_dashboard_audit_log_insert ON public.seo_dashboard_audit_log
  FOR INSERT
  WITH CHECK (public.is_tenant_member(tenant_id));

-- RLS Policy: Only admins can view audit logs (stricter than SELECT)
CREATE POLICY seo_dashboard_audit_log_admin_only ON public.seo_dashboard_audit_log
  FOR SELECT
  USING (
    public.is_tenant_member(tenant_id) AND
    EXISTS (
      SELECT 1 FROM public.team_members
      WHERE team_members.user_id = auth.uid()
      AND team_members.tenant_id = seo_dashboard_audit_log.tenant_id
      AND team_members.role IN ('admin', 'owner')
    )
  );

-- RLS Policy: Data policies accessible to tenant members
CREATE POLICY seo_dashboard_data_policies_read ON public.seo_dashboard_data_policies
  FOR SELECT
  USING (public.is_tenant_member(tenant_id));

-- RLS Policy: Only admins can update data policies
CREATE POLICY seo_dashboard_data_policies_update ON public.seo_dashboard_data_policies
  FOR UPDATE
  USING (
    public.is_tenant_member(tenant_id) AND
    EXISTS (
      SELECT 1 FROM public.team_members
      WHERE team_members.user_id = auth.uid()
      AND team_members.tenant_id = seo_dashboard_data_policies.tenant_id
      AND team_members.role IN ('admin', 'owner')
    )
  );

-- RLS Policy: Export registry accessible to tenant members
CREATE POLICY seo_dashboard_exports_read ON public.seo_dashboard_exports
  FOR SELECT
  USING (public.is_tenant_member(tenant_id));

-- RLS Policy: Users can insert their own exports
CREATE POLICY seo_dashboard_exports_insert ON public.seo_dashboard_exports
  FOR INSERT
  WITH CHECK (
    public.is_tenant_member(tenant_id) AND
    created_by = auth.uid()
  );

-- RLS Policy: Compliance reports for tenant members
CREATE POLICY seo_dashboard_compliance_reports_read ON public.seo_dashboard_compliance_reports
  FOR SELECT
  USING (public.is_tenant_member(tenant_id));

-- RLS Policy: Only admins can generate compliance reports
CREATE POLICY seo_dashboard_compliance_reports_insert ON public.seo_dashboard_compliance_reports
  FOR INSERT
  WITH CHECK (
    public.is_tenant_member(tenant_id) AND
    EXISTS (
      SELECT 1 FROM public.team_members
      WHERE team_members.user_id = auth.uid()
      AND team_members.tenant_id = seo_dashboard_compliance_reports.tenant_id
      AND team_members.role IN ('admin', 'owner')
    )
  );

-- Create indexes for audit performance
CREATE INDEX idx_audit_log_tenant_created ON public.seo_dashboard_audit_log(tenant_id, created_at DESC);
CREATE INDEX idx_audit_log_user_created ON public.seo_dashboard_audit_log(user_id, created_at DESC);
CREATE INDEX idx_audit_log_operation_type ON public.seo_dashboard_audit_log(operation_type);
CREATE INDEX idx_audit_log_resource ON public.seo_dashboard_audit_log(resource_type, resource_id);

CREATE INDEX idx_exports_tenant_created ON public.seo_dashboard_exports(tenant_id, created_at DESC);
CREATE INDEX idx_exports_user ON public.seo_dashboard_exports(created_by);
CREATE INDEX idx_exports_deleted ON public.seo_dashboard_exports(deleted_at) WHERE deleted_at IS NOT NULL;

CREATE INDEX idx_compliance_reports_tenant ON public.seo_dashboard_compliance_reports(tenant_id, generated_at DESC);
CREATE INDEX idx_compliance_reports_period ON public.seo_dashboard_compliance_reports(period_start, period_end);

-- Create trigger function for automatic audit log insertion
CREATE OR REPLACE FUNCTION log_seo_dashboard_operation(
  p_tenant_id UUID,
  p_user_id UUID,
  p_operation_type VARCHAR,
  p_resource_type VARCHAR,
  p_resource_id TEXT DEFAULT NULL,
  p_action_details JSONB DEFAULT '{}',
  p_data_sensitivity_level VARCHAR DEFAULT 'high'
)
RETURNS UUID AS $$
DECLARE
  v_log_id UUID;
BEGIN
  INSERT INTO seo_dashboard_audit_log (
    tenant_id, user_id, operation_type, resource_type, resource_id,
    action_details, data_sensitivity_level, ip_address, user_agent
  )
  VALUES (
    p_tenant_id, p_user_id, p_operation_type, p_resource_type, p_resource_id,
    p_action_details, p_data_sensitivity_level,
    CASE WHEN current_setting('request.headers')::json->>'cf-connecting-ip' IS NOT NULL
         THEN (current_setting('request.headers')::json->>'cf-connecting-ip')::INET
         ELSE NULL END,
    current_setting('request.headers')::json->>'user-agent'
  )
  RETURNING id INTO v_log_id;
  RETURN v_log_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger function to auto-log export creation
CREATE OR REPLACE FUNCTION audit_seo_export_creation()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM log_seo_dashboard_operation(
    NEW.tenant_id,
    NEW.created_by,
    'export',
    'export',
    NEW.id::TEXT,
    jsonb_build_object('export_type', NEW.export_type, 'record_count', NEW.record_count),
    NEW.data_classification
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER seo_export_audit_trigger AFTER INSERT ON public.seo_dashboard_exports
FOR EACH ROW EXECUTE FUNCTION audit_seo_export_creation();

-- Create view for audit dashboard
CREATE OR REPLACE VIEW seo_audit_summary AS
SELECT
  audit.tenant_id,
  COUNT(*) AS total_operations,
  COUNT(DISTINCT audit.user_id) AS unique_users,
  COUNT(DISTINCT DATE(audit.created_at)) AS active_days,
  COUNT(CASE WHEN audit.operation_type = 'export' THEN 1 END) AS export_count,
  COUNT(CASE WHEN audit.operation_type = 'view' THEN 1 END) AS view_count,
  COUNT(CASE WHEN audit.success = FALSE THEN 1 END) AS error_count,
  MAX(audit.created_at) AS last_operation_at,
  MIN(audit.created_at) AS first_operation_at
FROM seo_dashboard_audit_log audit
WHERE audit.archived_at IS NULL
GROUP BY audit.tenant_id;

-- Create view for compliance readiness
CREATE OR REPLACE VIEW seo_compliance_readiness AS
SELECT
  t.id AS tenant_id,
  t.name AS tenant_name,
  COALESCE(dp.retention_days_audit, 365) AS audit_retention_days,
  COALESCE(dp.gdpr_right_to_deletion_enabled, TRUE) AS gdpr_enabled,
  CASE
    WHEN COUNT(audit.id) > 0 THEN 'active'
    ELSE 'no_activity'
  END AS audit_status,
  COUNT(audit.id) AS audit_record_count,
  MAX(audit.created_at) AS last_audit_at,
  COALESCE(COUNT(DISTINCT DATE(audit.created_at)), 0) AS audit_days_active
FROM public.tenants t
LEFT JOIN public.seo_dashboard_data_policies dp ON t.id = dp.tenant_id
LEFT JOIN public.seo_dashboard_audit_log audit ON t.id = audit.tenant_id AND audit.archived_at IS NULL
GROUP BY t.id, t.name, dp.retention_days_audit, dp.gdpr_right_to_deletion_enabled;

-- Create function to generate DSGVO access report
CREATE OR REPLACE FUNCTION generate_dsgvo_access_report(
  p_tenant_id UUID,
  p_start_date DATE,
  p_end_date DATE
)
RETURNS TABLE (
  user_id UUID,
  user_email VARCHAR,
  operation_count INT,
  export_count INT,
  last_access TIMESTAMP WITH TIME ZONE,
  operations JSONB
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    audit.user_id,
    u.email,
    COUNT(*)::INT AS operation_count,
    COUNT(CASE WHEN audit.operation_type = 'export' THEN 1 END)::INT AS export_count,
    MAX(audit.created_at)::TIMESTAMP WITH TIME ZONE AS last_access,
    jsonb_agg(
      jsonb_build_object(
        'operation', audit.operation_type,
        'timestamp', audit.created_at,
        'resource', audit.resource_type,
        'success', audit.success
      )
    ) AS operations
  FROM seo_dashboard_audit_log audit
  JOIN auth.users u ON audit.user_id = u.id
  WHERE audit.tenant_id = p_tenant_id
    AND DATE(audit.created_at) >= p_start_date
    AND DATE(audit.created_at) <= p_end_date
    AND audit.archived_at IS NULL
  GROUP BY audit.user_id, u.email
  ORDER BY COUNT(*) DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to generate EU AI Act audit trail
CREATE OR REPLACE FUNCTION generate_eu_ai_act_audit(
  p_tenant_id UUID,
  p_start_date DATE,
  p_end_date DATE
)
RETURNS TABLE (
  date DATE,
  operation_type VARCHAR,
  resource_type VARCHAR,
  user_count INT,
  operation_count INT,
  error_count INT,
  sensitive_operations JSONB
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    DATE(audit.created_at)::DATE AS date,
    audit.operation_type,
    audit.resource_type,
    COUNT(DISTINCT audit.user_id)::INT AS user_count,
    COUNT(*)::INT AS operation_count,
    COUNT(CASE WHEN audit.success = FALSE THEN 1 END)::INT AS error_count,
    jsonb_agg(
      jsonb_build_object(
        'timestamp', audit.created_at,
        'user_id', audit.user_id,
        'action_details', audit.action_details
      )
    ) FILTER (WHERE audit.data_sensitivity_level = 'high') AS sensitive_operations
  FROM seo_dashboard_audit_log audit
  WHERE audit.tenant_id = p_tenant_id
    AND DATE(audit.created_at) >= p_start_date
    AND DATE(audit.created_at) <= p_end_date
    AND audit.archived_at IS NULL
  GROUP BY DATE(audit.created_at), audit.operation_type, audit.resource_type
  ORDER BY DATE(audit.created_at) DESC, operation_count DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add audit trigger to existing seo_marketing_dashboard tables
CREATE TRIGGER audit_marketing_metrics_changes AFTER INSERT OR UPDATE OR DELETE ON public.marketing_metrics
FOR EACH ROW EXECUTE FUNCTION audit_seo_marketing_changes();

CREATE TRIGGER audit_integrations_changes AFTER INSERT OR UPDATE OR DELETE ON public.integrations
FOR EACH ROW EXECUTE FUNCTION audit_seo_marketing_changes();

CREATE TRIGGER audit_seo_tool_tracking_changes AFTER INSERT OR UPDATE OR DELETE ON public.seo_tool_tracking
FOR EACH ROW EXECUTE FUNCTION audit_seo_marketing_changes();
