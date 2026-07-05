-- Public API & Webhook Integration System
-- Enables third-party integrations, event-driven workflows, and external connections

-- ─── 1. API Keys Management ───

CREATE TABLE IF NOT EXISTS public.api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,

  -- Identity
  name TEXT NOT NULL CHECK (length(name) BETWEEN 1 AND 128),
  key_prefix TEXT NOT NULL UNIQUE, -- e.g., "rsd_live_abc123" for display
  key_hash TEXT NOT NULL UNIQUE, -- bcrypt hash of full key

  -- Permissions
  scopes TEXT[] NOT NULL DEFAULT '{}', -- e.g., ['governance:read', 'gaps:write', 'reports:read']
  allowed_ips TEXT[] DEFAULT '{}', -- empty = all IPs allowed

  -- Rate Limiting
  rate_limit_requests INT DEFAULT 100, -- requests per period
  rate_limit_period_seconds INT DEFAULT 3600, -- period in seconds (default 1 hour)

  -- Lifecycle
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  last_used_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,

  UNIQUE(tenant_id, name)
);

CREATE INDEX IF NOT EXISTS idx_api_keys_tenant_id ON public.api_keys(tenant_id);
CREATE INDEX IF NOT EXISTS idx_api_keys_revoked ON public.api_keys(revoked_at);
CREATE INDEX IF NOT EXISTS idx_api_keys_expires ON public.api_keys(expires_at);

-- ─── 2. API Usage Tracking ───

CREATE TABLE IF NOT EXISTS public.api_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  api_key_id UUID NOT NULL REFERENCES public.api_keys(id) ON DELETE CASCADE,

  -- Request Details
  method TEXT NOT NULL, -- GET, POST, PUT, DELETE
  endpoint TEXT NOT NULL, -- e.g., /api/v1/gaps
  status_code INT NOT NULL,
  response_time_ms INT, -- milliseconds

  -- Input/Output
  request_size_bytes INT,
  response_size_bytes INT,

  -- Metadata
  user_agent TEXT,
  ip_address INET,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,

  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_api_usage_tenant_id ON public.api_usage(tenant_id);
CREATE INDEX IF NOT EXISTS idx_api_usage_api_key_id ON public.api_usage(api_key_id);
CREATE INDEX IF NOT EXISTS idx_api_usage_created_at ON public.api_usage(created_at);

-- ─── 3. Webhook Subscriptions ───

CREATE TABLE IF NOT EXISTS public.webhook_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,

  -- Webhook Identity
  name TEXT NOT NULL CHECK (length(name) BETWEEN 1 AND 128),
  endpoint_url TEXT NOT NULL,

  -- Events to subscribe to
  events TEXT[] NOT NULL, -- e.g., ['gap.created', 'gap.updated', 'task.completed']
  active BOOLEAN DEFAULT true,

  -- Security
  secret TEXT NOT NULL, -- used for HMAC-SHA256 signing
  signing_algorithm TEXT DEFAULT 'hmac-sha256',

  -- Filters (optional)
  filter_criteria JSONB DEFAULT '{}', -- e.g., {"severity": "critical", "framework": "iso27001"}

  -- Rate Limiting for this webhook
  max_retries INT DEFAULT 3,
  retry_delay_seconds INT DEFAULT 300, -- 5 minutes

  -- Lifecycle
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  disabled_at TIMESTAMPTZ,

  UNIQUE(tenant_id, name)
);

CREATE INDEX IF NOT EXISTS idx_webhook_subscriptions_tenant_id ON public.webhook_subscriptions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_webhook_subscriptions_active ON public.webhook_subscriptions(active);

-- ─── 4. Webhook Deliveries (Event Log) ───

