-- RealSync Phase 3 / P0: transactional DSR evidence outbox.
-- REVIEW DRAFT. Apply only after isolated PostgreSQL integration tests and
-- an explicit deployment decision. No secrets or pg_cron schedule are changed.
--
-- Subject identity, mapping, erasure marker and runtime evidence are now
-- committed together during drain; an unavailable HMAC key leaves retryable
-- work instead of a falsely completed evidence status.
-- Every INSERT/UPDATE on dsr_requests creates an immutable pending work item
-- in the *same transaction*. Direct writes by the erasure sweeper are covered.
-- The worker appends to runtime_events and marks delivered in one transaction:
-- retries after a lost HTTP response must not duplicate chain events.
BEGIN;

CREATE TABLE IF NOT EXISTS public.dsr_evidence_outbox (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id           UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    dsr_id              UUID NOT NULL REFERENCES public.dsr_requests(id) ON DELETE RESTRICT,
    event_type          TEXT NOT NULL CHECK (event_type IN
                          ('dsr.created','dsr.updated','dsr.assigned','dsr.closed')),
    subject_ref         TEXT,
    event_payload       JSONB NOT NULL DEFAULT '{}'::jsonb,
    state               TEXT NOT NULL DEFAULT 'pending'
                          CHECK (state IN ('pending','failed','delivered')),
    attempt_count       INTEGER NOT NULL DEFAULT 0 CHECK (attempt_count >= 0),
    next_attempt_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    delivered_at        TIMESTAMPTZ,
    last_error          TEXT,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT dsr_outbox_delivered_timestamp CHECK
      ((state = 'delivered') = (delivered_at IS NOT NULL))
);
CREATE INDEX IF NOT EXISTS dsr_outbox_queue_idx
    ON public.dsr_evidence_outbox (next_attempt_at, created_at, id)
    WHERE state IN ('pending','failed') AND attempt_count < 12;
CREATE INDEX IF NOT EXISTS dsr_outbox_tenant_idx
    ON public.dsr_evidence_outbox (tenant_id, created_at DESC);

ALTER TABLE public.dsr_evidence_outbox ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.dsr_evidence_outbox FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.dsr_evidence_outbox TO authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.dsr_evidence_outbox TO service_role;

DROP POLICY IF EXISTS "dsr_outbox_tenant_read" ON public.dsr_evidence_outbox;
CREATE POLICY "dsr_outbox_tenant_read"
    ON public.dsr_evidence_outbox FOR SELECT TO authenticated
    USING (public.has_tenant_membership(tenant_id));
-- No public write policy. The queue is populated by a database trigger and
-- drained only via a guarded service-role RPC.

COMMENT ON TABLE public.dsr_evidence_outbox IS
    'P0: transactionally created evidence-delivery work for every DSR INSERT/UPDATE. No requester email/name in payload.';

CREATE OR REPLACE FUNCTION public.dsr_enqueue_evidence_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $fn$
DECLARE
    v_event_type TEXT;
    v_actor UUID;
