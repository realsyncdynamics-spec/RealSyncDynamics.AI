-- Media Studio: Aufträge, Kontingent-Reservierung, privater Medien-Bucket.
--
-- Zusammenführung von PR #2271 (Creative Studio: atomare Reservierung vor jedem
-- bezahlten Anbieteraufruf, Job-Lebenszyklus, private Ablage mit signierten
-- URLs) und PR #2288 (Media Studio: Google Gemini API / Higgsfield API).
--
-- ADDITIV. Neue Tabellen, neue Funktionen, ein neuer privater Bucket. Keine
-- bestehende Tabelle, Policy, Funktion, Preis-, Stripe- oder Entitlement-Zeile
-- wird verändert.
--
-- Regeln
--   * Kontingent in „Einheiten“: Bild = 1, Video = 1 je Sekunde. Schutzwert,
--     kein Preis, kein Kundenversprechen.
--   * Ohne Zeile in media_studio_limits ist das Kontingent 0 (fail-closed,
--     wie Owner-Entscheidung Option A vom 28.10.2026 für Bot-Kanäle).
--   * Reservierung atomar je Mandant (pg_advisory_xact_lock) und idempotent
--     je (Mandant, idempotency_key).
--   * Angerechnet werden reserved, submitted, completed sowie failed mit
--     unklarem Anbieterergebnis (PROVIDER_TIMEOUT, STORAGE_FAILED). Nur
--     nachweislich nicht ausgelöste Aufträge geben Einheiten frei.
--   * Schreiben ausschließlich über die Edge Function (service_role). Mitglieder
--     lesen nur eigene Mandantenzeilen. Medien nur per signierter URL.

BEGIN;

