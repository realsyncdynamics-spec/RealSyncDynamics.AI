-- Local AI Runtime Profiles — Metadaten geräte-lokaler KI-Profile je Nutzer und Mandant.
--
-- Geschrieben ausschließlich über die Edge Function `local-ai-runtime`
-- (service_role nach Mitgliedschaftsprüfung). Mitglieder des Mandanten dürfen
-- lesen, welche lokalen Modelle geprüft wurden. Bewusst KEINE Runtime-URL:
-- die LAN-Topologie des Nutzers verlässt das Gerät nicht.
-- Rein additiv, nicht destruktiv.

BEGIN;

CREATE TABLE IF NOT EXISTS public.local_ai_runtime_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  profile_name TEXT NOT NULL CHECK (char_length(profile_name) BETWEEN 1 AND 80),
  role TEXT NOT NULL CHECK (role IN ('governance', 'coding', 'vision', 'persistent')),
  model TEXT NOT NULL CHECK (char_length(model) BETWEEN 1 AND 128),
  test_overall TEXT CHECK (test_overall IN ('success', 'warning', 'failed')),
  test_ran_at TIMESTAMPTZ,
  test_checks JSONB NOT NULL DEFAULT '[]'::jsonb,
  -- Aktiviert nur mit bestandenem Test — auch auf Datenbankebene erzwungen.
  enabled BOOLEAN NOT NULL DEFAULT false CHECK (NOT enabled OR test_overall = 'success'),
  registered_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_local_ai_runtime_profiles_tenant
  ON public.local_ai_runtime_profiles (tenant_id, registered_at DESC);

ALTER TABLE public.local_ai_runtime_profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "local_ai_runtime_profiles_tenant_read" ON public.local_ai_runtime_profiles;
CREATE POLICY "local_ai_runtime_profiles_tenant_read" ON public.local_ai_runtime_profiles
  FOR SELECT TO authenticated USING (public.is_tenant_member(tenant_id));

DROP POLICY IF EXISTS "local_ai_runtime_profiles_service" ON public.local_ai_runtime_profiles;
CREATE POLICY "local_ai_runtime_profiles_service" ON public.local_ai_runtime_profiles
  FOR ALL TO service_role USING (true) WITH CHECK (true);

GRANT SELECT ON public.local_ai_runtime_profiles TO authenticated;
GRANT ALL ON public.local_ai_runtime_profiles TO service_role;

COMMIT;
