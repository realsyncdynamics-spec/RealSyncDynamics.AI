-- API-Keys pro Tenant für programmatic /audit access.
-- Plan-basiertes Quota: bronze=100/Monat, silver=1000/Monat, gold=10000/Monat.

CREATE TABLE IF NOT EXISTS public.api_keys (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name        TEXT NOT NULL CHECK (length(name) BETWEEN 1 AND 64),
  key_hash    TEXT NOT NULL UNIQUE,
  key_prefix  TEXT NOT NULL,
  created_by  UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_used_at TIMESTAMPTZ,
  revoked_at  TIMESTAMPTZ,
  CHECK (length(key_prefix) = 12)
);

CREATE INDEX IF NOT EXISTS idx_api_keys_tenant ON public.api_keys(tenant_id) WHERE revoked_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_api_keys_hash ON public.api_keys(key_hash) WHERE revoked_at IS NULL;

ALTER TABLE public.api_keys ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "api_keys tenant_member_read" ON public.api_keys;
CREATE POLICY "api_keys tenant_member_read"
  ON public.api_keys FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.memberships m
    WHERE m.tenant_id = api_keys.tenant_id AND m.user_id = auth.uid()
  ));

DROP POLICY IF EXISTS "api_keys tenant_admin_insert" ON public.api_keys;
CREATE POLICY "api_keys tenant_admin_insert"
  ON public.api_keys FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.memberships m
    WHERE m.tenant_id = api_keys.tenant_id
      AND m.user_id = auth.uid()
      AND m.role IN ('owner', 'admin')
  ));

DROP POLICY IF EXISTS "api_keys tenant_admin_update" ON public.api_keys;
CREATE POLICY "api_keys tenant_admin_update"
  ON public.api_keys FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM public.memberships m
    WHERE m.tenant_id = api_keys.tenant_id
      AND m.user_id = auth.uid()
      AND m.role IN ('owner', 'admin')
  ));

CREATE OR REPLACE FUNCTION public.api_key_validate(p_key TEXT)
RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_hash TEXT;
  v_tenant_id UUID;
BEGIN
  v_hash := encode(extensions.digest(p_key, 'sha256'), 'hex');
  SELECT tenant_id INTO v_tenant_id
  FROM public.api_keys
  WHERE key_hash = v_hash AND revoked_at IS NULL
  LIMIT 1;
  IF v_tenant_id IS NOT NULL THEN
    UPDATE public.api_keys SET last_used_at = now() WHERE key_hash = v_hash;
  END IF;
  RETURN v_tenant_id;
END;
$$;

REVOKE ALL ON FUNCTION public.api_key_validate(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.api_key_validate(TEXT) TO anon, authenticated, service_role;
