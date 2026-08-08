-- Migration: 20260726000000_mcp_servers.sql
-- Description: MCP (Model Context Protocol) server registration and authentication management

-- MCP Servers: Registered MCP server instances
CREATE TABLE IF NOT EXISTS public.mcp_servers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name VARCHAR NOT NULL,
  description TEXT,
  server_url VARCHAR NOT NULL,
  auth_type VARCHAR NOT NULL CHECK (auth_type IN ('api_key', 'oauth', 'token', 'basic', 'none')),
  auth_header_name VARCHAR DEFAULT 'Authorization',
  is_active BOOLEAN DEFAULT true,
  is_verified BOOLEAN DEFAULT false,
  last_verified_at TIMESTAMP WITH TIME ZONE,
  connection_test_result JSONB,
  metadata JSONB DEFAULT '{}',
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  CONSTRAINT mcp_servers_tenant_name_unique UNIQUE(tenant_id, name),
  CONSTRAINT mcp_servers_tenant_fk FOREIGN KEY (tenant_id) REFERENCES public.tenants(id)
);

-- RLS for mcp_servers
ALTER TABLE public.mcp_servers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their tenant's MCP servers"
  ON public.mcp_servers
  FOR SELECT
  USING (
    public.is_tenant_member(tenant_id)
  );

CREATE POLICY "Users can create MCP servers in their tenant"
  ON public.mcp_servers
  FOR INSERT
  WITH CHECK (
    public.is_tenant_member(tenant_id)
  );

CREATE POLICY "Users can update MCP servers in their tenant"
  ON public.mcp_servers
  FOR UPDATE
  USING (
    public.is_tenant_member(tenant_id)
  )
  WITH CHECK (
    public.is_tenant_member(tenant_id)
  );

CREATE POLICY "Users can delete MCP servers in their tenant"
  ON public.mcp_servers
  FOR DELETE
  USING (
    public.is_tenant_member(tenant_id)
  );

CREATE INDEX idx_mcp_servers_tenant_id ON public.mcp_servers(tenant_id);
CREATE INDEX idx_mcp_servers_tenant_is_active ON public.mcp_servers(tenant_id, is_active);
CREATE INDEX idx_mcp_servers_created_at ON public.mcp_servers(created_at);

-- MCP Server Credentials: Encrypted credentials for MCP servers
CREATE TABLE IF NOT EXISTS public.mcp_server_credentials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  server_id UUID NOT NULL REFERENCES public.mcp_servers(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  credential_key VARCHAR NOT NULL,
  -- Referenz auf das Secret in Supabase Vault, NICHT der Wert selbst.
  -- Die Spalte hiess frueher credential_value_encrypted und enthielt den
  -- Klartext — der Name behauptete eine Verschluesselung, die es nicht gab,
  -- und die SELECT-Policy unten gibt die Zeile jedem Tenant-Mitglied frei.
  -- Ein Vault-Name ist gefahrlos lesbar; der Wert liegt ausschliesslich in
  -- vault.secrets und wird nur serverseitig ueber get_app_secret() aufgeloest.
  vault_secret_name TEXT NOT NULL,
  credential_type VARCHAR NOT NULL CHECK (credential_type IN ('api_key', 'token', 'password', 'oauth_token', 'custom')),
  expires_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  CONSTRAINT mcp_creds_server_key_unique UNIQUE(server_id, credential_key),
  CONSTRAINT mcp_creds_tenant_fk FOREIGN KEY (tenant_id) REFERENCES public.tenants(id)
);

-- RLS for mcp_server_credentials (strictly read-only for users, managed via edge function)
ALTER TABLE public.mcp_server_credentials ENABLE ROW LEVEL SECURITY;

-- Tenant-Mitglieder sehen die Zeile vollstaendig. Das ist zulaessig, weil die
-- Zeile keinen Geheimniswert mehr traegt, sondern nur den Vault-Namen.
CREATE POLICY "Users can view credential metadata"
  ON public.mcp_server_credentials
  FOR SELECT
  USING (
    public.is_tenant_member(tenant_id)
  );

CREATE POLICY "Edge function can manage credentials"
  ON public.mcp_server_credentials
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

CREATE INDEX idx_mcp_creds_server_id ON public.mcp_server_credentials(server_id);
CREATE INDEX idx_mcp_creds_tenant_id ON public.mcp_server_credentials(tenant_id);
CREATE INDEX idx_mcp_creds_expires_at ON public.mcp_server_credentials(expires_at);

-- MCP Server Usage: Track API calls to MCP servers for compliance and metering
CREATE TABLE IF NOT EXISTS public.mcp_server_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  server_id UUID NOT NULL REFERENCES public.mcp_servers(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  endpoint VARCHAR,
  method VARCHAR NOT NULL,
  status_code INTEGER,
  response_time_ms INTEGER,
  error_message TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  CONSTRAINT mcp_usage_server_fk FOREIGN KEY (server_id) REFERENCES public.mcp_servers(id),
  CONSTRAINT mcp_usage_tenant_fk FOREIGN KEY (tenant_id) REFERENCES public.tenants(id)
);

-- RLS for mcp_server_usage
ALTER TABLE public.mcp_server_usage ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view usage for their tenant's servers"
  ON public.mcp_server_usage
  FOR SELECT
  USING (
    public.is_tenant_member(tenant_id)
  );

CREATE POLICY "Edge function can insert usage records"
  ON public.mcp_server_usage
  FOR INSERT
  WITH CHECK (auth.role() = 'service_role');

CREATE INDEX idx_mcp_usage_server_id ON public.mcp_server_usage(server_id);
CREATE INDEX idx_mcp_usage_tenant_id ON public.mcp_server_usage(tenant_id);
CREATE INDEX idx_mcp_usage_user_id ON public.mcp_server_usage(user_id);
CREATE INDEX idx_mcp_usage_created_at ON public.mcp_server_usage(created_at);

COMMENT ON TABLE public.mcp_servers IS 'MCP (Model Context Protocol) server registrations. Stores connection details and authentication configuration for external MCP servers.';
COMMENT ON TABLE public.mcp_server_credentials IS 'Encrypted credentials for MCP servers. Managed via edge function, never exposed to client.';
COMMENT ON TABLE public.mcp_server_usage IS 'Usage metrics for MCP server calls. Tracked for compliance auditing, rate limiting, and cost tracking.';
