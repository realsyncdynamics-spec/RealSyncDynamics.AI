-- Governance API Keys with Fine-Grained Permissions
-- Extends API key management with governance-specific scopes and permissions

-- ─── 1. Governance API Keys Table ───

CREATE TABLE IF NOT EXISTS public.governance_api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL CHECK (length(name) BETWEEN 1 AND 128),

  -- Permissions array: granular scopes like 'governance:read', 'gaps:write', etc.
  permissions TEXT[] DEFAULT '{}',

  -- Lifecycle
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  expires_at TIMESTAMPTZ,
  last_used_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,

  UNIQUE(tenant_id, name)
);

CREATE INDEX IF NOT EXISTS idx_governance_api_keys_tenant_id
  ON public.governance_api_keys(tenant_id);

CREATE INDEX IF NOT EXISTS idx_governance_api_keys_revoked
  ON public.governance_api_keys(revoked_at);

ALTER TABLE public.governance_api_keys ENABLE ROW LEVEL SECURITY;

CREATE POLICY "governance_api_keys tenant_read"
  ON public.governance_api_keys FOR SELECT
  USING (public.is_tenant_member(tenant_id));

CREATE POLICY "governance_api_keys tenant_write"
  ON public.governance_api_keys FOR INSERT
  WITH CHECK (public.is_tenant_member(tenant_id));

CREATE POLICY "governance_api_keys tenant_update"
  ON public.governance_api_keys FOR UPDATE
  USING (public.is_tenant_member(tenant_id))
  WITH CHECK (public.is_tenant_member(tenant_id));

CREATE POLICY "governance_api_keys service_only_delete"
  ON public.governance_api_keys FOR DELETE
  USING (auth.role() = 'service_role');
