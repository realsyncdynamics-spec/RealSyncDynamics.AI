-- RFC-002 §13 — Subject Reference Lifecycle (Phase 2)
--
-- Implements §13.1 (HMAC identity), §13.2 (key rotation), §13.3 (deletion
-- semantics). DSR export view + RPC are §13.4 / §13.5.
--
-- Depends on:
--   • SPEC-001 (20260602000000_runtime_events_backbone.sql) — runtime_events,
--     tenant_memberships, has_tenant_membership, pgcrypto extension
--   • public.tenants, auth.users
--
-- Test-DB note: production uses Supabase Vault (public.get_app_secret). The
-- migration creates a stub get_app_secret() if the Vault helper does not
-- exist, so the test bootstrap does not need to fake it separately.

BEGIN;

-- ============================================================
-- 0. Vault shim (idempotent)
-- ============================================================
-- Production has Supabase Vault providing get_app_secret(name). In the test
-- DB we synthesise it from a plain table so subject_ref_compute() works.
-- If the real function already exists, we leave it untouched.
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_proc p
        JOIN pg_namespace n ON n.oid = p.pronamespace
        WHERE n.nspname = 'public' AND p.proname = 'get_app_secret'
    ) THEN
        EXECUTE 'CREATE TABLE IF NOT EXISTS public.app_secrets ('
             || '  name TEXT PRIMARY KEY, value TEXT NOT NULL)';
        EXECUTE 'ALTER TABLE public.app_secrets ENABLE ROW LEVEL SECURITY';
        EXECUTE 'DROP POLICY IF EXISTS "app_secrets deny-all" ON public.app_secrets';
        EXECUTE 'CREATE POLICY "app_secrets deny-all" '
             || 'ON public.app_secrets FOR ALL USING (false) WITH CHECK (false)';
        EXECUTE 'CREATE OR REPLACE FUNCTION public.get_app_secret(p_name TEXT) '
             || 'RETURNS TEXT LANGUAGE sql STABLE SECURITY DEFINER '
             || 'SET search_path = public AS $f$ '
             || '  SELECT value FROM public.app_secrets WHERE name = p_name '
             || '$f$';
        EXECUTE 'REVOKE ALL ON FUNCTION public.get_app_secret(TEXT) FROM PUBLIC';
        EXECUTE 'GRANT EXECUTE ON FUNCTION public.get_app_secret(TEXT) TO service_role';
    END IF;
END;
$$;

-- ============================================================
-- 1. subject_ref_keys — HMAC key lifecycle metadata
-- ============================================================
CREATE TABLE IF NOT EXISTS public.subject_ref_keys (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id           UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    key_version         INT  NOT NULL,
    algorithm           TEXT NOT NULL DEFAULT 'HMAC-SHA-256'
                          CHECK (algorithm = 'HMAC-SHA-256'),
    vault_secret_name   TEXT NOT NULL,
    status              TEXT NOT NULL
                          CHECK (status IN ('active','rotating','retired','destroyed')),
    activated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    retiring_at         TIMESTAMPTZ,
    retired_at          TIMESTAMPTZ,
    destroyed_at        TIMESTAMPTZ,
    UNIQUE (tenant_id, key_version)
);

CREATE INDEX IF NOT EXISTS subject_ref_keys_active_idx
    ON public.subject_ref_keys (tenant_id, status, key_version DESC);

ALTER TABLE public.subject_ref_keys ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "subject_ref_keys service-role only" ON public.subject_ref_keys;
CREATE POLICY "subject_ref_keys service-role only"
    ON public.subject_ref_keys FOR ALL USING (false) WITH CHECK (false);

-- ============================================================
-- 2. subject_ref_mappings — reverse mapping (encrypted, DSR-gated)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.subject_ref_mappings (
    subject_ref            TEXT PRIMARY KEY,
    tenant_id              UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    key_version            INT  NOT NULL,
    subject_kind           TEXT NOT NULL
                              CHECK (subject_kind IN ('email','ip','user_id','session','device')),
    encrypted_value        BYTEA,
    created_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_seen_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
    retention_class        TEXT NOT NULL DEFAULT '3y'
                              CHECK (retention_class IN
                                ('forever','7y','3y','1y','90d','30d','7d')),
    deletion_requested_at  TIMESTAMPTZ,
    erased_at              TIMESTAMPTZ,
    FOREIGN KEY (tenant_id, key_version)
        REFERENCES public.subject_ref_keys (tenant_id, key_version)
);