BEGIN
    IF NEW.tenant_id IS NULL THEN
        RAISE EXCEPTION 'DSR evidence requires tenant_id' USING ERRCODE = '23502';
    END IF;

    IF TG_OP = 'INSERT' THEN
        v_event_type := 'dsr.created';
    ELSIF NEW.status IS DISTINCT FROM OLD.status
       AND NEW.status IN ('completed','rejected') THEN
        v_event_type := 'dsr.closed';
    ELSIF NEW.assigned_to IS DISTINCT FROM OLD.assigned_to
       AND NEW.status IS NOT DISTINCT FROM OLD.status THEN
        v_event_type := 'dsr.assigned';
    ELSE
        v_event_type := 'dsr.updated';
    END IF;

    -- An authenticated direct DB caller may have a JWT subject. The existing
    -- Edge handler writes with service_role and has NO JWT subject in DB.
    -- For that case actor_user_id remains NULL; the original Edge actor log
    -- is retained until a tenant-authorized mutation RPC is introduced.
    IF pg_catalog.current_setting('request.jwt.claim.sub', true)
       ~ '^[0-9a-fA-F-]{36}$' THEN
        v_actor := pg_catalog.current_setting('request.jwt.claim.sub', true)::uuid;
    END IF;

    -- A durable metadata-only audit row is inserted in the same transaction;
    -- a failure here rolls the DSR change back instead of pretending success.
    INSERT INTO public.governance_admin_log
        (tenant_id, actor_user_id, actor_email, action, target_type, target_id, payload)
    VALUES
        (NEW.tenant_id, v_actor, NULL, v_event_type,
         'dsr_request', NEW.id::text,
         pg_catalog.jsonb_build_object('status', NEW.status, 'source', 'dsr_db_trigger'));

    INSERT INTO public.dsr_evidence_outbox
        (tenant_id, dsr_id, event_type, subject_ref, event_payload)
    VALUES (
        NEW.tenant_id,
        NEW.id,
        v_event_type,
        NULLIF(NEW.metadata->>'subject_ref', ''),
        pg_catalog.jsonb_build_object(
            'request_type', NEW.request_type,
            'status', NEW.status,
            'audit_source', 'dsr_db_trigger'
        )
    );
    RETURN NEW;
END;
$fn$;

REVOKE ALL ON FUNCTION public.dsr_enqueue_evidence_change() FROM PUBLIC, anon, authenticated;
-- Trigger functions are invoked by PostgreSQL, not through the Data API.
DROP TRIGGER IF EXISTS trg_dsr_enqueue_evidence ON public.dsr_requests;
CREATE TRIGGER trg_dsr_enqueue_evidence
    AFTER INSERT OR UPDATE ON public.dsr_requests
    FOR EACH ROW EXECUTE FUNCTION public.dsr_enqueue_evidence_change();