-- ============================================================
-- 1. Kontingent je Mandant
-- ============================================================
CREATE TABLE IF NOT EXISTS public.media_studio_limits (
  tenant_id      uuid PRIMARY KEY REFERENCES public.tenants(id) ON DELETE CASCADE,
  units_monthly  integer     NOT NULL DEFAULT 0 CHECK (units_monthly >= 0),
  updated_at     timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.media_studio_limits ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "media_studio_limits tenant-read" ON public.media_studio_limits;
CREATE POLICY "media_studio_limits tenant-read" ON public.media_studio_limits
  FOR SELECT USING (public.is_tenant_member(tenant_id));

COMMENT ON TABLE public.media_studio_limits IS
  'Media Studio: monatliches Schutzkontingent in Einheiten (Bild = 1, Video = 1 je Sekunde). Fehlende Zeile = 0 = keine Generierung. Kein Preis, kein Entitlement. Änderung nur per service_role.';

-- ============================================================
-- 2. Aufträge
-- ============================================================
CREATE TABLE IF NOT EXISTS public.media_jobs (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id            uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id              uuid NOT NULL,
  kind                 text NOT NULL CHECK (kind IN ('image', 'video')),
  provider             text NOT NULL CHECK (provider IN ('google', 'higgsfield')),
  model                text NOT NULL CHECK (length(model) BETWEEN 1 AND 200),
  units                integer NOT NULL CHECK (units > 0),
  status               text NOT NULL DEFAULT 'reserved'
                         CHECK (status IN ('reserved', 'submitted', 'completed', 'failed', 'released')),
  idempotency_key      text NOT NULL CHECK (length(idempotency_key) BETWEEN 8 AND 120),
  provider_request_id  text CHECK (provider_request_id IS NULL OR length(provider_request_id) <= 200),
  -- Nur Parameter und Prompt-Hash, nie Prompt-Klartext oder Schlüssel.
  request_params       jsonb NOT NULL DEFAULT '{}'::jsonb,
  asset_paths          text[] NOT NULL DEFAULT '{}',
  error_code           text CHECK (error_code IS NULL OR length(error_code) <= 60),
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now(),
  completed_at         timestamptz,
  CONSTRAINT media_jobs_idempotency_unique UNIQUE (tenant_id, idempotency_key)
);

CREATE INDEX IF NOT EXISTS media_jobs_tenant_period_idx
  ON public.media_jobs (tenant_id, created_at);
CREATE INDEX IF NOT EXISTS media_jobs_open_idx
  ON public.media_jobs (status, created_at)
  WHERE status IN ('reserved', 'submitted');

ALTER TABLE public.media_jobs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "media_jobs tenant-read" ON public.media_jobs;
CREATE POLICY "media_jobs tenant-read" ON public.media_jobs
  FOR SELECT USING (public.is_tenant_member(tenant_id));

COMMENT ON TABLE public.media_jobs IS
  'Media Studio: ein Anbieterauftrag je Zeile. Lebenszyklus reserved → submitted → completed | failed | released. Schreiben nur über media_job_reserve/media_job_transition (service_role).';

-- ============================================================
-- 3. Verbrauch im laufenden Monat (UTC)
-- ============================================================
CREATE OR REPLACE FUNCTION public.media_units_used(p_tenant_id uuid)
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(SUM(units), 0)::integer
  FROM public.media_jobs
  WHERE tenant_id = p_tenant_id
    AND created_at >= date_trunc('month', now() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC'
    AND (
      status IN ('reserved', 'submitted', 'completed')
      OR (status = 'failed' AND error_code IN ('PROVIDER_TIMEOUT', 'STORAGE_FAILED'))
    );
$$;

-- ============================================================
-- 4. Reservierung (atomar, idempotent)
-- ============================================================
CREATE OR REPLACE FUNCTION public.media_job_reserve(
  p_tenant_id        uuid,
  p_user_id          uuid,
  p_kind             text,
  p_provider         text,
  p_model            text,
  p_units            integer,
  p_idempotency_key  text,
  p_params           jsonb DEFAULT '{}'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_existing public.media_jobs%ROWTYPE;
  v_limit    integer;
  v_used     integer;
  v_id       uuid;
BEGIN
  IF p_tenant_id IS NULL OR p_user_id IS NULL OR p_units IS NULL OR p_units <= 0 THEN
    RETURN jsonb_build_object('ok', false, 'code', 'BAD_REQUEST');
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended('media_studio:' || p_tenant_id::text, 0));

  SELECT * INTO v_existing
  FROM public.media_jobs
  WHERE tenant_id = p_tenant_id AND idempotency_key = p_idempotency_key;
  IF FOUND THEN
    RETURN jsonb_build_object('ok', true, 'replay', true, 'job_id', v_existing.id, 'status', v_existing.status);
  END IF;

  SELECT units_monthly INTO v_limit FROM public.media_studio_limits WHERE tenant_id = p_tenant_id;
  v_limit := COALESCE(v_limit, 0);
  v_used := public.media_units_used(p_tenant_id);

  IF v_used + p_units > v_limit THEN
    RETURN jsonb_build_object('ok', false, 'code', 'BUDGET_EXCEEDED', 'used', v_used, 'limit', v_limit);
  END IF;

  INSERT INTO public.media_jobs (tenant_id, user_id, kind, provider, model, units, idempotency_key, request_params)
  VALUES (p_tenant_id, p_user_id, p_kind, p_provider, p_model, p_units, p_idempotency_key, COALESCE(p_params, '{}'::jsonb))
  RETURNING id INTO v_id;

  RETURN jsonb_build_object('ok', true, 'replay', false, 'job_id', v_id, 'status', 'reserved',
                            'used', v_used + p_units, 'limit', v_limit);
END;
$$;

-- ============================================================
-- 5. Statusübergang (nur erlaubte Kanten)
-- ============================================================
CREATE OR REPLACE FUNCTION public.media_job_transition(
  p_job_id               uuid,
  p_tenant_id            uuid,
  p_status               text,
  p_provider_request_id  text DEFAULT NULL,
  p_asset_paths          text[] DEFAULT NULL,
  p_error_code           text DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rows integer;
BEGIN
  UPDATE public.media_jobs
  SET status              = p_status,
      provider_request_id = COALESCE(p_provider_request_id, provider_request_id),
      asset_paths         = COALESCE(p_asset_paths, asset_paths),
      error_code          = COALESCE(p_error_code, error_code),
      updated_at          = now(),
      completed_at        = CASE WHEN p_status IN ('completed', 'failed', 'released') THEN now() ELSE completed_at END
  WHERE id = p_job_id
    AND tenant_id = p_tenant_id
    AND (
         (status = 'reserved'  AND p_status IN ('submitted', 'completed', 'failed', 'released'))
      OR (status = 'submitted' AND p_status IN ('completed', 'failed'))
    );
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  RETURN v_rows = 1;
END;
$$;

-- Nur die Edge Function (service_role) ruft die Funktionen auf.
REVOKE ALL ON FUNCTION public.media_units_used(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.media_job_reserve(uuid, uuid, text, text, text, integer, text, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.media_job_transition(uuid, uuid, text, text, text[], text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.media_units_used(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.media_job_reserve(uuid, uuid, text, text, text, integer, text, jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.media_job_transition(uuid, uuid, text, text, text[], text) TO service_role;

-- ============================================================
-- 6. Privater Bucket
-- ============================================================
-- Pfad: <tenant_id>/<job_id>/<index>.<ext>. Keine storage.objects-Policies für
-- anon/authenticated: Schreiben nur service_role, Lesen nur per signierter URL
-- nach serverseitiger Mandantenprüfung (Muster wie Bucket `documents`).
-- `bilder` und `creatorseal-content` werden bewusst NICHT verwendet
-- (Audit docs/audit/creative-studio-live-storage-audit-20261116.md in PR #2271).
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('media-studio', 'media-studio', false, 52428800,
        ARRAY['image/png', 'image/jpeg', 'image/webp', 'video/mp4'])
ON CONFLICT (id) DO NOTHING;

COMMIT;
