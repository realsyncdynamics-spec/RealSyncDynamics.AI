-- Integrations for SEO-Marketing-Dashboard
-- Stores API credentials and sync configuration for external data sources

CREATE TABLE IF NOT EXISTS integrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  provider TEXT NOT NULL,
  provider_account_id TEXT,
  config JSONB DEFAULT '{}'::jsonb,
  last_sync_at TIMESTAMP WITH TIME ZONE,
  sync_interval_minutes INT DEFAULT 60,
  sync_enabled BOOLEAN DEFAULT TRUE,
  status TEXT DEFAULT 'active',
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_integrations_tenant_id ON integrations(tenant_id);
CREATE INDEX idx_integrations_provider ON integrations(provider);

-- Add unique constraint as separate statement
CREATE UNIQUE INDEX idx_integrations_tenant_provider ON integrations(tenant_id, provider);

-- Enable RLS but WITHOUT policy for now - test if table can be created
ALTER TABLE integrations ENABLE ROW LEVEL SECURITY;
