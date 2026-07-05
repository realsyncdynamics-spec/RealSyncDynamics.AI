-- Phase 5B: Custom Frameworks & Integrations

-- Table: custom_frameworks
CREATE TABLE IF NOT EXISTS custom_frameworks (
  id TEXT PRIMARY KEY DEFAULT 'cf-' || gen_random_uuid()::text,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  based_on TEXT, -- 'iso27001', 'iso42001', 'nist', 'cis', 'blank', or another framework ID
  version TEXT NOT NULL DEFAULT '1.0.0',
  is_published BOOLEAN DEFAULT false,
  created_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_by UUID REFERENCES auth.users(id)
);

-- Table: custom_controls
CREATE TABLE IF NOT EXISTS custom_controls (
  id TEXT PRIMARY KEY DEFAULT 'cc-' || gen_random_uuid()::text,
  framework_id TEXT NOT NULL REFERENCES custom_frameworks(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  criteria JSONB, -- Array of assessment criteria
  maturity_levels JSONB, -- Array of {level: 0-5, description: string}
  evidence_requirements JSONB, -- Array of evidence types required
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Table: custom_framework_mappings
CREATE TABLE IF NOT EXISTS custom_framework_mappings (
  id TEXT PRIMARY KEY DEFAULT 'cfm-' || gen_random_uuid()::text,
  framework_id TEXT NOT NULL REFERENCES custom_frameworks(id) ON DELETE CASCADE,
  standard_framework TEXT NOT NULL, -- 'ai_act', 'dsgvo', 'nis2', 'hipaa'
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Table: webhook_endpoints
CREATE TABLE IF NOT EXISTS webhook_endpoints (
  id TEXT PRIMARY KEY DEFAULT 'wh-' || gen_random_uuid()::text,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  url TEXT NOT NULL,
  events TEXT[] NOT NULL, -- Array of event types to subscribe to
  active BOOLEAN DEFAULT true,
  signing_secret TEXT NOT NULL,
  retry_policy TEXT DEFAULT 'exponential', -- 'exponential', 'linear', 'once'
  custom_headers JSONB,
  last_delivery_at TIMESTAMP WITH TIME ZONE,
  failure_count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Table: webhook_deliveries
CREATE TABLE IF NOT EXISTS webhook_deliveries (
  id TEXT PRIMARY KEY DEFAULT 'del-' || gen_random_uuid()::text,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  endpoint_id TEXT NOT NULL REFERENCES webhook_endpoints(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  status TEXT NOT NULL, -- 'success', 'failed', 'retrying', 'pending'
  status_code INTEGER,
  payload JSONB,
  response_body TEXT,
  sent_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  next_retry_at TIMESTAMP WITH TIME ZONE,
  retry_count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_custom_frameworks_tenant_id ON custom_frameworks(tenant_id);
CREATE INDEX IF NOT EXISTS idx_custom_frameworks_created_at ON custom_frameworks(created_at);
CREATE INDEX IF NOT EXISTS idx_custom_frameworks_based_on ON custom_frameworks(based_on);

CREATE INDEX IF NOT EXISTS idx_custom_controls_framework_id ON custom_controls(framework_id);

CREATE INDEX IF NOT EXISTS idx_custom_framework_mappings_framework_id ON custom_framework_mappings(framework_id);
CREATE INDEX IF NOT EXISTS idx_custom_framework_mappings_standard ON custom_framework_mappings(standard_framework);

CREATE INDEX IF NOT EXISTS idx_webhook_endpoints_tenant_id ON webhook_endpoints(tenant_id);
CREATE INDEX IF NOT EXISTS idx_webhook_endpoints_active ON webhook_endpoints(active);

CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_tenant_id ON webhook_deliveries(tenant_id);
CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_endpoint_id ON webhook_deliveries(endpoint_id);
CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_status ON webhook_deliveries(status);
CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_sent_at ON webhook_deliveries(sent_at DESC);

-- Trigger: Update custom_frameworks.updated_at
CREATE OR REPLACE FUNCTION update_custom_frameworks_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS custom_frameworks_updated_at_trigger ON custom_frameworks;
CREATE TRIGGER custom_frameworks_updated_at_trigger
BEFORE UPDATE ON custom_frameworks
FOR EACH ROW
EXECUTE FUNCTION update_custom_frameworks_updated_at();

-- Trigger: Update webhook_endpoints.updated_at
CREATE OR REPLACE FUNCTION update_webhook_endpoints_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS webhook_endpoints_updated_at_trigger ON webhook_endpoints;
CREATE TRIGGER webhook_endpoints_updated_at_trigger
BEFORE UPDATE ON webhook_endpoints
FOR EACH ROW
EXECUTE FUNCTION update_webhook_endpoints_updated_at();

-- RLS: Enable RLS on all tables
ALTER TABLE custom_frameworks ENABLE ROW LEVEL SECURITY;
ALTER TABLE custom_controls ENABLE ROW LEVEL SECURITY;
ALTER TABLE custom_framework_mappings ENABLE ROW LEVEL SECURITY;
ALTER TABLE webhook_endpoints ENABLE ROW LEVEL SECURITY;
ALTER TABLE webhook_deliveries ENABLE ROW LEVEL SECURITY;

-- RLS: custom_frameworks
CREATE POLICY "Users can read frameworks in their tenant"
ON custom_frameworks FOR SELECT
USING (tenant_id = auth.jwt() ->> 'tenant_id');

CREATE POLICY "Users can create frameworks in their tenant"
ON custom_frameworks FOR INSERT
WITH CHECK (tenant_id = auth.jwt() ->> 'tenant_id');

CREATE POLICY "Users can update frameworks in their tenant"
ON custom_frameworks FOR UPDATE
USING (tenant_id = auth.jwt() ->> 'tenant_id')
WITH CHECK (tenant_id = auth.jwt() ->> 'tenant_id');

CREATE POLICY "Users can delete frameworks in their tenant"
ON custom_frameworks FOR DELETE
USING (tenant_id = auth.jwt() ->> 'tenant_id');

-- RLS: custom_controls (inherited via framework_id)
CREATE POLICY "Users can read controls in their frameworks"
ON custom_controls FOR SELECT
USING (framework_id IN (
  SELECT id FROM custom_frameworks WHERE tenant_id = auth.jwt() ->> 'tenant_id'
));

CREATE POLICY "Users can create controls in their frameworks"
ON custom_controls FOR INSERT
WITH CHECK (framework_id IN (
  SELECT id FROM custom_frameworks WHERE tenant_id = auth.jwt() ->> 'tenant_id'
));

CREATE POLICY "Users can update controls in their frameworks"
ON custom_controls FOR UPDATE
USING (framework_id IN (
  SELECT id FROM custom_frameworks WHERE tenant_id = auth.jwt() ->> 'tenant_id'
));

CREATE POLICY "Users can delete controls in their frameworks"
ON custom_controls FOR DELETE
USING (framework_id IN (
  SELECT id FROM custom_frameworks WHERE tenant_id = auth.jwt() ->> 'tenant_id'
));

-- RLS: custom_framework_mappings (inherited via framework_id)
CREATE POLICY "Users can read mappings in their frameworks"
ON custom_framework_mappings FOR SELECT
USING (framework_id IN (
  SELECT id FROM custom_frameworks WHERE tenant_id = auth.jwt() ->> 'tenant_id'
));

CREATE POLICY "Users can create mappings in their frameworks"
ON custom_framework_mappings FOR INSERT
WITH CHECK (framework_id IN (
  SELECT id FROM custom_frameworks WHERE tenant_id = auth.jwt() ->> 'tenant_id'
));

CREATE POLICY "Users can delete mappings in their frameworks"
ON custom_framework_mappings FOR DELETE
USING (framework_id IN (
  SELECT id FROM custom_frameworks WHERE tenant_id = auth.jwt() ->> 'tenant_id'
));

-- RLS: webhook_endpoints
CREATE POLICY "Users can read endpoints in their tenant"
ON webhook_endpoints FOR SELECT
USING (tenant_id = auth.jwt() ->> 'tenant_id');

CREATE POLICY "Users can create endpoints in their tenant"
ON webhook_endpoints FOR INSERT
WITH CHECK (tenant_id = auth.jwt() ->> 'tenant_id');

CREATE POLICY "Users can update endpoints in their tenant"
ON webhook_endpoints FOR UPDATE
USING (tenant_id = auth.jwt() ->> 'tenant_id')
WITH CHECK (tenant_id = auth.jwt() ->> 'tenant_id');

CREATE POLICY "Users can delete endpoints in their tenant"
ON webhook_endpoints FOR DELETE
USING (tenant_id = auth.jwt() ->> 'tenant_id');

-- RLS: webhook_deliveries (service role can write for logging)
CREATE POLICY "Users can read deliveries in their tenant"
ON webhook_deliveries FOR SELECT
USING (tenant_id = auth.jwt() ->> 'tenant_id');

CREATE POLICY "Service role can insert deliveries"
ON webhook_deliveries FOR INSERT
WITH CHECK (true);
