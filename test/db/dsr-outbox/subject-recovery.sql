-- P0 #2360: isolated subject HMAC/mapping RECOVERY candidate; NOT a migration.
-- This is a service-role-only step for a future existing RealSync worker.
-- It repairs metadata and mapping in one PostgreSQL transaction, under the
-- same leased/epoch-fenced outbox row as dsr_ack_evidence().
-- It NEVER creates cryptographic keys or Vault secrets, never resets erasure
-- history, and never claims the Evidence task complete.
BEGIN;

CREATE FUNCTION public.dsr_recover_subject_ref(
  p_tenant uuid, p_operation uuid, p_worker uuid, p_lease_epoch bigint
) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  task public.dsr_outbox%ROWTYPE;
  request public.dsr_requests%ROWTYPE;
  mapping public.subject_ref_mappings%ROWTYPE;
  key_version integer;
  ref text;
  recomputed text;
  actual_email_binding bytea;
BEGIN
  IF p_tenant IS NULL OR p_operation IS NULL OR p_worker IS NULL
     OR p_lease_epoch IS NULL OR p_lease_epoch <= 0 THEN
    RAISE EXCEPTION 'invalid recovery receipt' USING ERRCODE = '22023';
  END IF;

  -- Same ordering as ACK (outbox -> DSR -> mapping) to avoid deadlocks.
  SELECT * INTO task FROM public.dsr_outbox o
   WHERE o.tenant_id = p_tenant AND o.operation_id = p_operation
   FOR UPDATE;
  IF NOT FOUND OR task.evidence_status IN ('complete','failed') THEN
    RETURN false;
  END IF;
  IF task.lease_owner IS DISTINCT FROM p_worker
     OR task.lease_epoch IS DISTINCT FROM p_lease_epoch
     OR task.lease_until IS NULL OR task.lease_until <= clock_timestamp()
     OR task.evidence_status <> 'retry'
     OR task.event_type <> 'dsr.created' OR task.revision <> 1 THEN
    RAISE EXCEPTION 'stale or unsupported worker lease' USING ERRCODE = '55000';
  END IF;

  SELECT * INTO request FROM public.dsr_requests d
   WHERE d.id = task.dsr_id AND d.tenant_id = p_tenant
   FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'DSR record missing' USING ERRCODE = '23503';
  END IF;
  IF request.metadata IS NOT NULL AND jsonb_typeof(request.metadata) <> 'object' THEN
    RAISE EXCEPTION 'invalid DSR metadata' USING ERRCODE = '22023';
  END IF;

  -- Verify the unchanged email against the immutable intake receipt.
  -- No plaintext PII may enter the outbox or runtime_events.
  actual_email_binding := pg_catalog.sha256(pg_catalog.convert_to(
    pg_catalog.jsonb_build_array('dsr-email-v1',p_tenant::text,
      p_operation::text,pg_catalog.lower(pg_catalog.btrim(request.requester_email)))::text,
    'UTF8'));
  IF actual_email_binding IS DISTINCT FROM task.email_binding THEN
    RAISE EXCEPTION 'REQUESTER_EMAIL_CHANGED' USING ERRCODE = 'P0002';
  END IF;

  ref := request.metadata ->> 'subject_ref';
  IF ref IS NOT NULL THEN
    IF ref !~ '^[0-9a-f]{64}$' THEN
      RAISE EXCEPTION 'SUBJECT_REF_BINDING_PENDING' USING ERRCODE = 'P0002';
    END IF;
    SELECT * INTO mapping FROM public.subject_ref_mappings m
      WHERE m.tenant_id = p_tenant
        AND m.subject_ref = ref AND m.subject_kind = 'email'
      FOR UPDATE;
    IF NOT FOUND OR mapping.erased_at IS NOT NULL THEN
      RAISE EXCEPTION 'SUBJECT_MAPPING_PENDING' USING ERRCODE = 'P0002';
    END IF;
    BEGIN
      recomputed := public.subject_ref_compute(
        p_tenant,'email',request.requester_email,mapping.key_version);
    EXCEPTION WHEN OTHERS THEN
      RAISE EXCEPTION 'SUBJECT_REF_BINDING_PENDING' USING ERRCODE = 'P0002';
    END;
    IF recomputed IS DISTINCT FROM ref THEN
      RAISE EXCEPTION 'SUBJECT_REF_BINDING_PENDING' USING ERRCODE = 'P0002';
    END IF;
    -- Already mapped: do not touch deletion_requested_at or erased_at.
    RETURN true;
  END IF;

  -- Key metadata/Vault secret are provisioned by existing governance code;
  -- missing keys/secrets are retryable, NOT implicit DSR success.
  SELECT k.key_version INTO key_version FROM public.subject_ref_keys k
   WHERE k.tenant_id = p_tenant AND k.status = 'active'
   ORDER BY k.key_version DESC LIMIT 1;
  IF key_version IS NULL THEN
    RAISE EXCEPTION 'SUBJECT_KEY_PENDING' USING ERRCODE = 'P0002';
  END IF;

  BEGIN
    ref := public.subject_ref_compute(
      p_tenant,'email',request.requester_email,key_version);
  EXCEPTION WHEN OTHERS THEN
    RAISE EXCEPTION 'SUBJECT_REF_BINDING_PENDING' USING ERRCODE = 'P0002';
  END;
  IF ref IS NULL OR ref !~ '^[0-9a-f]{64}$' THEN
    RAISE EXCEPTION 'SUBJECT_REF_BINDING_PENDING' USING ERRCODE = 'P0002';
  END IF;

  -- Existing mapping may belong to another request for the same subject.
  -- Conflict must NEVER overwrite tenant, key, lifecycle or encrypted value.
  INSERT INTO public.subject_ref_mappings
    (subject_ref,tenant_id,key_version,subject_kind)
  VALUES (ref,p_tenant,key_version,'email')
  ON CONFLICT (subject_ref) DO NOTHING;
  SELECT * INTO mapping FROM public.subject_ref_mappings m
   WHERE m.subject_ref = ref FOR UPDATE;
  IF NOT FOUND OR mapping.tenant_id IS DISTINCT FROM p_tenant
     OR mapping.subject_kind IS DISTINCT FROM 'email'
     OR mapping.key_version IS DISTINCT FROM key_version
     OR mapping.erased_at IS NOT NULL THEN
    RAISE EXCEPTION 'SUBJECT_MAPPING_CONFLICT' USING ERRCODE = 'P0002';
  END IF;

  UPDATE public.dsr_requests
    SET metadata = jsonb_set(coalesce(request.metadata,'{}'::jsonb),
                             '{subject_ref}', to_jsonb(ref), true)
    WHERE id = request.id AND tenant_id = p_tenant;
  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.dsr_recover_subject_ref(uuid,uuid,uuid,bigint)
  FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.dsr_recover_subject_ref(uuid,uuid,uuid,bigint)
  TO service_role;
COMMIT;