-- Fail-closed processing of a small batch. The inner exception block is a
-- savepoint: if the append-only hash chain cannot be written, the event and
-- delivery mark roll back together. A later retry reuses the SAME outbox ID.
CREATE OR REPLACE FUNCTION public.dsr_outbox_drain(
    p_batch_size INTEGER DEFAULT 25
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $fn$
DECLARE
    v_item public.dsr_evidence_outbox%ROWTYPE;
    v_delivered INTEGER := 0;
    v_failed INTEGER := 0;
    v_pending INTEGER := 0;
    v_exhausted INTEGER := 0;
    v_retry INTEGER;
    v_dsr public.dsr_requests%ROWTYPE;
    v_subject_ref TEXT;
    v_key_version INTEGER;
    v_mapping_tenant UUID;
    v_key RECORD;
    v_candidate TEXT;
BEGIN
    IF auth.role() IS DISTINCT FROM 'service_role' THEN
        RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
    END IF;
    IF p_batch_size IS NULL OR p_batch_size < 1 OR p_batch_size > 100 THEN
        RAISE EXCEPTION 'p_batch_size must be between 1 and 100'
            USING ERRCODE = '22023';
    END IF;

    FOR v_item IN
        SELECT * FROM public.dsr_evidence_outbox
         WHERE state IN ('pending','failed')
           AND next_attempt_at <= pg_catalog.now()
           AND attempt_count < 12
         ORDER BY next_attempt_at, created_at, id
         LIMIT p_batch_size
         FOR UPDATE SKIP LOCKED
    LOOP
        BEGIN
            -- Never deliver a DSR event whose identity anchor is missing.
            -- The original DSR row holds the email; the queue has no PII.
            -- Locking it also serializes a later DSR update/finalization.
            SELECT * INTO v_dsr
              FROM public.dsr_requests d
             WHERE d.id = v_item.dsr_id AND d.tenant_id = v_item.tenant_id
             FOR UPDATE;
            IF NOT FOUND THEN
                RAISE EXCEPTION 'DSR no longer belongs to queue tenant'
                    USING ERRCODE = '23503';
            END IF;
            v_subject_ref := COALESCE(
                NULLIF(v_item.subject_ref, ''),
                NULLIF(v_dsr.metadata->>'subject_ref', '')
            );

            -- An existing mapping is authoritative and may already have
            -- been softly erased. Do not rotate or recreate erased mappings.
            v_key_version := NULL;
            v_mapping_tenant := NULL;
            IF v_subject_ref IS NOT NULL THEN
                SELECT m.tenant_id, m.key_version
                  INTO v_mapping_tenant, v_key_version
                  FROM public.subject_ref_mappings m
                 WHERE m.subject_ref = v_subject_ref
                 FOR UPDATE;
                IF FOUND AND v_mapping_tenant IS DISTINCT FROM v_item.tenant_id THEN
                    RAISE EXCEPTION 'subject mapping tenant mismatch'
                        USING ERRCODE = '42501';
                END IF;
            END IF;

            IF v_key_version IS NULL THEN
                -- For an unlinked request, derive a stable HMAC through the
                -- existing Vault-backed subject_ref_compute(), never an
                -- ad-hoc hash or newly minted secret. A missing Vault key
                -- remains retryable; never overwrite an old key on failure.
                IF NULLIF(v_dsr.requester_email, '') IS NULL
                   OR v_dsr.requester_email = '[erased]' THEN
                    RAISE EXCEPTION 'subject identity not available'
                        USING ERRCODE = 'P0002';
                END IF;
                FOR v_key IN
                    SELECT k.key_version
                      FROM public.subject_ref_keys k
                     WHERE k.tenant_id = v_item.tenant_id
                       AND k.status IN ('active', 'rotating')
                     ORDER BY (k.status = 'active') DESC, k.key_version DESC
                LOOP
                    v_candidate := public.subject_ref_compute(
                        v_item.tenant_id, 'email', v_dsr.requester_email,
                        v_key.key_version
                    );
                    IF v_candidate IS NOT NULL
                       AND (v_subject_ref IS NULL OR v_candidate = v_subject_ref) THEN
                        v_subject_ref := v_candidate;
                        v_key_version := v_key.key_version;
                        EXIT;
                    END IF;
                END LOOP;
                IF v_key_version IS NULL OR v_subject_ref IS NULL THEN
                    RAISE EXCEPTION 'subject reference key unavailable'
                        USING ERRCODE = 'P0002';
                END IF;

                INSERT INTO public.subject_ref_mappings
                    (subject_ref, tenant_id, key_version, subject_kind)
                VALUES (v_subject_ref, v_item.tenant_id, v_key_version, 'email')
                ON CONFLICT (subject_ref) DO NOTHING;
                -- A concurrent insert cannot silently bind a foreign tenant.
                PERFORM 1 FROM public.subject_ref_mappings m
                 WHERE m.subject_ref = v_subject_ref
                   AND m.tenant_id = v_item.tenant_id
                   AND m.key_version = v_key_version
                   AND m.subject_kind = 'email';
                IF NOT FOUND THEN
                    RAISE EXCEPTION 'subject mapping conflict'
                        USING ERRCODE = '23505';
                END IF;
            END IF;

            IF NULLIF(v_dsr.metadata->>'subject_ref', '') IS DISTINCT FROM v_subject_ref THEN
                IF NULLIF(v_dsr.metadata->>'subject_ref', '') IS NOT NULL THEN
                    RAISE EXCEPTION 'DSR subject reference changed'
                        USING ERRCODE = '23505';
                END IF;
                -- The existing AFTER UPDATE DSR evidence trigger also records
                -- this internal link change. Its work is durable and separate.
                UPDATE public.dsr_requests d
                   SET metadata = COALESCE(d.metadata, '{}'::jsonb) ||
                                  pg_catalog.jsonb_build_object('subject_ref', v_subject_ref)
                 WHERE d.id = v_dsr.id AND d.tenant_id = v_item.tenant_id;
            END IF;

            INSERT INTO public.runtime_events
                (tenant_id, type, severity, source, review_status,
                 subject_ref, payload, spec_version, correlation_id)
            VALUES
                (v_item.tenant_id, v_item.event_type,
                 CASE WHEN v_item.event_type = 'dsr.closed' THEN 'medium' ELSE 'info' END,
                 'governance-dsr-outbox', 'auto', v_subject_ref,
                 v_item.event_payload ||
                   pg_catalog.jsonb_build_object(
                       'dsr_id', v_item.dsr_id,
                       'outbox_id', v_item.id),
                 '0.2', v_item.dsr_id);

            -- Only the created erasure request may enqueue deletion.
            -- Replays are prevented by the same transaction's delivered ACK.
            -- Do not reset a prior deletion timestamp or resurrect an
            -- already-erased subject. The 30-day sweeper remains canonical.
            IF v_item.event_type = 'dsr.created'
               AND v_dsr.request_type = 'erasure' THEN
                UPDATE public.subject_ref_mappings m
                   SET deletion_requested_at =
                       COALESCE(m.deletion_requested_at, pg_catalog.now())
                 WHERE m.tenant_id = v_item.tenant_id
                   AND m.subject_ref = v_subject_ref
                   AND m.erased_at IS NULL;

                INSERT INTO public.runtime_events
                    (tenant_id, type, severity, source, review_status,
                     subject_ref, payload, spec_version, correlation_id)
                VALUES
                    (v_item.tenant_id, 'dsr.erasure_requested', 'high',
                     'governance-dsr-outbox', 'auto', v_subject_ref,
                     pg_catalog.jsonb_build_object(
                         'dsr_id', v_item.dsr_id,
                         'outbox_id', v_item.id,
                         'retention_hold', '30 days'),
                     '0.2', v_item.dsr_id);
            END IF;

            UPDATE public.dsr_evidence_outbox
               SET state = 'delivered',
                   attempt_count = attempt_count + 1,
                   delivered_at = pg_catalog.now(),
                   last_error = NULL
             WHERE id = v_item.id AND state <> 'delivered';
            v_delivered := v_delivered + 1;
        EXCEPTION WHEN OTHERS THEN
            -- The per-item subtransaction undoes any partial event append.
            -- Never persist raw SQLERRM here: database errors can embed PII.
            -- SQLSTATE is sufficient for retry classification and alerts.
            v_retry := LEAST(3600,
                pg_catalog.power(2, LEAST(v_item.attempt_count + 1, 11))::integer);
            UPDATE public.dsr_evidence_outbox
               SET state = 'failed',
                   attempt_count = attempt_count + 1,
                   next_attempt_at = pg_catalog.now() + v_retry * INTERVAL '1 second',
                   last_error = 'SQLSTATE_' || SQLSTATE
             WHERE id = v_item.id;
            v_failed := v_failed + 1;
        END;
    END LOOP;

    SELECT count(*) FILTER (WHERE state IN ('pending','failed') AND attempt_count < 12),
           count(*) FILTER (WHERE state = 'failed' AND attempt_count >= 12)
      INTO v_pending, v_exhausted
      FROM public.dsr_evidence_outbox;

    RETURN pg_catalog.jsonb_build_object(
      'delivered', v_delivered,
      'failed_in_batch', v_failed,
      'pending_retryable', v_pending,
      'exhausted', v_exhausted
    );
END;
$fn$;

REVOKE ALL ON FUNCTION public.dsr_outbox_drain(INTEGER) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.dsr_outbox_drain(INTEGER) TO service_role;

-- Rollout compatibility gate. Updated Edge handlers must never fall back to
-- best-effort evidence if this trigger is not installed and active.
CREATE OR REPLACE FUNCTION public.dsr_outbox_ready()
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $fn$
DECLARE
    v_ready BOOLEAN;
BEGIN
    IF auth.role() IS DISTINCT FROM 'service_role' THEN
        RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
    END IF;
    SELECT EXISTS (
        SELECT 1 FROM pg_catalog.pg_trigger
        WHERE tgname = 'trg_dsr_enqueue_evidence'
          AND tgrelid = 'public.dsr_requests'::pg_catalog.regclass
          AND NOT tgisinternal
          AND tgenabled IN ('O', 'A')
    ) INTO v_ready;
    RETURN v_ready;
END;
$fn$;
REVOKE ALL ON FUNCTION public.dsr_outbox_ready() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.dsr_outbox_ready() TO service_role;

COMMIT;
