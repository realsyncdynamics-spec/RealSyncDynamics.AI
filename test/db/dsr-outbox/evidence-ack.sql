-- P0 #2360: isolated evidence ACK candidate, not an applied migration.
--
-- Executes only against service-role access. The caller must first claim an
-- existing outbox lease. A PostgreSQL FUNCTION call is one transaction:
-- mapping/erasure scheduling, hash-chain runtime_events (existing DB trigger),
-- governance_admin_log and outbox ACK are all-or-nothing.
--
-- Missing subject HMAC/mapping does NOT count as completed evidence. It
-- raises; the existing dsr_retry_outbox handles retry/backoff separately.
-- This file deliberately does not provision HMAC keys or create a new worker.
BEGIN;

CREATE FUNCTION public.dsr_ack_evidence(
  p_tenant uuid,
  p_operation uuid,
  p_worker uuid,
  p_lease_epoch bigint
) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  task public.dsr_outbox%ROWTYPE;
  request public.dsr_requests%ROWTYPE;
  mapping public.subject_ref_mappings%ROWTYPE;
  ref text;
BEGIN
  IF p_tenant IS NULL OR p_operation IS NULL OR p_worker IS NULL
     OR p_lease_epoch IS NULL OR p_lease_epoch <= 0 THEN
    RAISE EXCEPTION 'invalid evidence receipt' USING ERRCODE = '22023';
  END IF;

  -- Serializes replay and concurrent workers for one stable operation ID.
  SELECT * INTO task
    FROM public.dsr_outbox o
   WHERE o.tenant_id = p_tenant AND o.operation_id = p_operation
   FOR UPDATE;

  IF NOT FOUND THEN
    RETURN false;
  END IF;
  IF task.evidence_status = 'complete' THEN
    -- Idempotent ACK: do NOT emit a second event or repeat an erasure.
    RETURN false;
  END IF;
  IF task.evidence_status = 'failed' THEN
    RETURN false;
  END IF;
  IF task.lease_owner IS DISTINCT FROM p_worker
     OR task.lease_epoch IS DISTINCT FROM p_lease_epoch
     OR task.lease_until IS NULL
     OR task.lease_until <= clock_timestamp()
     OR task.evidence_status <> 'retry' THEN
    RAISE EXCEPTION 'stale worker lease' USING ERRCODE = '55000';
  END IF;

  IF task.event_type <> 'dsr.created' OR task.revision <> 1 THEN
    RAISE EXCEPTION 'unsupported evidence task' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO request
    FROM public.dsr_requests d
   WHERE d.id = task.dsr_id AND d.tenant_id = task.tenant_id
   FOR SHARE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'DSR record missing' USING ERRCODE = '23503';
  END IF;

  -- Fails closed until an existing HMAC key and mapping have been resolved.
  -- No PII is placed in the outbox or events.
  ref := request.metadata ->> 'subject_ref';
  IF ref IS NULL OR ref !~ '^[0-9a-f]{64}$' THEN
    RAISE EXCEPTION 'SUBJECT_REF_PENDING' USING ERRCODE = 'P0002';
  END IF;

  SELECT * INTO mapping
    FROM public.subject_ref_mappings m
   WHERE m.tenant_id = p_tenant
     AND m.subject_ref = ref
     AND m.subject_kind = 'email'
   FOR UPDATE;
  IF NOT FOUND OR mapping.erased_at IS NOT NULL THEN
    RAISE EXCEPTION 'SUBJECT_MAPPING_PENDING' USING ERRCODE = 'P0002';
  END IF;

  -- Existing hash-chain BEFORE INSERT trigger computes tenant_seq and the
  -- event_hash. No manual digest, chain rewrite, or parallel event ledger.
  INSERT INTO public.runtime_events
      (tenant_id, type, severity, source, review_status, spec_version,
       subject_ref, payload, correlation_id)
  VALUES
      (p_tenant, 'dsr.created', 'info', 'governance-dsr', 'auto', '0.2',
       ref,
       jsonb_build_object('dsr_id', task.dsr_id,
                          'operation_id', task.operation_id,
                          'request_type', request.request_type),
       task.dsr_id);

  -- Reuse the canonical 30-day erasure queue. The row lock above prevents a
  -- concurrent sweeper from racing this scheduling step; COALESCE preserves
  -- any earlier request timestamp. A replay after ACK emits nothing.
  IF request.request_type = 'erasure' THEN
    UPDATE public.subject_ref_mappings
       SET deletion_requested_at = COALESCE(deletion_requested_at, clock_timestamp())
     WHERE subject_ref = ref AND tenant_id = p_tenant
       AND erased_at IS NULL;

    INSERT INTO public.runtime_events
        (tenant_id, type, severity, source, review_status, spec_version,
         subject_ref, payload, correlation_id)
    VALUES
        (p_tenant, 'dsr.erasure_requested', 'high', 'governance-dsr',
         'auto', '0.2', ref,
         jsonb_build_object('dsr_id', task.dsr_id,
                            'operation_id', task.operation_id,
                            'retention_hold', '30 days'),
         task.dsr_id);
  END IF;

  -- Administrative audit and evidence share the same transaction. No actor
  -- email or plaintext request payload is copied into the log.
  INSERT INTO public.governance_admin_log
      (tenant_id, actor_user_id, actor_email, action, target_type,
       target_id, payload)
  VALUES
      (p_tenant, task.actor_user_id, NULL, 'dsr.create', 'dsr_request',
       task.dsr_id::text,
       jsonb_build_object('request_type', request.request_type,
                          'operation_id', task.operation_id));

  UPDATE public.dsr_outbox
     SET evidence_status = 'complete',
         lease_owner = NULL,
         lease_until = NULL,
         last_error_code = NULL,
         completed_at = clock_timestamp()
   WHERE tenant_id = p_tenant AND operation_id = p_operation;

  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.dsr_ack_evidence(uuid,uuid,uuid,bigint)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.dsr_ack_evidence(uuid,uuid,uuid,bigint)
  TO service_role;
COMMIT;
