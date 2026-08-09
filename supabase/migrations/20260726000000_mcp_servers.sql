-- Migration: mcp_servers
-- Created at: 2026-07-26
-- Description: MCP Server Management Tables with Tenant Isolation

-- MCP Servers Table
CREATE TABLE IF NOT EXISTS public.mcp_servers (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  endpoint TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (id)
);

-- MCP Server Credentials Table
CREATE TABLE IF NOT EXISTS public.mcp_server_credentials (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  server_id UUID NOT NULL REFERENCES public.mcp_servers(id) ON DELETE CASCADE,
  credential_name TEXT NOT NULL,
  credential_vault_key TEXT, -- Referenz auf Supabase Vault (nicht Klartext!)
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (id)
);

-- MCP Server Usage Table
CREATE TABLE IF NOT EXISTS public.mcp_server_usage (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  server_id UUID NOT NULL REFERENCES public.mcp_servers(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL,
  invocation_count BIGINT NOT NULL DEFAULT 0,
  last_invoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (id)
);

-- Updated_at Trigger Function
CREATE OR REPLACE FUNCTION public.handle_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Updated_at Triggers
DROP TRIGGER IF EXISTS update_mcp_servers_updated_at ON public.mcp_servers;
CREATE TRIGGER update_mcp_servers_updated_at
  BEFORE UPDATE ON public.mcp_servers
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at_column();

DROP TRIGGER IF EXISTS update_mcp_server_credentials_updated_at ON public.mcp_server_credentials;
CREATE TRIGGER update_mcp_server_credentials_updated_at
  BEFORE UPDATE ON public.mcp_server_credentials
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at_column();

DROP TRIGGER IF EXISTS update_mcp_server_usage_updated_at ON public.mcp_server_usage;
CREATE TRIGGER update_mcp_server_usage_updated_at
  BEFORE UPDATE ON public.mcp_server_usage
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at_column();

-- RLS Policies (KORREKT: is_tenant_member() statt auth.users.tenant_id)
CREATE POLICY "mcp_servers_tenant_isolation"
ON public.mcp_servers
FOR ALL
USING (public.is_tenant_member(tenant_id));

CREATE POLICY "mcp_server_credentials_tenant_isolation"
ON public.mcp_server_credentials
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.mcp_servers
    WHERE public.mcp_servers.id = server_id
    AND public.is_tenant_member(public.mcp_servers.tenant_id)
  )
);

CREATE POLICY "mcp_server_usage_tenant_isolation"
ON public.mcp_server_usage
FOR ALL
USING (public.is_tenant_member(tenant_id));

-- Indexes for Performance
CREATE INDEX IF NOT EXISTS idx_mcp_servers_tenant_id ON public.mcp_servers(tenant_id);
CREATE INDEX IF NOT EXISTS idx_mcp_server_credentials_server_id ON public.mcp_server_credentials(server_id);
CREATE INDEX IF NOT EXISTS idx_mcp_server_usage_server_id ON public.mcp_server_usage(server_id);
CREATE INDEX IF NOT EXISTS idx_mcp_server_usage_tenant_id ON public.mcp_server_usage(tenant_id);
