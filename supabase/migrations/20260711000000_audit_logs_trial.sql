-- Migration: 20260711000000_audit_logs_trial.sql
-- Description: Minimal audit trail for trial activation and compliance

CREATE TABLE IF NOT EXISTS public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  resource_type VARCHAR NOT NULL, -- 'subscription', 'company_profile', etc.
  action VARCHAR NOT NULL, -- 'CREATE_TRIAL', 'UPDATE', 'DELETE'
  old_values JSONB,
  new_values JSONB,
  source VARCHAR DEFAULT 'unified-entry', -- origin: unified-entry, checkout, admin, etc.
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- RLS: only tenant members can read their own audit logs
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "audit_logs tenant-read"
  ON public.audit_logs FOR SELECT
  USING (public.is_tenant_member(tenant_id));

-- Service role can insert (from Edge Functions)
CREATE POLICY "audit_logs service-write"
  ON public.audit_logs FOR INSERT
  USING (auth.role() = 'service_role');

-- Indices for query performance
CREATE INDEX IF NOT EXISTS idx_audit_logs_tenant ON public.audit_logs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON public.audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user ON public.audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_resource ON public.audit_logs(resource_type, action);

COMMENT ON TABLE public.audit_logs IS
  'Audit trail for compliance (DSGVO Art. 5, 32). Tracks all critical mutations.';
COMMENT ON COLUMN public.audit_logs.source IS
  'Origin of the action: unified-entry, checkout, admin-panel, api, etc.';

COMMIT;
