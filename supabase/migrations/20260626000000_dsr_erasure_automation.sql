-- P0.2 — DSAR-Erfuellungs-Automatisierung (RFC-002 §13 Verdrahtung).
--
-- Die Erasure-Maschinerie aus 20260603000000_subject_ref_lifecycle.sql
-- (request_subject_erasure / process_subject_erasure_queue / subject_ref_*)
-- existierte, war aber komplett abgekoppelt: niemand schrieb Mappings,
-- niemand rief die Queue, kein Scheduler. Diese Migration ergaenzt die
-- fehlenden DB-Bausteine; die Edge Functions governance-dsr (Producer) und
-- governance-erasure-sweeper (Scheduler-Target) verdrahten den Rest.
--
-- Zwei neue RPCs:
--   1. dsr_subject_inventory()       — Art. 15: wo liegen Daten zum Subjekt?
--   2. dsr_finalize_erased_requests() — nach Soft-Erase der Mapping die
--      Klartext-PII in dsr_requests redacten + Anfrage schliessen.
--
-- Plus pg_cron-Schedule, der den Sweeper taeglich 03:00 UTC anstoesst
-- (Muster identisch zu 20260531000000_agent_os_runner_cron.sql).
--
-- Wichtig zur Architektur: runtime_events ist append-only und traegt NIE
-- Klartext-PII — nur den pseudonymen subject_ref (HMAC). „Loeschung" heisst
-- daher: Klartext in dsr_requests redacten + Mapping soft-erasen (Key-Bezug
-- kappen). Die pseudonymen Events bleiben (Nachweisbarkeit der Hash-Chain).
-- Juristische Eignung pro Anwendungsfall ist durch den DSB zu pruefen.

BEGIN;

-- ============================================================
-- 0. Latenter Bug-Fix: runtime_events.spec_version Default
-- ============================================================
-- 20260604100000_runtime_events_spec_version_v02.sql hat die CHECK-Constraint
-- auf spec_version IN ('0.1','0.2') verschaerft, den Spalten-Default aber bei
-- '1.0' belassen. Folge: JEDER INSERT in runtime_events, der spec_version
-- nicht explizit setzt, verletzt die Constraint — das betrifft die bestehenden
-- request_subject_erasure()/process_subject_erasure_queue() (RFC-002 §13) und
-- jeden anderen Producer, der auf den Default vertraut. Wir ziehen den Default
-- auf '0.2' nach (= der vom TypeScript-Helper createRuntimeEvent() genutzte
-- Wert), damit die Erasure-Kette ueberhaupt Events schreiben kann.
ALTER TABLE public.runtime_events ALTER COLUMN spec_version SET DEFAULT '0.2';

-- ============================================================
-- 1. dsr_subject_inventory — Art. 15 Datenbestand pro Subjekt
-- ============================================================
CREATE OR REPLACE FUNCTION public.dsr_subject_inventory(
    p_tenant_id   UUID,
    p_subject_ref TEXT
) RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_events INT;
    v_dsrs   INT;
    v_map    public.subject_ref_mappings%ROWTYPE;
BEGIN
    IF NOT public.has_tenant_membership(p_tenant_id) THEN
        RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
    END IF;

    SELECT count(*) INTO v_events
      FROM public.runtime_events
     WHERE tenant_id = p_tenant_id AND subject_ref = p_subject_ref;

    SELECT count(*) INTO v_dsrs
      FROM public.dsr_requests
     WHERE tenant_id = p_tenant_id
       AND metadata->>'subject_ref' = p_subject_ref;

    SELECT * INTO v_map
      FROM public.subject_ref_mappings
     WHERE tenant_id = p_tenant_id AND subject_ref = p_subject_ref;

    RETURN jsonb_build_object(
        'subject_ref',            p_subject_ref,
        'runtime_events',         v_events,
        'dsr_requests',           v_dsrs,
        'mapping_exists',         v_map.subject_ref IS NOT NULL,
        'subject_kind',           v_map.subject_kind,
        'retention_class',        v_map.retention_class,
        'deletion_requested_at',  v_map.deletion_requested_at,
        'erased_at',              v_map.erased_at
    );
END;
$$;

