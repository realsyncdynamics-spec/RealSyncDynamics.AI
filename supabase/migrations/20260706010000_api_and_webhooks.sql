-- Phase 6.2: API & Webhooks Extensions
-- Extends existing API infrastructure with webhooks, integrations, and rate limiting

-- ─── 1. Extend API Keys with Rate Limiting & Scopes ───
ALTER TABLE public.api_keys ADD COLUMN IF NOT EXISTS scopes TEXT[] DEFAULT '{}';
ALTER TABLE public.api_keys ADD COLUMN IF NOT EXISTS allowed_ips TEXT[] DEFAULT '{}';
ALTER TABLE public.api_keys ADD COLUMN IF NOT EXISTS rate_limit_requests INT DEFAULT 100;
ALTER TABLE public.api_keys ADD COLUMN IF NOT EXISTS rate_limit_period_seconds INT DEFAULT 3600;
ALTER TABLE public.api_keys ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_api_keys_expires ON public.api_keys(expires_at) WHERE expires_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_api_keys_revoked_list ON public.api_keys(tenant_id, revoked_at);

-- ─── 2. API Usage Tracking ───
CREATE TABLE IF NOT EXISTS public.api_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  api_key_id UUID NOT NULL REFERENCES public.api_keys(id) ON DELETE CASCADE,
  method TEXT NOT NULL,
  endpoint TEXT NOT NULL,
  status_code INT NOT NULL,
  response_time_ms INT,
  request_size_bytes INT,
  response_size_bytes INT,
  user_agent TEXT,
  ip_address INET,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_api_usage_tenant_id ON public.api_usage(tenant_id);
CREATE INDEX IF NOT EXISTS idx_api_usage_api_key_id ON public.api_usage(api_key_id);
CREATE INDEX IF NOT EXISTS idx_api_usage_created_at ON public.api_usage(created_at);

ALTER TABLE public.api_usage ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "api_usage tenant_read" ON public.api_usage;
CREATE POLICY "api_usage tenant_read" ON public.api_usage FOR SELECT
  USING (public.is_tenant_member(tenant_id));

DROP POLICY IF EXISTS "api_usage service_insert" ON public.api_usage;
CREATE POLICY "api_usage service_insert" ON public.api_usage FOR INSERT
  WITH CHECK (auth.role() = 'service_role');

-- ─── 3. Webhook Subscriptions ───
CREATE TABLE IF NOT EXISTS public.webhook_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL CHECK (length(name) BETWEEN 1 AND 128),
  endpoint_url TEXT NOT NULL,
  events TEXT[] NOT NULL,
  active BOOLEAN DEFAULT true,
  secret TEXT NOT NULL,
  signing_algorithm TEXT DEFAULT 'hmac-sha256',
  filter_criteria JSONB DEFAULT '{}',
  max_retries INT DEFAULT 3,
  retry_delay_seconds INT DEFAULT 300,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  disabled_at TIMESTAMPTZ,
  UNIQUE(tenant_id, name)
);

CREATE INDEX IF NOT EXISTS idx_webhook_subscriptions_tenant_id ON public.webhook_subscriptions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_webhook_subscriptions_active ON public.webhook_subscriptions(active);

ALTER TABLE public.webhook_subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "webhook_subscriptions tenant_read" ON public.webhook_subscriptions;
CREATE POLICY "webhook_subscriptions tenant_read" ON public.webhook_subscriptions FOR SELECT
  USING (public.is_tenant_member(tenant_id));

DROP POLICY IF EXISTS "webhook_subscriptions tenant_write" ON public.webhook_subscriptions;
CREATE POLICY "webhook_subscriptions tenant_write" ON public.webhook_subscriptions FOR INSERT
  WITH CHECK (public.is_tenant_member(tenant_id));

DROP POLICY IF EXISTS "webhook_subscriptions tenant_update" ON public.webhook_subscriptions;
CREATE POLICY "webhook_subscriptions tenant_update" ON public.webhook_subscriptions FOR UPDATE
  USING (public.is_tenant_member(tenant_id))
  WITH CHECK (public.is_tenant_member(tenant_id));