CREATE INDEX IF NOT EXISTS subject_ref_mappings_tenant_kind_idx
    ON public.subject_ref_mappings (tenant_id, subject_kind);
CREATE INDEX IF NOT EXISTS subject_ref_mappings_pending_erase_idx
    ON public.subject_ref_mappings (deletion_requested_at)
    WHERE erased_at IS NULL AND deletion_requested_at IS NOT NULL;

ALTER TABLE public.subject_ref_mappings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "subject_ref_mappings service-role only" ON public.subject_ref_mappings;
CREATE POLICY "subject_ref_mappings service-role only"
    ON public.subject_ref_mappings FOR ALL USING (false) WITH CHECK (false);

-- ============================================================
-- 3. subject_ref_compute — HMAC helper
-- ============================================================
CREATE OR REPLACE FUNCTION public.subject_ref_compute(
    p_tenant_id     UUID,
    p_subject_kind  TEXT,
    p_value         TEXT,
    p_key_version   INT DEFAULT NULL
) RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
    v_key_version INT;
    v_secret_name TEXT;
    v_key         BYTEA;
    v_message     BYTEA;
BEGIN
    IF p_key_version IS NULL THEN
        SELECT key_version, vault_secret_name
          INTO v_key_version, v_secret_name
          FROM public.subject_ref_keys
         WHERE tenant_id = p_tenant_id AND status = 'active'
         ORDER BY key_version DESC
         LIMIT 1;
    ELSE
        SELECT key_version, vault_secret_name
          INTO v_key_version, v_secret_name
          FROM public.subject_ref_keys
         WHERE tenant_id = p_tenant_id AND key_version = p_key_version
           AND status IN ('active','rotating');
    END IF;

    IF v_key_version IS NULL THEN
        RAISE EXCEPTION 'no usable subject_ref key for tenant=%', p_tenant_id
            USING ERRCODE = 'no_data_found';
    END IF;

    v_key := convert_to(public.get_app_secret(v_secret_name), 'UTF8');
    v_message := convert_to(
        p_subject_kind || E'\x1f' || lower(trim(p_value)),
        'UTF8'
    );
    RETURN encode(extensions.hmac(v_message, v_key, 'sha256'), 'hex');
END;
$$;

