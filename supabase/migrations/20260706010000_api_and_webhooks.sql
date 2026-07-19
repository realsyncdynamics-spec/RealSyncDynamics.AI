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
-- [hotfix] webhook_subscriptions existiert bereits seit 20260705200000
-- (event_key/url/enabled-Schema für webhook-deliver + webhook-retry-cron).
-- Das ursprüngliche CREATE TABLE IF NOT EXISTS war deshalb ein No-op und
-- die Folge-Statements liefen auf nicht existierende Spalten (CI-Fehler:
-- column "active" does not exist — Migration nie erfolgreich angewendet).
-- Dieses API-Feature (webhook-dispatcher, WebhookConfigView) nutzt dieselbe
-- Tabelle mit zusätzlichen Spalten — additiv ergänzen, Bestand unangetastet.
ALTER TABLE public.webhook_subscriptions ADD COLUMN IF NOT EXISTS name TEXT CHECK (name IS NULL OR length(name) BETWEEN 1 AND 128);
ALTER TABLE public.webhook_subscriptions ADD COLUMN IF NOT EXISTS endpoint_url TEXT;
ALTER TABLE public.webhook_subscriptions ADD COLUMN IF NOT EXISTS events TEXT[];
ALTER TABLE public.webhook_subscriptions ADD COLUMN IF NOT EXISTS active BOOLEAN DEFAULT true;
ALTER TABLE public.webhook_subscriptions ADD COLUMN IF NOT EXISTS signing_algorithm TEXT DEFAULT 'hmac-sha256';
ALTER TABLE public.webhook_subscriptions ADD COLUMN IF NOT EXISTS filter_criteria JSONB DEFAULT '{}';
ALTER TABLE public.webhook_subscriptions ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE public.webhook_subscriptions ADD COLUMN IF NOT EXISTS disabled_at TIMESTAMPTZ;

-- UNIQUE(tenant_id, name) aus dem ursprünglichen Entwurf: als partieller
-- Unique-Index, damit Bestandszeilen des Alt-Schemas (name IS NULL) nicht brechen.
CREATE UNIQUE INDEX IF NOT EXISTS webhook_subscriptions_tenant_name_key
  ON public.webhook_subscriptions(tenant_id, name) WHERE name IS NOT NULL;

-- Die Tabelle kann bereits aus 20260705200000_webhook_delivery_system.sql
-- existieren (dort mit event_key/url/enabled statt name/endpoint_url/active).
-- CREATE TABLE IF NOT EXISTS überspringt dann die Neuanlage — die von dieser
-- Migration (und webhook-dispatcher) erwarteten Spalten müssen additiv
-- ergänzt werden, sonst schlägt der Index auf (active) fehl.
ALTER TABLE public.webhook_subscriptions ADD COLUMN IF NOT EXISTS name TEXT;
ALTER TABLE public.webhook_subscriptions ADD COLUMN IF NOT EXISTS endpoint_url TEXT;
ALTER TABLE public.webhook_subscriptions ADD COLUMN IF NOT EXISTS events TEXT[];
ALTER TABLE public.webhook_subscriptions ADD COLUMN IF NOT EXISTS active BOOLEAN DEFAULT true;
ALTER TABLE public.webhook_subscriptions ADD COLUMN IF NOT EXISTS signing_algorithm TEXT DEFAULT 'hmac-sha256';
ALTER TABLE public.webhook_subscriptions ADD COLUMN IF NOT EXISTS filter_criteria JSONB DEFAULT '{}';
ALTER TABLE public.webhook_subscriptions ADD COLUMN IF NOT EXISTS max_retries INT DEFAULT 3;
ALTER TABLE public.webhook_subscriptions ADD COLUMN IF NOT EXISTS retry_delay_seconds INT DEFAULT 300;
ALTER TABLE public.webhook_subscriptions ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE public.webhook_subscriptions ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();
ALTER TABLE public.webhook_subscriptions ADD COLUMN IF NOT EXISTS disabled_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_webhook_subscriptions_tenant_id ON public.webhook_subscriptions(tenant_id);

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