-- ─── 4. API Webhook Deliveries ───
-- Note: Using api_webhook_deliveries to avoid conflict with webhook_deliveries from webhook notifications system
CREATE TABLE IF NOT EXISTS public.api_webhook_deliveries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id UUID NOT NULL REFERENCES public.webhook_subscriptions(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  event_id TEXT NOT NULL,
  payload JSONB NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed', 'exhausted')),
  http_status_code INT,
  response_body TEXT,
  attempt INT DEFAULT 1,
  next_retry_at TIMESTAMPTZ,
  last_error TEXT,
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_api_webhook_deliveries_subscription_id ON public.api_webhook_deliveries(subscription_id);
CREATE INDEX IF NOT EXISTS idx_api_webhook_deliveries_tenant_id ON public.api_webhook_deliveries(tenant_id);
CREATE INDEX IF NOT EXISTS idx_api_webhook_deliveries_status ON public.api_webhook_deliveries(status);
CREATE INDEX IF NOT EXISTS idx_api_webhook_deliveries_created_at ON public.api_webhook_deliveries(created_at);

ALTER TABLE public.api_webhook_deliveries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "api_webhook_deliveries tenant_read" ON public.api_webhook_deliveries;
CREATE POLICY "api_webhook_deliveries tenant_read" ON public.api_webhook_deliveries FOR SELECT
  USING (public.is_tenant_member(tenant_id));

DROP POLICY IF EXISTS "api_webhook_deliveries service_insert" ON public.api_webhook_deliveries;
CREATE POLICY "api_webhook_deliveries service_insert" ON public.api_webhook_deliveries FOR INSERT
  WITH CHECK (auth.role() = 'service_role');

-- ─── 5. Pre-Built Integrations ───
CREATE TABLE IF NOT EXISTS public.integrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  icon_url TEXT,
  auth_type TEXT NOT NULL CHECK (auth_type IN ('api_key', 'oauth2', 'webhook')),
  documentation_url TEXT,
  support_email TEXT,
  enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_integrations_slug ON public.integrations(slug);
CREATE INDEX IF NOT EXISTS idx_integrations_enabled ON public.integrations(enabled);

-- ─── 6. Integration Configurations ───
CREATE TABLE IF NOT EXISTS public.integration_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  integration_id UUID NOT NULL REFERENCES public.integrations(id) ON DELETE CASCADE,
  credentials JSONB NOT NULL,
  name TEXT,
  enabled BOOLEAN DEFAULT true,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(tenant_id, integration_id)
);

CREATE INDEX IF NOT EXISTS idx_integration_configs_tenant_id ON public.integration_configs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_integration_configs_integration_id ON public.integration_configs(integration_id);

ALTER TABLE public.integration_configs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "integration_configs tenant_read" ON public.integration_configs;
CREATE POLICY "integration_configs tenant_read" ON public.integration_configs FOR SELECT
  USING (public.is_tenant_member(tenant_id));

DROP POLICY IF EXISTS "integration_configs tenant_write" ON public.integration_configs;
CREATE POLICY "integration_configs tenant_write" ON public.integration_configs FOR INSERT
  WITH CHECK (public.is_tenant_member(tenant_id));

DROP POLICY IF EXISTS "integration_configs tenant_update" ON public.integration_configs;
CREATE POLICY "integration_configs tenant_update" ON public.integration_configs FOR UPDATE
  USING (public.is_tenant_member(tenant_id))
  WITH CHECK (public.is_tenant_member(tenant_id));

-- ─── 7. Seed Pre-Built Integrations ───
INSERT INTO public.integrations (slug, name, description, auth_type, enabled)
VALUES
  ('slack', 'Slack', 'Send compliance alerts to Slack channels', 'oauth2', true),
  ('microsoft-teams', 'Microsoft Teams', 'Post notifications to Teams channels', 'oauth2', true),
  ('zapier', 'Zapier', 'Connect to 5000+ apps via Zapier', 'api_key', true),
  ('n8n', 'n8n', 'Internal workflow automation', 'webhook', true),
  ('pagerduty', 'PagerDuty', 'Trigger incidents for critical compliance issues', 'api_key', true)
ON CONFLICT (slug) DO NOTHING;
