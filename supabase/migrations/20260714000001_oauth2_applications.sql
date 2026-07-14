-- Migration: 20260714000001_oauth2_applications.sql
-- Description: OAuth2 application management and token tracking

-- OAuth2 Applications: Third-party application registrations
CREATE TABLE IF NOT EXISTS public.oauth2_applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  client_id VARCHAR NOT NULL UNIQUE,
  client_secret_hash VARCHAR NOT NULL,
  name VARCHAR NOT NULL,
  description TEXT,
  redirect_uris TEXT[] NOT NULL DEFAULT '{}',
  scopes TEXT[] NOT NULL DEFAULT '{}',
  is_active BOOLEAN DEFAULT true,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  last_used_at TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  CONSTRAINT oauth2_apps_tenant_fk FOREIGN KEY (tenant_id) REFERENCES public.tenants(id)
);

-- RLS for oauth2_applications
ALTER TABLE public.oauth2_applications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their tenant's OAuth2 apps"
  ON public.oauth2_applications
  FOR SELECT
  USING (
    tenant_id = (SELECT tenant_id FROM auth.users WHERE id = auth.uid() LIMIT 1)
  );

CREATE POLICY "Users can create OAuth2 apps"
  ON public.oauth2_applications
  FOR INSERT
  WITH CHECK (
    tenant_id = (SELECT tenant_id FROM auth.users WHERE id = auth.uid() LIMIT 1)
  );

CREATE POLICY "Users can update OAuth2 apps"
  ON public.oauth2_applications
  FOR UPDATE
  USING (
    tenant_id = (SELECT tenant_id FROM auth.users WHERE id = auth.uid() LIMIT 1)
  )
  WITH CHECK (
    tenant_id = (SELECT tenant_id FROM auth.users WHERE id = auth.uid() LIMIT 1)
  );

CREATE POLICY "Users can delete OAuth2 apps"
  ON public.oauth2_applications
  FOR DELETE
  USING (
    tenant_id = (SELECT tenant_id FROM auth.users WHERE id = auth.uid() LIMIT 1)
  );

CREATE INDEX idx_oauth2_apps_tenant_id ON public.oauth2_applications(tenant_id);
CREATE INDEX idx_oauth2_apps_client_id ON public.oauth2_applications(client_id);
CREATE INDEX idx_oauth2_apps_is_active ON public.oauth2_applications(is_active);

-- OAuth2 Tokens: Track issued tokens for rate limiting and revocation
CREATE TABLE IF NOT EXISTS public.oauth2_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  app_id UUID NOT NULL REFERENCES public.oauth2_applications(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  token_hash VARCHAR NOT NULL UNIQUE,
  token_type VARCHAR NOT NULL CHECK (token_type IN ('access', 'refresh')),
  scope VARCHAR NOT NULL,
  expires_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  revoked_at TIMESTAMP WITH TIME ZONE,
  last_used_at TIMESTAMP WITH TIME ZONE,
  CONSTRAINT oauth2_tokens_tenant_fk FOREIGN KEY (tenant_id) REFERENCES public.tenants(id)
);

-- RLS for oauth2_tokens
ALTER TABLE public.oauth2_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their tenant's tokens"
  ON public.oauth2_tokens
  FOR SELECT
  USING (
    tenant_id = (SELECT tenant_id FROM auth.users WHERE id = auth.uid() LIMIT 1)
  );

CREATE INDEX idx_oauth2_tokens_app_id ON public.oauth2_tokens(app_id);
CREATE INDEX idx_oauth2_tokens_token_hash ON public.oauth2_tokens(token_hash);
CREATE INDEX idx_oauth2_tokens_expires_at ON public.oauth2_tokens(expires_at);
CREATE INDEX idx_oauth2_tokens_tenant_id ON public.oauth2_tokens(tenant_id);

-- OAuth2 Rate Limits: Track per-client rate limit consumption
CREATE TABLE IF NOT EXISTS public.oauth2_rate_limits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  app_id UUID NOT NULL REFERENCES public.oauth2_applications(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  requests_today INTEGER DEFAULT 0,
  requests_minute INTEGER DEFAULT 0,
  window_start_minute TIMESTAMP WITH TIME ZONE,
  window_start_day TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  CONSTRAINT oauth2_rate_limits_app UNIQUE(app_id),
  CONSTRAINT oauth2_rate_limits_tenant_fk FOREIGN KEY (tenant_id) REFERENCES public.tenants(id)
);

-- RLS for oauth2_rate_limits
ALTER TABLE public.oauth2_rate_limits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their tenant's rate limits"
  ON public.oauth2_rate_limits
  FOR SELECT
  USING (
    tenant_id = (SELECT tenant_id FROM auth.users WHERE id = auth.uid() LIMIT 1)
  );

CREATE INDEX idx_oauth2_rate_limits_app_id ON public.oauth2_rate_limits(app_id);
CREATE INDEX idx_oauth2_rate_limits_tenant_id ON public.oauth2_rate_limits(tenant_id);

COMMENT ON TABLE public.oauth2_applications IS 'OAuth2 application registrations for third-party integrations. Includes client credentials and configured scopes.';
COMMENT ON TABLE public.oauth2_tokens IS 'Issued OAuth2 tokens with expiration and revocation tracking. Used for rate limiting and security audits.';
COMMENT ON TABLE public.oauth2_rate_limits IS 'Real-time rate limit state per OAuth2 application. Tracks requests in current minute and day windows.';