-- Create indexes on integration_configs (only if columns exist)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'integration_configs' AND table_schema = 'public' AND column_name = 'tenant_id') THEN
    CREATE INDEX IF NOT EXISTS idx_integration_configs_tenant_id ON public.integration_configs(tenant_id);
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'integration_configs' AND table_schema = 'public' AND column_name = 'integration_id') THEN
    CREATE INDEX IF NOT EXISTS idx_integration_configs_integration_id ON public.integration_configs(integration_id);
  END IF;
END $$;

-- ─── 7. Row Level Security ───

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'api_keys' AND table_schema = 'public') THEN
    ALTER TABLE public.api_keys ENABLE ROW LEVEL SECURITY;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'api_usage' AND table_schema = 'public') THEN
    ALTER TABLE public.api_usage ENABLE ROW LEVEL SECURITY;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'webhook_subscriptions' AND table_schema = 'public') THEN
    ALTER TABLE public.webhook_subscriptions ENABLE ROW LEVEL SECURITY;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'webhook_deliveries' AND table_schema = 'public') THEN
    ALTER TABLE public.webhook_deliveries ENABLE ROW LEVEL SECURITY;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'integration_configs' AND table_schema = 'public') THEN
    ALTER TABLE public.integration_configs ENABLE ROW LEVEL SECURITY;
  END IF;
END $$;

-- API Keys: tenant members can manage
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'api_keys' AND table_schema = 'public') THEN
    DROP POLICY IF EXISTS "api_keys tenant_read" ON public.api_keys;
    CREATE POLICY "api_keys tenant_read"
      ON public.api_keys FOR SELECT
      USING (public.is_tenant_member(tenant_id));

    DROP POLICY IF EXISTS "api_keys tenant_write" ON public.api_keys;
    CREATE POLICY "api_keys tenant_write"
      ON public.api_keys FOR INSERT
      WITH CHECK (public.is_tenant_member(tenant_id));

    DROP POLICY IF EXISTS "api_keys tenant_update" ON public.api_keys;
    CREATE POLICY "api_keys tenant_update"
      ON public.api_keys FOR UPDATE
      USING (public.is_tenant_member(tenant_id))
      WITH CHECK (public.is_tenant_member(tenant_id));

    DROP POLICY IF EXISTS "api_keys service_delete" ON public.api_keys;
    CREATE POLICY "api_keys service_delete"
      ON public.api_keys FOR DELETE
      USING (auth.role() = 'service_role');
  END IF;
END $$;

-- API Usage: tenant members read, service role writes
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'api_usage' AND table_schema = 'public') THEN
    DROP POLICY IF EXISTS "api_usage tenant_read" ON public.api_usage;
    CREATE POLICY "api_usage tenant_read"
      ON public.api_usage FOR SELECT
      USING (public.is_tenant_member(tenant_id));

    DROP POLICY IF EXISTS "api_usage service_insert" ON public.api_usage;
    CREATE POLICY "api_usage service_insert"
      ON public.api_usage FOR INSERT
      WITH CHECK (auth.role() = 'service_role');
  END IF;
END $$;

-- Webhook Subscriptions: tenant members manage
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'webhook_subscriptions' AND table_schema = 'public') THEN
    DROP POLICY IF EXISTS "webhook_subscriptions tenant_read" ON public.webhook_subscriptions;
    CREATE POLICY "webhook_subscriptions tenant_read"
      ON public.webhook_subscriptions FOR SELECT
      USING (public.is_tenant_member(tenant_id));

    DROP POLICY IF EXISTS "webhook_subscriptions tenant_write" ON public.webhook_subscriptions;
    CREATE POLICY "webhook_subscriptions tenant_write"
      ON public.webhook_subscriptions FOR INSERT
      WITH CHECK (public.is_tenant_member(tenant_id));

    DROP POLICY IF EXISTS "webhook_subscriptions tenant_update" ON public.webhook_subscriptions;
    CREATE POLICY "webhook_subscriptions tenant_update"
      ON public.webhook_subscriptions FOR UPDATE
      USING (public.is_tenant_member(tenant_id))
      WITH CHECK (public.is_tenant_member(tenant_id));
  END IF;
