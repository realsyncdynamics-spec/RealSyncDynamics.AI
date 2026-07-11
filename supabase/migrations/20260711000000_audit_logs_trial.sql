-- Migration: 20260711000000_audit_logs_trial.sql
-- Description: Tenant-scoped audit trail for subscription trial activation and onboarding (DSGVO Art. 5, 32).
--
-- WICHTIG: Diese Migration ist rein ADDITIV (CLAUDE.md: "Always additive — never break existing RLS
-- policies or public APIs"). Sie fasst die bestehende Tabelle public.audit_logs aus
-- 00001_initial_schema.sql NICHT an — jene ist ein eigenständiger, unveränderlicher Prüfpfad
-- (Revisionssicherheit) mit anderem Zweck und Schema (actor_id/entity_type/metadata).
-- Der neue, tenant-skopierte Prüfpfad für Subscription-/Onboarding-Ereignisse lebt in einer
-- separaten Tabelle public.trial_audit_logs, um Namens-/Schema-Kollisionen und Datenverlust
-- am bestehenden Compliance-Trail auszuschließen.

CREATE TABLE IF NOT EXISTS public.trial_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id UUID NOT NULL, -- bewusst ohne harten FK: Audit-Einträge müssen DSGVO-Löschungen (Art. 17) überleben
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
ALTER TABLE public.trial_audit_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "trial_audit_logs tenant-read" ON public.trial_audit_logs;
CREATE POLICY "trial_audit_logs tenant-read"
  ON public.trial_audit_logs FOR SELECT
  USING (public.is_tenant_member(tenant_id));

-- Service role can insert (from Edge Functions). INSERT-Policies benötigen WITH CHECK, nicht USING.
DROP POLICY IF EXISTS "trial_audit_logs service-write" ON public.trial_audit_logs;
CREATE POLICY "trial_audit_logs service-write"
  ON public.trial_audit_logs FOR INSERT
  WITH CHECK (auth.role() = 'service_role');

-- Indices for query performance
CREATE INDEX IF NOT EXISTS idx_trial_audit_logs_tenant ON public.trial_audit_logs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_trial_audit_logs_created ON public.trial_audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_trial_audit_logs_user ON public.trial_audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_trial_audit_logs_resource ON public.trial_audit_logs(resource_type, action);

COMMENT ON TABLE public.trial_audit_logs IS
  'Tenant-scoped audit trail for subscription lifecycle and onboarding (DSGVO Art. 5, 32). Separate from the immutable public.audit_logs trail.';
COMMENT ON COLUMN public.trial_audit_logs.source IS
  'Origin of the action: unified-entry, checkout, admin-panel, api, etc.';
COMMENT ON COLUMN public.trial_audit_logs.tenant_id IS
  'Multi-tenant isolation: all audit logs scoped to tenant for DSGVO compliance and RLS protection.';

COMMIT;