REVOKE ALL ON FUNCTION public.subject_ref_compute(UUID, TEXT, TEXT, INT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.subject_ref_compute(UUID, TEXT, TEXT, INT) TO service_role;

-- ============================================================
-- 4. rotate_subject_ref_key — RFC-002 §13.2
-- ============================================================
CREATE OR REPLACE FUNCTION public.rotate_subject_ref_key(
    p_tenant_id UUID
) RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_new_version INT;
    v_secret_name TEXT;
BEGIN
    IF auth.role() <> 'service_role' THEN
        RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
    END IF;

    SELECT COALESCE(MAX(key_version),0) + 1
      INTO v_new_version
      FROM public.subject_ref_keys
     WHERE tenant_id = p_tenant_id;

    v_secret_name := format('subject_ref_key_%s_v%s', p_tenant_id, v_new_version);

    INSERT INTO public.subject_ref_keys
        (tenant_id, key_version, vault_secret_name, status, activated_at)
    VALUES
        (p_tenant_id, v_new_version, v_secret_name, 'active', now());

    UPDATE public.subject_ref_keys
       SET status      = 'rotating',
           retiring_at = now() + INTERVAL '30 days'
     WHERE tenant_id = p_tenant_id
       AND key_version < v_new_version
       AND status = 'active';

    UPDATE public.subject_ref_keys
       SET status     = 'retired',
           retired_at = now()
     WHERE tenant_id = p_tenant_id
       AND status = 'rotating'
       AND retiring_at < now();

    RETURN v_new_version;
END;
$$;

REVOKE ALL ON FUNCTION public.rotate_subject_ref_key(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.rotate_subject_ref_key(UUID) TO service_role;

-- ============================================================
-- 5. Erasure (§13.3)
-- ============================================================
CREATE OR REPLACE FUNCTION public.request_subject_erasure(
    p_tenant_id      UUID,
    p_subject_ref    TEXT,
    p_retention_hold INTERVAL DEFAULT INTERVAL '30 days',
    p_reason         TEXT DEFAULT NULL
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_request_id UUID := gen_random_uuid();
BEGIN
    IF NOT public.has_tenant_membership(p_tenant_id) THEN
        RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
    END IF;

    UPDATE public.subject_ref_mappings
       SET deletion_requested_at = now()
     WHERE tenant_id = p_tenant_id AND subject_ref = p_subject_ref;

    INSERT INTO public.runtime_events
        (tenant_id, type, severity, source, review_status,
         subject_ref, payload)
    VALUES
        (p_tenant_id, 'dsr.erasure_requested', 'high', 'governance', 'auto',
         p_subject_ref,
         jsonb_build_object(
             'request_id',      v_request_id,
             'retention_hold',  p_retention_hold::text,
             'reason',          p_reason
         ));

    RETURN v_request_id;
END;
$$;

REVOKE ALL ON FUNCTION public.request_subject_erasure(UUID, TEXT, INTERVAL, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.request_subject_erasure(UUID, TEXT, INTERVAL, TEXT)
    TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.process_subject_erasure_queue()
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_count INT := 0;
    r       RECORD;
BEGIN
    IF auth.role() <> 'service_role' THEN
        RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
    END IF;

    FOR r IN
        SELECT subject_ref, tenant_id
          FROM public.subject_ref_mappings
         WHERE erased_at IS NULL
           AND deletion_requested_at IS NOT NULL
           AND deletion_requested_at < now() - INTERVAL '30 days'
         FOR UPDATE SKIP LOCKED
    LOOP
        UPDATE public.subject_ref_mappings
           SET encrypted_value = NULL,
               erased_at       = now()
         WHERE subject_ref = r.subject_ref;

        INSERT INTO public.runtime_events
            (tenant_id, type, severity, source, review_status,
             subject_ref, payload)
        VALUES
            (r.tenant_id, 'dsr.erasure_completed', 'medium',
             'governance', 'auto', r.subject_ref,
             jsonb_build_object('method','soft'));

        v_count := v_count + 1;
    END LOOP;

    RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.process_subject_erasure_queue() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.process_subject_erasure_queue() TO service_role;

-- ============================================================
-- 6. DSR export view + RPC (§13.4, §13.5)
-- ============================================================
CREATE OR REPLACE VIEW public.subject_dsr_export_v
WITH (security_invoker = true)
AS
SELECT e.tenant_id, e.subject_ref, e.global_seq, e.tenant_seq,
       e.type, e.ts, e.payload, e.evidence_refs,
       e.prev_hash, e.event_hash
  FROM public.runtime_events e
 WHERE e.subject_ref IS NOT NULL;

GRANT SELECT ON public.subject_dsr_export_v TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.incident_correlation_export(
    p_tenant_id   UUID,
    p_subject_ref TEXT,
    p_since       TIMESTAMPTZ DEFAULT now() - INTERVAL '90 days'
) RETURNS TABLE (
    global_seq    BIGINT,
    tenant_seq    BIGINT,
    ts            TIMESTAMPTZ,
    type          TEXT,
    severity      TEXT,
    payload       JSONB,
    evidence_refs JSONB,
    prev_hash     TEXT,
    event_hash    TEXT
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF NOT public.has_tenant_membership(p_tenant_id) THEN
        RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
    END IF;

    RETURN QUERY
    SELECT e.global_seq, e.tenant_seq, e.ts, e.type, e.severity,
           e.payload, e.evidence_refs,
           encode(e.prev_hash,  'hex'),
           encode(e.event_hash, 'hex')
      FROM public.runtime_events e
     WHERE e.tenant_id = p_tenant_id
       AND e.subject_ref = p_subject_ref
       AND e.ts >= p_since
     ORDER BY e.tenant_seq;
END;
$$;

REVOKE ALL ON FUNCTION public.incident_correlation_export(UUID, TEXT, TIMESTAMPTZ) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.incident_correlation_export(UUID, TEXT, TIMESTAMPTZ)
    TO authenticated, service_role;

COMMIT;
