-- P0 #2360: isolated PostgreSQL consumer candidate, stacked on intake.sql.
-- NOT an automatic production migration. Requires schema/RLS review first.
BEGIN;

ALTER TABLE public.dsr_outbox
  ADD COLUMN IF NOT EXISTS attempt_count integer NOT NULL DEFAULT 0
    CHECK (attempt_count >= 0),
  ADD COLUMN IF NOT EXISTS lease_token uuid,
  ADD COLUMN IF NOT EXISTS lease_until timestamptz,
  ADD COLUMN IF NOT EXISTS next_attempt_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS last_error_code text,
  ADD COLUMN IF NOT EXISTS completed_at timestamptz;

CREATE INDEX IF NOT EXISTS dsr_outbox_ready_idx
  ON public.dsr_outbox (next_attempt_at, created_at)
  WHERE evidence_status IN ('pending', 'retry');

-- Claim up to p_limit tasks. Concurrent workers skip locked rows.
-- A new lease token fences a worker that wakes after a crash/timeout.
CREATE OR REPLACE FUNCTION public.dsr_outbox_claim(
  p_limit integer DEFAULT 10,
  p_lease_seconds integer DEFAULT 120
) RETURNS TABLE (
  tenant_id uuid, operation_id uuid, dsr_id uuid, actor_user_id uuid,
  event_type text, revision bigint, lease_token uuid, attempt_count integer
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  IF p_limit IS NULL OR p_limit NOT BETWEEN 1 AND 100
     OR p_lease_seconds IS NULL OR p_lease_seconds NOT BETWEEN 10 AND 3600 THEN
    RAISE EXCEPTION 'invalid claim limits' USING ERRCODE = '22023';
  END IF;

  -- Expired final attempts must become visible dead letters, not vanish.
  UPDATE public.dsr_outbox AS o
     SET evidence_status = 'failed', lease_token = NULL, lease_until = NULL,
         last_error_code = 'LEASE_EXHAUSTED'
   WHERE o.evidence_status IN ('pending', 'retry')
     AND o.attempt_count >= 8
     AND (o.lease_until IS NULL OR o.lease_until < clock_timestamp());

  RETURN QUERY
    WITH available AS (
      SELECT o.tenant_id, o.operation_id
        FROM public.dsr_outbox AS o
       WHERE o.evidence_status IN ('pending', 'retry')
         AND o.attempt_count < 8
         AND o.next_attempt_at <= clock_timestamp()
         AND (o.lease_until IS NULL OR o.lease_until < clock_timestamp())
       ORDER BY o.next_attempt_at, o.created_at
       LIMIT p_limit
       FOR UPDATE OF o SKIP LOCKED
    )
    UPDATE public.dsr_outbox AS o
       SET attempt_count = o.attempt_count + 1,
           lease_token = gen_random_uuid(),
           lease_until = clock_timestamp() + make_interval(secs => p_lease_seconds)
      FROM available a
     WHERE o.tenant_id = a.tenant_id AND o.operation_id = a.operation_id
  RETURNING o.tenant_id, o.operation_id, o.dsr_id, o.actor_user_id,
            o.event_type, o.revision, o.lease_token, o.attempt_count;
END;
$$;

-- Only a current lease holder may release/retry a task.
-- Store structured error CODES only, never raw exceptions or PII.
CREATE OR REPLACE FUNCTION public.dsr_outbox_fail(
  p_tenant uuid, p_operation uuid, p_token uuid, p_error_code text
) RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_attempts integer;
  v_status text;
BEGIN
  IF p_tenant IS NULL OR p_operation IS NULL OR p_token IS NULL
     OR p_error_code IS NULL OR p_error_code !~ '^[A-Z][A-Z0-9_]{1,63}$' THEN
    RAISE EXCEPTION 'invalid failure receipt' USING ERRCODE = '22023';
  END IF;

  SELECT o.attempt_count INTO v_attempts
    FROM public.dsr_outbox o
   WHERE o.tenant_id = p_tenant AND o.operation_id = p_operation
     AND o.lease_token = p_token
     AND o.evidence_status IN ('pending','retry')
     AND o.lease_until > clock_timestamp()
   FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'lease lost or task already completed' USING ERRCODE = '40001';
  END IF;
  v_status := CASE WHEN v_attempts >= 8 THEN 'failed' ELSE 'retry' END;

  UPDATE public.dsr_outbox AS o
     SET evidence_status = v_status,
         next_attempt_at = clock_timestamp() +
           (LEAST(3600, 5 * power(2, LEAST(v_attempts, 9))) * interval '1 second'),
         last_error_code = p_error_code,
         lease_until = NULL, lease_token = NULL
   WHERE o.tenant_id = p_tenant AND o.operation_id = p_operation;

  RETURN v_status;
END;
$$;

-- Atomically record DSR evidence + governance admin log + complete the task.
-- The source DSR must already have a valid tenant-scoped subject mapping.
-- A missing mapping fails the transaction and remains retryable via dsr_outbox_fail.
CREATE OR REPLACE FUNCTION public.dsr_outbox_complete(
  p_tenant uuid, p_operation uuid, p_token uuid
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_task public.dsr_outbox%ROWTYPE;
  v_dsr public.dsr_requests%ROWTYPE;
  v_subject_ref text;
  v_event_id uuid;
BEGIN
  IF p_tenant IS NULL OR p_operation IS NULL OR p_token IS NULL THEN
    RAISE EXCEPTION 'missing completion identity' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_task
    FROM public.dsr_outbox o
   WHERE o.tenant_id = p_tenant AND o.operation_id = p_operation
   FOR UPDATE;
  IF NOT FOUND OR v_task.lease_token IS DISTINCT FROM p_token
     OR v_task.lease_until IS NULL OR v_task.lease_until <= clock_timestamp()
     OR v_task.evidence_status NOT IN ('pending', 'retry') THEN
    RAISE EXCEPTION 'lease lost or task already completed' USING ERRCODE = '40001';
  END IF;

  SELECT * INTO v_dsr FROM public.dsr_requests d
   WHERE d.id = v_task.dsr_id AND d.tenant_id = p_tenant FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'DSR not found in tenant' USING ERRCODE = '23503';
  END IF;
  IF v_task.event_type <> 'dsr.created' OR v_task.revision <> 1 THEN
    RAISE EXCEPTION 'unsupported outbox event' USING ERRCODE = '22023';
  END IF;

  v_subject_ref := v_dsr.metadata->>'subject_ref';
  IF v_subject_ref IS NULL OR length(v_subject_ref) < 8 THEN
    RAISE EXCEPTION 'subject reference pending' USING ERRCODE = '22023';
  END IF;
  PERFORM 1 FROM public.subject_ref_mappings m
   WHERE m.tenant_id = p_tenant AND m.subject_ref = v_subject_ref FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'subject mapping pending' USING ERRCODE = '22023';
  END IF;

  -- Never bypass the existing 30-day erasure retention queue.
  IF v_dsr.request_type = 'erasure' THEN
    UPDATE public.subject_ref_mappings m
       SET deletion_requested_at = COALESCE(m.deletion_requested_at, clock_timestamp())
     WHERE m.tenant_id = p_tenant AND m.subject_ref = v_subject_ref
       AND m.erased_at IS NULL;
  END IF;

  INSERT INTO public.governance_admin_log
    (tenant_id, actor_user_id, actor_email, action, target_type, target_id, payload)
  VALUES (p_tenant, v_task.actor_user_id, NULL, 'dsr.create',
          'dsr_request', v_task.dsr_id::text,
          jsonb_build_object('request_type', v_dsr.request_type, 'operation_id', p_operation));

  INSERT INTO public.runtime_events
    (tenant_id, type, severity, source, spec_version, review_status,
     subject_ref, payload, correlation_id)
  VALUES (p_tenant, 'dsr.created', 'info', 'governance-dsr', '0.2', 'auto',
          v_subject_ref,
          jsonb_build_object('dsr_id', v_task.dsr_id,
                             'request_type', v_dsr.request_type,
                             'operation_id', p_operation,
                             'revision', v_task.revision),
          v_task.dsr_id)
  RETURNING id INTO v_event_id;

  UPDATE public.dsr_outbox o
     SET evidence_status = 'complete', completed_at = clock_timestamp(),
         lease_token = NULL, lease_until = NULL, last_error_code = NULL
   WHERE o.tenant_id = p_tenant AND o.operation_id = p_operation;

  RETURN v_event_id;
END;
$$;

REVOKE ALL ON FUNCTION public.dsr_outbox_claim(integer, integer)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.dsr_outbox_fail(uuid, uuid, uuid, text)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.dsr_outbox_complete(uuid, uuid, uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.dsr_outbox_claim(integer, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.dsr_outbox_fail(uuid, uuid, uuid, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.dsr_outbox_complete(uuid, uuid, uuid) TO service_role;

COMMIT;
