-- Governance Activation — Organization + Scope persistence (first vertical).
--
-- Product module (NOT classic onboarding). Spec:
--   docs/product/governance-activation.md
--
-- One row per tenant. Organization fields live in jsonb (product content
-- changes faster than a column list). Scopes are a text[] of known ids
-- (dsgvo, eu-ai-act, …). Expert Review / extraction / blueprint remain
-- Preview until backend exists — this table only stores what the UI can
-- honestly persist today.
--
-- RLS mirrors company_profiles / bots: tenant members read; owner/admin write;
-- service_role full access.

CREATE TABLE IF NOT EXISTS public.governance_activations (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  organization    JSONB NOT NULL DEFAULT '{}'::jsonb,
  scopes          TEXT[] NOT NULL DEFAULT '{}',
  status          TEXT NOT NULL DEFAULT 'draft'
                  CHECK (status IN ('draft', 'scope_set', 'org_saved', 'activated')),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT governance_activations_tenant_key UNIQUE (tenant_id)
);

COMMENT ON TABLE public.governance_activations IS
  'Governance Activation draft per tenant: Organization + Governance Scope. '
  'Written from /app/activation; Blueprint/Extraction stay Preview.';

CREATE INDEX IF NOT EXISTS idx_governance_activations_tenant
  ON public.governance_activations (tenant_id);

CREATE OR REPLACE FUNCTION public.governance_activations_set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS governance_activations_update_modtime
  ON public.governance_activations;
CREATE TRIGGER governance_activations_update_modtime
  BEFORE INSERT OR UPDATE ON public.governance_activations
  FOR EACH ROW EXECUTE FUNCTION public.governance_activations_set_updated_at();

ALTER TABLE public.governance_activations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "governance_activations_tenant_read"
  ON public.governance_activations;
CREATE POLICY "governance_activations_tenant_read"
  ON public.governance_activations FOR SELECT TO authenticated
  USING (public.is_tenant_member(tenant_id));

DROP POLICY IF EXISTS "governance_activations_tenant_insert"
  ON public.governance_activations;
CREATE POLICY "governance_activations_tenant_insert"
  ON public.governance_activations FOR INSERT TO authenticated
  WITH CHECK (
    tenant_id IN (
      SELECT tenant_id FROM public.memberships
      WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
    )
  );

DROP POLICY IF EXISTS "governance_activations_tenant_update"
  ON public.governance_activations;
CREATE POLICY "governance_activations_tenant_update"
  ON public.governance_activations FOR UPDATE TO authenticated
  USING (
    tenant_id IN (
      SELECT tenant_id FROM public.memberships
      WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
    )
  )
  WITH CHECK (
    tenant_id IN (
      SELECT tenant_id FROM public.memberships
      WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
    )
  );

DROP POLICY IF EXISTS "governance_activations_service_write"
  ON public.governance_activations;
CREATE POLICY "governance_activations_service_write"
  ON public.governance_activations FOR ALL TO service_role
  USING (true) WITH CHECK (true);

GRANT SELECT, INSERT, UPDATE ON public.governance_activations TO authenticated;
GRANT ALL ON public.governance_activations TO service_role;
