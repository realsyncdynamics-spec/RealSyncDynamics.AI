-- RealSync Phase 3 / P0: transactional DSR evidence outbox.
-- REVIEW DRAFT. Apply only after isolated PostgreSQL integration tests and
-- an explicit deployment decision. No secrets or pg_cron schedule are changed.
--
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
                          ('dsr.created','dsr.updated','dsr.assigned','dsr.closed','dsr.erasure_requested')),
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


-- Durable subject-link recovery: read only pending DSRs. Plaintext requester
-- email never enters an outbox payload, runtime event or log. The service-only
-- cron worker receives it just long enough to compute the HMAC reference.
CREATE OR REPLACE FUNCTION public.dsr_outbox_subject_pending(
  p_batch_size integer DEFAULT 25
) RETURNS TABLE (
  dsr_id uuid, tenant_id uuid, requester_email text, request_type text
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $fn$
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;
  IF p_batch_size IS NULL OR p_batch_size NOT BETWEEN 1 AND 100 THEN
    RAISE EXCEPTION 'invalid batch size' USING ERRCODE = '22023';
  END IF;

  RETURN QUERY
    SELECT d.id, d.tenant_id, d.requester_email, d.request_type
      FROM public.dsr_requests d
     WHERE d.tenant_id IS NOT NULL
       AND EXISTS (
         SELECT 1 FROM public.dsr_evidence_outbox o
          WHERE o.dsr_id = d.id AND o.tenant_id = d.tenant_id
            AND o.state IN ('pending', 'failed') AND o.attempt_count < 12
       )
       AND NOT EXISTS (
         SELECT 1 FROM public.subject_ref_mappings m
          WHERE m.tenant_id = d.tenant_id
            AND m.subject_ref = d.metadata->>'subject_ref'
            AND (d.request_type <> 'erasure'
                 OR m.deletion_requested_at IS NOT NULL
                 OR m.erased_at IS NOT NULL)
       )
     ORDER BY d.received_at, d.id
     LIMIT p_batch_size;
END;
$fn$;

-- Atomically bind a computed HMAC to its DSR and existing erasure queue.
-- Triggered DSR metadata changes produce a separate durable dsr.updated event;
-- the operation is idempotent and preserves the original 30-day hold.
CREATE OR REPLACE FUNCTION public.dsr_outbox_subject_link(
  p_dsr_id uuid, p_tenant_id uuid, p_subject_ref text, p_key_version integer
) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $fn$
DECLARE
  v_dsr public.dsr_requests%ROWTYPE;
  v_mapping public.subject_ref_mappings%ROWTYPE;
  v_expected_ref text;
  v_erasure_at timestamptz;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;
  IF p_dsr_id IS NULL OR p_tenant_id IS NULL
      OR p_subject_ref IS NULL OR length(p_subject_ref) NOT BETWEEN 8 AND 256
      OR p_key_version IS NULL OR p_key_version < 1 THEN
    RAISE EXCEPTION 'invalid subject link identity' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_dsr FROM public.dsr_requests
   WHERE id = p_dsr_id AND tenant_id = p_tenant_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'DSR not found for tenant' USING ERRCODE = '23503';
  END IF;
  IF NULLIF(v_dsr.metadata->>'subject_ref', '') IS NOT NULL
     AND v_dsr.metadata->>'subject_ref' <> p_subject_ref THEN
    RAISE EXCEPTION 'subject identity mismatch' USING ERRCODE = '23514';
  END IF;

  -- Guard the supplied HMAC against accidental binding to another tenant or
  -- a stale/nonexistent key. A recomputed HMAC alone is not authorization.
  PERFORM 1 FROM public.subject_ref_keys k
   WHERE k.tenant_id = p_tenant_id AND k.key_version = p_key_version
     AND k.status IN ('active', 'rotating');
  IF NOT FOUND THEN
    RAISE EXCEPTION 'subject key unavailable' USING ERRCODE = '23503';
  END IF;

  -- Recompute in PostgreSQL against the actual protected Vault key:
  -- even a compromised or buggy internal caller cannot attach a different
  -- person's HMAC merely by passing a plausible-looking reference.
  SELECT public.subject_ref_compute(
    p_tenant_id, 'email', v_dsr.requester_email, p_key_version
  ) INTO v_expected_ref;
  IF v_expected_ref IS DISTINCT FROM p_subject_ref THEN
    RAISE EXCEPTION 'subject reference HMAC mismatch' USING ERRCODE = '23514';
  END IF;

  INSERT INTO public.subject_ref_mappings
    (subject_ref, tenant_id, key_version, subject_kind)
  VALUES (p_subject_ref, p_tenant_id, p_key_version, 'email')
  ON CONFLICT (subject_ref) DO NOTHING;

  SELECT * INTO v_mapping FROM public.subject_ref_mappings
   WHERE subject_ref = p_subject_ref AND tenant_id = p_tenant_id
     AND key_version = p_key_version AND subject_kind = 'email'
   FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'subject mapping conflict' USING ERRCODE = '23514';
  END IF;

  IF NULLIF(v_dsr.metadata->>'subject_ref', '') IS NULL THEN
    UPDATE public.dsr_requests
       SET metadata = COALESCE(metadata, '{}'::jsonb) ||
                      pg_catalog.jsonb_build_object('subject_ref', p_subject_ref)
     WHERE id = p_dsr_id AND tenant_id = p_tenant_id;
  END IF;

  IF v_dsr.request_type = 'erasure' AND v_mapping.erased_at IS NULL THEN
    -- First caller wins: retries never reset the retention hold or enqueue
    -- a second event. Mapping update + outbox event share this transaction.
    UPDATE public.subject_ref_mappings
       SET deletion_requested_at = now()
     WHERE subject_ref = p_subject_ref AND tenant_id = p_tenant_id
       AND deletion_requested_at IS NULL
    RETURNING deletion_requested_at INTO v_erasure_at;
    IF v_erasure_at IS NOT NULL THEN
      INSERT INTO public.dsr_evidence_outbox
        (tenant_id, dsr_id, event_type, subject_ref, event_payload)
      VALUES (p_tenant_id, p_dsr_id, 'dsr.erasure_requested', p_subject_ref,
        pg_catalog.jsonb_build_object(
          'request_id', p_dsr_id, 'retention_hold', '30 days',
          'reason', 'dsr:' || p_dsr_id::text
        ));
    END IF;
  END IF;
  RETURN true;
END;
$fn$;

REVOKE ALL ON FUNCTION public.dsr_outbox_subject_pending(integer)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.dsr_outbox_subject_link(uuid, uuid, text, integer)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.dsr_outbox_subject_pending(integer)
  TO service_role;
GRANT EXECUTE ON FUNCTION public.dsr_outbox_subject_link(uuid, uuid, text, integer)
  TO service_role;

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
    v_subject_ref TEXT;
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
            -- Do not mark an event delivered before subject linkage and
            -- erasure enqueue are durably verified. Use the current mapping,
            -- not the stale subject_ref snapshot captured at DSR intake.
            SELECT m.subject_ref INTO v_subject_ref
              FROM public.dsr_requests d
              JOIN public.subject_ref_mappings m
                ON m.tenant_id = d.tenant_id
               AND m.subject_ref = d.metadata->>'subject_ref'
             WHERE d.id = v_item.dsr_id AND d.tenant_id = v_item.tenant_id
               AND (d.request_type <> 'erasure'
                    OR m.deletion_requested_at IS NOT NULL
                    OR m.erased_at IS NOT NULL);
            IF v_subject_ref IS NULL THEN
              RAISE EXCEPTION 'subject linkage pending' USING ERRCODE = '23503';
            END IF;
            INSERT INTO public.runtime_events
                (tenant_id, type, severity, source, review_status,
                 subject_ref, payload, spec_version, correlation_id)
            VALUES
                (v_item.tenant_id, v_item.event_type,
                 CASE WHEN v_item.event_type = 'dsr.erasure_requested' THEN 'high'
                      WHEN v_item.event_type = 'dsr.closed' THEN 'medium'
                      ELSE 'info' END,
                 'governance-dsr-outbox', 'auto', v_subject_ref,
                 v_item.event_payload ||
                   pg_catalog.jsonb_build_object(
                       'dsr_id', v_item.dsr_id,
                       'outbox_id', v_item.id),
                 '0.2', v_item.dsr_id);

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