END $$;

-- Webhook Deliveries: audit log (tenant members read, service role writes)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'webhook_deliveries' AND table_schema = 'public') THEN
    DROP POLICY IF EXISTS "webhook_deliveries tenant_read" ON public.webhook_deliveries;
    CREATE POLICY "webhook_deliveries tenant_read"
      ON public.webhook_deliveries FOR SELECT
      USING (public.is_tenant_member(tenant_id));

    DROP POLICY IF EXISTS "webhook_deliveries service_insert" ON public.webhook_deliveries;
    CREATE POLICY "webhook_deliveries service_insert"
      ON public.webhook_deliveries FOR INSERT
      WITH CHECK (auth.role() = 'service_role');
  END IF;
END $$;

-- Integration Configs: tenant members manage
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'integration_configs' AND table_schema = 'public') THEN
    DROP POLICY IF EXISTS "integration_configs tenant_read" ON public.integration_configs;
    CREATE POLICY "integration_configs tenant_read"
      ON public.integration_configs FOR SELECT
      USING (public.is_tenant_member(tenant_id));

    DROP POLICY IF EXISTS "integration_configs tenant_write" ON public.integration_configs;
    CREATE POLICY "integration_configs tenant_write"
      ON public.integration_configs FOR INSERT
      WITH CHECK (public.is_tenant_member(tenant_id));

    DROP POLICY IF EXISTS "integration_configs tenant_update" ON public.integration_configs;
    CREATE POLICY "integration_configs tenant_update"
      ON public.integration_configs FOR UPDATE
      USING (public.is_tenant_member(tenant_id))
      WITH CHECK (public.is_tenant_member(tenant_id));
  END IF;
END $$;

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
  v_tenant_id UUID;
  v_scopes TEXT[];
  v_rate_limit_requests INT;
BEGIN
  -- Extract prefix from key
  v_key_prefix := substr(p_full_key, 1, position('_' IN reverse(p_full_key)) - 1);

  -- Find key and verify
  SELECT
    ak.tenant_id,
    ak.scopes,
    ak.rate_limit_requests,
    ak.key_hash
  INTO v_tenant_id, v_scopes, v_rate_limit_requests, v_key_hash
  FROM public.api_keys ak
  WHERE ak.key_prefix = v_key_prefix
    AND ak.revoked_at IS NULL
    AND (ak.expires_at IS NULL OR ak.expires_at > now());

  IF v_key_hash IS NOT NULL AND crypt(p_full_key, v_key_hash) = v_key_hash THEN
    RETURN QUERY SELECT true::BOOLEAN, v_tenant_id, v_scopes, v_rate_limit_requests;
  ELSE
    RETURN QUERY SELECT false::BOOLEAN, NULL::UUID, NULL::TEXT[], NULL::INT;
  END IF;
END;
$$;

-- ─── 10. Seed Pre-Built Integrations ───

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'integrations' AND table_schema = 'public') THEN
    INSERT INTO public.integrations (slug, name, description, auth_type, enabled)
    VALUES
      ('slack', 'Slack', 'Send compliance alerts to Slack channels', 'oauth2', true),
      ('microsoft-teams', 'Microsoft Teams', 'Post notifications to Teams channels', 'oauth2', true),
      ('zapier', 'Zapier', 'Connect to 5000+ apps via Zapier', 'api_key', true),
      ('n8n', 'n8n', 'Internal workflow automation', 'webhook', true),
      ('pagerduty', 'PagerDuty', 'Trigger incidents for critical compliance issues', 'api_key', true)
    ON CONFLICT (slug) DO NOTHING;
  END IF;
END $$;
