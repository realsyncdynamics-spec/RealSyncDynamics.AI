-- Integrations for SEO-Marketing-Dashboard
-- Stores API credentials and sync configuration for external data sources

CREATE TABLE IF NOT EXISTS integrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,

  -- Provider identification
  provider VARCHAR(100) NOT NULL,
  provider_account_id VARCHAR(255),

  -- Configuration (encrypted at rest in production)
  config JSONB DEFAULT '{}'::jsonb,

  -- Sync configuration
  last_sync_at TIMESTAMP WITH TIME ZONE,
  sync_interval_minutes INT DEFAULT 60,
  sync_enabled BOOLEAN DEFAULT TRUE,

  -- Status
  status VARCHAR(50) DEFAULT 'active',
  error_message TEXT,

  -- Metadata
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  UNIQUE(tenant_id, provider)
);

CREATE INDEX idx_integrations_tenant_id ON integrations(tenant_id);
CREATE INDEX idx_integrations_provider ON integrations(provider);
CREATE INDEX idx_integrations_last_sync_at ON integrations(last_sync_at);

-- Enable RLS
ALTER TABLE integrations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "integrations_tenant_isolation"
  ON integrations
  FOR ALL
  USING (public.is_tenant_member(tenant_id))
  WITH CHECK (public.is_tenant_member(tenant_id));

-- Sync jobs tracking
CREATE TABLE IF NOT EXISTS data_sync_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  integration_id UUID NOT NULL REFERENCES public.integrations(id) ON DELETE CASCADE,

  -- Job details
  job_type VARCHAR(100) NOT NULL,
  status VARCHAR(50) DEFAULT 'pending',
  progress_percent INT DEFAULT 0,

  -- Time tracking
  started_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  scheduled_for TIMESTAMP WITH TIME ZONE,

  -- Error handling
  error_message TEXT,
  retry_count INT DEFAULT 0,
  max_retries INT DEFAULT 3,

  -- Metadata
  records_synced INT DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_data_sync_jobs_tenant_id ON data_sync_jobs(tenant_id);
CREATE INDEX idx_data_sync_jobs_status ON data_sync_jobs(status);
CREATE INDEX idx_data_sync_jobs_integration_id ON data_sync_jobs(integration_id);

-- Enable RLS
ALTER TABLE data_sync_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "data_sync_jobs_tenant_isolation"
  ON data_sync_jobs
  FOR ALL
  USING (public.is_tenant_member(tenant_id))
  WITH CHECK (public.is_tenant_member(tenant_id));

-- Audit logging for integrations
CREATE TRIGGER audit_integrations AFTER INSERT OR UPDATE ON integrations
FOR EACH ROW EXECUTE FUNCTION audit_seo_marketing_changes();

CREATE TRIGGER audit_data_sync_jobs AFTER INSERT OR UPDATE ON data_sync_jobs
FOR EACH ROW EXECUTE FUNCTION audit_seo_marketing_changes();