REVOKE ALL ON FUNCTION public.dsr_subject_inventory(UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.dsr_subject_inventory(UUID, TEXT)
    TO authenticated, service_role;

-- ============================================================
-- 2. dsr_finalize_erased_requests — Klartext-PII redacten + schliessen
-- ============================================================
-- Laeuft NACH process_subject_erasure_queue(): fuer jede dsr_requests-Zeile
-- vom Typ 'erasure', deren subject_ref-Mapping bereits erased_at gesetzt hat
-- und die noch nicht abgeschlossen ist, wird die im DSR-Datensatz selbst
-- gehaltene Klartext-PII (requester_email/-name/subject_description) entfernt
-- und die Anfrage als completed markiert.
CREATE OR REPLACE FUNCTION public.dsr_finalize_erased_requests(
    p_tenant_id UUID DEFAULT NULL
) RETURNS INT
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
        SELECT d.id, d.tenant_id, m.subject_ref
          FROM public.dsr_requests d
          JOIN public.subject_ref_mappings m
            ON m.subject_ref = d.metadata->>'subject_ref'
           AND m.tenant_id   = d.tenant_id
         WHERE m.erased_at IS NOT NULL
           AND d.request_type = 'erasure'
           AND d.status <> 'completed'
           AND (p_tenant_id IS NULL OR d.tenant_id = p_tenant_id)
         FOR UPDATE OF d SKIP LOCKED
    LOOP
        UPDATE public.dsr_requests
           SET requester_email     = '[erased]',
               requester_name      = NULL,
               subject_description = NULL,
               response_notes      = COALESCE(NULLIF(response_notes, ''), '')
                   || CASE WHEN COALESCE(response_notes, '') = '' THEN '' ELSE E'\n' END
                   || 'Personenbezogene Daten geloescht (DSGVO Art. 17, automatisiert).',
               status              = 'completed',
               completed_at        = COALESCE(completed_at, now())
         WHERE id = r.id;

        INSERT INTO public.runtime_events
            (tenant_id, type, severity, source, review_status, subject_ref, payload, spec_version)
        VALUES
            (r.tenant_id, 'dsr.request_finalized', 'medium', 'governance', 'auto',
             r.subject_ref,
             jsonb_build_object('dsr_id', r.id, 'method', 'erasure_redaction'),
             '0.2');

        v_count := v_count + 1;
    END LOOP;

    RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.dsr_finalize_erased_requests(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.dsr_finalize_erased_requests(UUID) TO service_role;

-- ============================================================
-- 3. pg_cron — taeglicher Sweep ueber den Sweeper-Edge-Function
-- ============================================================
-- process_subject_erasure_queue() hat einen auth.role()='service_role' Guard;
-- pg_cron-SQL laeuft NICHT als service_role. Darum stoesst der Cron den
-- Edge Function governance-erasure-sweeper an (laeuft mit Service-Role-Key),
-- der beide RPCs in der richtigen Reihenfolge ausfuehrt.
--
-- Erfordert (einmalig vom Operator):
--   ALTER DATABASE postgres SET app.supabase_url = 'https://<ref>.supabase.co';
--   SELECT public.set_app_secret('governance_erasure_sweeper_token', '<random>');
--
-- pg_cron/pg_net sind Supabase-spezifisch; in CI graceful uebersprungen.
DO $$
BEGIN
  EXECUTE 'CREATE EXTENSION IF NOT EXISTS pg_cron';
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'pg_cron nicht verfuegbar (CI-Umgebung) — Schedule uebersprungen.';
  RETURN;
END $$;

DO $$
BEGIN
  EXECUTE 'CREATE EXTENSION IF NOT EXISTS pg_net';
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'pg_net nicht verfuegbar — Schedule uebersprungen.';
  RETURN;
END $$;

DO $$
BEGIN
  PERFORM cron.unschedule('dsr-erasure-sweep')
  WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'dsr-erasure-sweep');
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'cron.unschedule uebersprungen (pg_cron nicht aktiv).';
END $$;

DO $$
BEGIN
  PERFORM cron.schedule(
    'dsr-erasure-sweep',
    '0 3 * * *',
    $cron$
      SELECT net.http_post(
        url     := current_setting('app.supabase_url', true) || '/functions/v1/governance-erasure-sweeper',
        headers := jsonb_build_object(
          'Content-Type',  'application/json',
          'Authorization', 'Bearer ' || public.get_app_secret('governance_erasure_sweeper_token')
        ),
        body    := jsonb_build_object('trigger', 'cron')
      );
    $cron$
  );
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'cron.schedule (dsr-erasure-sweep) uebersprungen (pg_cron nicht aktiv).';
END $$;

COMMIT;
