-- SEO-Marketing-SaaS-Dashboard Schema
-- RLS-protected tables for multi-tenant marketing metrics tracking

-- 1. Marketing Metrics (Lead & Conversion Tracking)
CREATE TABLE IF NOT EXISTS marketing_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,

  -- Time Period
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,

  -- Visitor & Lead Metrics
  web_visitors INT DEFAULT 0,
  leads_generated INT DEFAULT 0,
  leads_qualified INT DEFAULT 0,
  trials_started INT DEFAULT 0,
  customers_acquired INT DEFAULT 0,

  -- Revenue Metrics
  revenue_generated DECIMAL(12,2) DEFAULT 0,
  average_revenue_per_user DECIMAL(12,2) DEFAULT 0,
  monthly_recurring_revenue DECIMAL(12,2) DEFAULT 0,

  -- Metadata
  data_source VARCHAR(100) DEFAULT 'manual',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  UNIQUE(tenant_id, period_start, period_end)
);

CREATE INDEX idx_marketing_metrics_tenant_id ON marketing_metrics(tenant_id);
CREATE INDEX idx_marketing_metrics_period ON marketing_metrics(period_start, period_end);

-- Enable RLS
ALTER TABLE marketing_metrics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "marketing_metrics_tenant_isolation"
  ON marketing_metrics
  FOR ALL
  USING (tenant_id IN (SELECT id FROM public.tenants WHERE id = auth.uid()::UUID OR id IN (
    SELECT tenant_id FROM public.team_members WHERE user_id = auth.uid()
  )))
  WITH CHECK (tenant_id IN (SELECT id FROM public.tenants WHERE id = auth.uid()::UUID OR id IN (
    SELECT tenant_id FROM public.team_members WHERE user_id = auth.uid()
  )));

-- 2. Customer Lifecycle (CAC & LTV Tracking)
CREATE TABLE IF NOT EXISTS customer_lifecycle (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  customer_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Acquisition Metrics
  acquisition_date DATE NOT NULL,
  customer_acquisition_cost DECIMAL(12,2),
  acquisition_channel VARCHAR(100),

  -- Lifetime Value & Retention
  lifetime_value DECIMAL(12,2) DEFAULT 0,
  predicted_ltv DECIMAL(12,2),
  churn_risk_score INT DEFAULT 0,
  retention_months INT DEFAULT 0,

  -- Status
  status VARCHAR(50) DEFAULT 'active',
  churn_date DATE,

  -- Metadata
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_customer_lifecycle_tenant_id ON customer_lifecycle(tenant_id);
CREATE INDEX idx_customer_lifecycle_acquisition_date ON customer_lifecycle(acquisition_date);

-- Enable RLS
ALTER TABLE customer_lifecycle ENABLE ROW LEVEL SECURITY;

CREATE POLICY "customer_lifecycle_tenant_isolation"
  ON customer_lifecycle
  FOR ALL
  USING (tenant_id IN (SELECT id FROM public.tenants WHERE id = auth.uid()::UUID OR id IN (
    SELECT tenant_id FROM public.team_members WHERE user_id = auth.uid()
  )))
  WITH CHECK (tenant_id IN (SELECT id FROM public.tenants WHERE id = auth.uid()::UUID OR id IN (
    SELECT tenant_id FROM public.team_members WHERE user_id = auth.uid()
  )));

-- 3. SEO Tool Tracking (Shadow SaaS Visibility)
CREATE TABLE IF NOT EXISTS seo_tool_tracking (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,

  -- Tool Identification
  tool_name VARCHAR(255) NOT NULL,
  tool_category VARCHAR(100) NOT NULL,
  tool_url VARCHAR(500),

  -- Usage Metrics
  active_users INT DEFAULT 0,
  monthly_usage_count INT DEFAULT 0,

  -- Security & Governance
  risk_level VARCHAR(50) CHECK (risk_level IN ('low', 'medium', 'high')) DEFAULT 'medium',
  sso_enabled BOOLEAN DEFAULT FALSE,
  account_type VARCHAR(50) CHECK (account_type IN ('business', 'personal')) DEFAULT 'personal',
  data_exposure_risk BOOLEAN DEFAULT FALSE,

  -- Compliance
  data_residency VARCHAR(50) DEFAULT 'unknown',
  compliance_status VARCHAR(50) DEFAULT 'unverified',

  -- Metadata
  discovered_date DATE NOT NULL,
  last_activity DATE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  UNIQUE(tenant_id, tool_name, discovered_date)
);

CREATE INDEX idx_seo_tool_tracking_tenant_id ON seo_tool_tracking(tenant_id);
CREATE INDEX idx_seo_tool_tracking_risk_level ON seo_tool_tracking(risk_level);

-- Enable RLS
ALTER TABLE seo_tool_tracking ENABLE ROW LEVEL SECURITY;

CREATE POLICY "seo_tool_tracking_tenant_isolation"
  ON seo_tool_tracking
  FOR ALL
  USING (tenant_id IN (SELECT id FROM public.tenants WHERE id = auth.uid()::UUID OR id IN (
    SELECT tenant_id FROM public.team_members WHERE user_id = auth.uid()
  )))
  WITH CHECK (tenant_id IN (SELECT id FROM public.tenants WHERE id = auth.uid()::UUID OR id IN (
    SELECT tenant_id FROM public.team_members WHERE user_id = auth.uid()
  )));

-- 4. Security & Governance Events
CREATE TABLE IF NOT EXISTS seo_security_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,

  -- Event Type
  event_type VARCHAR(100) NOT NULL,
  event_description TEXT,

  -- Security Context
  sso_used BOOLEAN DEFAULT FALSE,
  account_type VARCHAR(50),
  copy_paste_detected BOOLEAN DEFAULT FALSE,
  data_copied_to_ai BOOLEAN DEFAULT FALSE,

  -- Risk Assessment
  severity VARCHAR(50) CHECK (severity IN ('low', 'medium', 'high')) DEFAULT 'medium',

  -- Metadata
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  ip_address INET,
  user_agent TEXT
);