CREATE TABLE IF NOT EXISTS public.webhook_deliveries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id UUID NOT NULL REFERENCES public.webhook_subscriptions(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,

  -- Event Details
  event_type TEXT NOT NULL, -- e.g., 'gap.created'
  event_id TEXT NOT NULL, -- correlated event identifier
  payload JSONB NOT NULL,

  -- Delivery Tracking
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed', 'exhausted')),
  http_status_code INT,
  response_body TEXT,

  -- Retry Logic
  attempt INT DEFAULT 1,
  next_retry_at TIMESTAMPTZ,
  last_error TEXT,

  -- Metadata
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_subscription_id ON public.webhook_deliveries(subscription_id);
CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_tenant_id ON public.webhook_deliveries(tenant_id);
CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_status ON public.webhook_deliveries(status);
CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_created_at ON public.webhook_deliveries(created_at);

-- ─── 5. Pre-Built Integrations ───

CREATE TABLE IF NOT EXISTS public.integrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Integration Identity
  slug TEXT UNIQUE NOT NULL, -- e.g., 'slack', 'microsoft-teams', 'zapier'
  name TEXT NOT NULL,
  description TEXT,
  icon_url TEXT,

  -- Configuration
  auth_type TEXT NOT NULL CHECK (auth_type IN ('api_key', 'oauth2', 'webhook')),
  documentation_url TEXT,
  support_email TEXT,

  -- Status
  enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_integrations_slug ON public.integrations(slug);
CREATE INDEX IF NOT EXISTS idx_integrations_enabled ON public.integrations(enabled);

-- ─── 6. User Integration Configurations ───

CREATE TABLE IF NOT EXISTS public.integration_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  integration_id UUID NOT NULL REFERENCES public.integrations(id) ON DELETE CASCADE,

  -- Credentials (encrypted in transit, at rest via Supabase Vault)
  credentials JSONB NOT NULL, -- e.g., {"api_key": "...", "workspace_id": "..."}

  -- Metadata
  name TEXT,
  enabled BOOLEAN DEFAULT true,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),

  UNIQUE(tenant_id, integration_id)
);

CREATE INDEX IF NOT EXISTS idx_integration_configs_tenant_id ON public.integration_configs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_integration_configs_integration_id ON public.integration_configs(integration_id);

-- ─── 7. Row Level Security ───

ALTER TABLE public.api_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.api_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.webhook_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.webhook_deliveries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.integration_configs ENABLE ROW LEVEL SECURITY;

-- API Keys: tenant members can manage
CREATE POLICY "api_keys tenant_read"
  ON public.api_keys FOR SELECT
  USING (public.is_tenant_member(tenant_id));

CREATE POLICY "api_keys tenant_write"
  ON public.api_keys FOR INSERT
  WITH CHECK (public.is_tenant_member(tenant_id));

CREATE POLICY "api_keys tenant_update"
  ON public.api_keys FOR UPDATE
  USING (public.is_tenant_member(tenant_id))
  WITH CHECK (public.is_tenant_member(tenant_id));

CREATE POLICY "api_keys service_delete"
  ON public.api_keys FOR DELETE
  USING (auth.role() = 'service_role');

-- API Usage: tenant members read, service role writes
CREATE POLICY "api_usage tenant_read"
  ON public.api_usage FOR SELECT
  USING (public.is_tenant_member(tenant_id));

CREATE POLICY "api_usage service_insert"
  ON public.api_usage FOR INSERT
  WITH CHECK (auth.role() = 'service_role');

-- Webhook Subscriptions: tenant members manage
CREATE POLICY "webhook_subscriptions tenant_read"
  ON public.webhook_subscriptions FOR SELECT
  USING (public.is_tenant_member(tenant_id));

CREATE POLICY "webhook_subscriptions tenant_write"
  ON public.webhook_subscriptions FOR INSERT
  WITH CHECK (public.is_tenant_member(tenant_id));

CREATE POLICY "webhook_subscriptions tenant_update"
  ON public.webhook_subscriptions FOR UPDATE
  USING (public.is_tenant_member(tenant_id))
  WITH CHECK (public.is_tenant_member(tenant_id));

-- Webhook Deliveries: audit log (tenant members read, service role writes)
CREATE POLICY "webhook_deliveries tenant_read"
  ON public.webhook_deliveries FOR SELECT
  USING (public.is_tenant_member(tenant_id));

CREATE POLICY "webhook_deliveries service_insert"
  ON public.webhook_deliveries FOR INSERT
  WITH CHECK (auth.role() = 'service_role');