CREATE INDEX idx_seo_security_events_tenant_id ON seo_security_events(tenant_id);
CREATE INDEX idx_seo_security_events_created_at ON seo_security_events(created_at);

-- Enable RLS
ALTER TABLE seo_security_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "seo_security_events_tenant_isolation"
  ON seo_security_events
  FOR ALL
  USING (tenant_id IN (SELECT id FROM public.tenants WHERE id = auth.uid()::UUID OR id IN (
    SELECT tenant_id FROM public.team_members WHERE user_id = auth.uid()
  )))
  WITH CHECK (tenant_id IN (SELECT id FROM public.tenants WHERE id = auth.uid()::UUID OR id IN (
    SELECT tenant_id FROM public.team_members WHERE user_id = auth.uid()
  )));

-- Create audit logging trigger
CREATE OR REPLACE FUNCTION audit_seo_marketing_changes()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO audit_logs (table_name, record_id, action, old_values, new_values, tenant_id, created_by)
  VALUES (
    TG_TABLE_NAME,
    COALESCE(NEW.id, OLD.id),
    TG_OP,
    to_jsonb(OLD),
    to_jsonb(NEW),
    COALESCE(NEW.tenant_id, OLD.tenant_id),
    auth.uid()
  );
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER audit_marketing_metrics AFTER INSERT OR UPDATE ON marketing_metrics
FOR EACH ROW EXECUTE FUNCTION audit_seo_marketing_changes();

CREATE TRIGGER audit_customer_lifecycle AFTER INSERT OR UPDATE ON customer_lifecycle
FOR EACH ROW EXECUTE FUNCTION audit_seo_marketing_changes();

CREATE TRIGGER audit_seo_tool_tracking AFTER INSERT OR UPDATE ON seo_tool_tracking
FOR EACH ROW EXECUTE FUNCTION audit_seo_marketing_changes();

CREATE TRIGGER audit_seo_security_events AFTER INSERT ON seo_security_events
FOR EACH ROW EXECUTE FUNCTION audit_seo_marketing_changes();