-- Integration Configs: tenant members manage
CREATE POLICY "integration_configs tenant_read"
  ON public.integration_configs FOR SELECT
  USING (public.is_tenant_member(tenant_id));

CREATE POLICY "integration_configs tenant_write"
  ON public.integration_configs FOR INSERT
  WITH CHECK (public.is_tenant_member(tenant_id));

CREATE POLICY "integration_configs tenant_update"
  ON public.integration_configs FOR UPDATE
  USING (public.is_tenant_member(tenant_id))
  WITH CHECK (public.is_tenant_member(tenant_id));

-- ─── 8. Helper RPC: Generate API Key ───

CREATE OR REPLACE FUNCTION public.create_api_key(
  p_tenant_id UUID,
  p_name TEXT,
  p_scopes TEXT[],
  p_expires_in_days INT DEFAULT NULL
)
RETURNS TABLE (
  key_id UUID,
  key_prefix TEXT,
  full_key TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_key_id UUID;
  v_prefix TEXT;
  v_full_key TEXT;
  v_hash TEXT;
  v_expires_at TIMESTAMPTZ;
BEGIN
  -- Generate key: rsd_live_<random>
  v_prefix := 'rsd_live_' || substr(encode(gen_random_bytes(16), 'hex'), 1, 24);
  v_full_key := v_prefix || '_' || encode(gen_random_bytes(32), 'hex');
  v_hash := crypt(v_full_key, gen_salt('bf'));

  -- Calculate expiration
  IF p_expires_in_days IS NOT NULL THEN
    v_expires_at := now() + (p_expires_in_days || ' days')::interval;
  END IF;

  -- Insert key
  INSERT INTO public.api_keys (tenant_id, name, key_prefix, key_hash, scopes, created_by, expires_at)
  VALUES (p_tenant_id, p_name, v_prefix, v_hash, p_scopes, auth.uid(), v_expires_at)
  RETURNING id INTO v_key_id;

  RETURN QUERY SELECT v_key_id, v_prefix, v_full_key;
END;
$$;

-- ─── 9. Helper RPC: Verify API Key ───

CREATE OR REPLACE FUNCTION public.verify_api_key(p_full_key TEXT)
RETURNS TABLE (
  valid BOOLEAN,
  tenant_id UUID,
  scopes TEXT[],
  rate_limit_requests INT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_key_prefix TEXT;
  v_key_hash TEXT;
BEGIN
  -- Extract prefix from key
  v_key_prefix := substr(p_full_key, 1, position('_' IN reverse(p_full_key)) - 1);

  -- Find key and verify
  SELECT
    ak.tenant_id,
    ak.scopes,
    ak.rate_limit_requests,
    ak.key_hash
  INTO v_key_prefix, v_key_prefix, v_key_prefix, v_key_hash
  FROM public.api_keys ak
  WHERE ak.key_prefix = v_key_prefix
    AND ak.revoked_at IS NULL
    AND (ak.expires_at IS NULL OR ak.expires_at > now());

  IF v_key_hash IS NOT NULL AND crypt(p_full_key, v_key_hash) = v_key_hash THEN
    RETURN QUERY SELECT true::BOOLEAN, NULL::UUID, NULL::TEXT[], NULL::INT;
  ELSE
    RETURN QUERY SELECT false::BOOLEAN, NULL::UUID, NULL::TEXT[], NULL::INT;
  END IF;
END;
$$;

-- ─── 10. Seed Pre-Built Integrations ───

INSERT INTO public.integrations (slug, name, description, auth_type, enabled)
VALUES
  ('slack', 'Slack', 'Send compliance alerts to Slack channels', 'oauth2', true),
  ('microsoft-teams', 'Microsoft Teams', 'Post notifications to Teams channels', 'oauth2', true),
  ('zapier', 'Zapier', 'Connect to 5000+ apps via Zapier', 'api_key', true),
  ('n8n', 'n8n', 'Internal workflow automation', 'webhook', true),
  ('pagerduty', 'PagerDuty', 'Trigger incidents for critical compliance issues', 'api_key', true)
ON CONFLICT DO NOTHING;
