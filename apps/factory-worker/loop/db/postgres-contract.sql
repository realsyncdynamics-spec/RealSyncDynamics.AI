-- SF-005 PostgreSQL checkpoint contract — REVIEW DRAFT, NOT A MIGRATION.
-- Apply only in an isolated, disposable Supabase/PostgreSQL test database.
-- The existing public.agent_tasks remains the ONLY job/task queue.
-- No changes to public.agent_tasks schema, existing runners, or cron.
BEGIN;

CREATE SCHEMA IF NOT EXISTS factory_runtime;
REVOKE ALL ON SCHEMA factory_runtime FROM PUBLIC, anon, authenticated;
GRANT USAGE ON SCHEMA factory_runtime TO service_role;

-- One checkpoint per existing Agent OS task: NOT an independent job queue.
CREATE TABLE IF NOT EXISTS factory_runtime.loop_checkpoints (
  task_id UUID PRIMARY KEY REFERENCES public.agent_tasks(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  run_id TEXT NOT NULL,
  goal_id TEXT NOT NULL,
  version BIGINT NOT NULL DEFAULT 1 CHECK (version >= 1),
  snapshot JSONB NOT NULL CHECK (jsonb_typeof(snapshot) = 'object'),
  lease_owner TEXT,
  lease_epoch BIGINT NOT NULL DEFAULT 0 CHECK (lease_epoch >= 0),
  lease_expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, run_id),
  CHECK ((lease_owner IS NULL) = (lease_expires_at IS NULL))
);

CREATE TABLE IF NOT EXISTS factory_runtime.loop_events (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  task_id UUID NOT NULL REFERENCES factory_runtime.loop_checkpoints(task_id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  version BIGINT NOT NULL CHECK (version >= 1),
  idempotency_key TEXT NOT NULL,
  snapshot JSONB NOT NULL,
  event_data JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (task_id, version),
  UNIQUE (task_id, idempotency_key)
);

-- Defense in depth even though this schema is not exposed through PostgREST.
ALTER TABLE factory_runtime.loop_checkpoints ENABLE ROW LEVEL SECURITY;
ALTER TABLE factory_runtime.loop_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE factory_runtime.loop_checkpoints, factory_runtime.loop_events
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON SEQUENCE factory_runtime.loop_events_id_seq
  FROM PUBLIC, anon, authenticated, service_role;

-- Server-side read only, scoped to a task in the requested tenant.
CREATE OR REPLACE FUNCTION factory_runtime.loop_read(
  p_task_id UUID, p_tenant_id UUID
) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog
AS $fn$
DECLARE r factory_runtime.loop_checkpoints%ROWTYPE;
BEGIN
  SELECT * INTO r FROM factory_runtime.loop_checkpoints
   WHERE task_id = p_task_id AND tenant_id = p_tenant_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'loop_not_found' USING ERRCODE = 'P0002'; END IF;
  RETURN jsonb_build_object(
    'snapshot', r.snapshot, 'version', r.version,
    'lease_epoch', r.lease_epoch, 'lease_expires_at', r.lease_expires_at
  );
END $fn$;

-- Create exactly one loop for an existing task, with atomic event evidence.
CREATE OR REPLACE FUNCTION factory_runtime.loop_init(
  p_task_id UUID, p_tenant_id UUID, p_idempotency_key TEXT,
  p_snapshot JSONB, p_event JSONB
) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog
AS $fn$
DECLARE t public.agent_tasks%ROWTYPE;
        old_event factory_runtime.loop_events%ROWTYPE;
BEGIN
  IF p_idempotency_key !~ '^[A-Za-z0-9._:-]{8,100}$' THEN
    RAISE EXCEPTION 'invalid_idempotency_key' USING ERRCODE = '22023';
  END IF;
  IF p_snapshot IS NULL OR jsonb_typeof(p_snapshot) <> 'object' OR
     octet_length(p_snapshot::text) > 65536 OR
     p_event IS NULL OR jsonb_typeof(p_event) <> 'object' OR
     octet_length(p_event::text) > 4096 THEN
    RAISE EXCEPTION 'invalid_checkpoint_payload' USING ERRCODE = '22023';
  END IF;
  -- Parent row lock serializes competing initializations and task deletion.
  SELECT * INTO t FROM public.agent_tasks WHERE id = p_task_id FOR UPDATE;
  IF NOT FOUND OR t.tenant_id IS DISTINCT FROM p_tenant_id OR
     t.status <> 'open' OR t.input->>'factory_kind' IS DISTINCT FROM 'software_factory' THEN
    RAISE EXCEPTION 'task_binding_denied' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO old_event FROM factory_runtime.loop_events
   WHERE task_id = p_task_id AND idempotency_key = p_idempotency_key;
  IF FOUND THEN
    IF old_event.snapshot IS DISTINCT FROM p_snapshot OR old_event.event_data IS DISTINCT FROM p_event THEN
      RAISE EXCEPTION 'idempotency_conflict' USING ERRCODE = '23505';
    END IF;
    RETURN jsonb_build_object('version', old_event.version, 'replayed', true);
  END IF;
  IF (p_snapshot->>'schemaVersion')::INT IS DISTINCT FROM 1 OR
     p_snapshot->>'status' IS DISTINCT FROM 'ready' OR
     (p_snapshot->>'checkpointVersion')::BIGINT IS DISTINCT FROM 1 OR
     p_snapshot->'goal'->>'jobId' IS DISTINCT FROM p_task_id::TEXT OR
     p_snapshot->'goal'->>'repository' IS DISTINCT FROM t.input->>'repository' OR
     p_snapshot->'goal'->>'requireHumanReview' IS DISTINCT FROM 'true' OR
     p_snapshot->>'runId' IS NULL OR p_snapshot->'goal'->>'goalId' IS NULL OR
     jsonb_typeof(p_snapshot->'events') IS DISTINCT FROM 'array' OR
     jsonb_array_length(p_snapshot->'events') IS DISTINCT FROM 1 OR
     p_event IS DISTINCT FROM p_snapshot->'events'->0 OR
     p_event->>'type' IS DISTINCT FROM 'loop_created' OR
     jsonb_typeof(p_snapshot->'nextSteps') IS DISTINCT FROM 'array' THEN
    RAISE EXCEPTION 'invalid_initial_goal_checkpoint' USING ERRCODE = '22023';
  END IF;
  -- Do not allow clients to initialize an already-finished run.
  INSERT INTO factory_runtime.loop_checkpoints(task_id, tenant_id, run_id, goal_id, version, snapshot)
  VALUES (p_task_id, p_tenant_id, p_snapshot->>'runId',
          p_snapshot->'goal'->>'goalId', 1, p_snapshot);
  INSERT INTO factory_runtime.loop_events
      (task_id, tenant_id, version, idempotency_key, snapshot, event_data)
  VALUES (p_task_id, p_tenant_id, 1, p_idempotency_key, p_snapshot, p_event);
  -- Existing Agent OS audit, same transaction: if it fails, all changes roll back.
  INSERT INTO public.agent_events(tenant_id, event_type, subject_type, subject_id, agent, payload)
  VALUES (p_tenant_id, 'factory.loop.created', 'task', p_task_id::TEXT, NULL,
          jsonb_build_object('run_id', p_snapshot->>'runId', 'version', 1));
  RETURN jsonb_build_object('version', 1, 'replayed', false);
END $fn$;

-- Lease and fencing epoch: a stale worker cannot continue after takeover.
CREATE OR REPLACE FUNCTION factory_runtime.loop_claim(
  p_task_id UUID, p_tenant_id UUID, p_worker_id TEXT, p_lease_seconds INT DEFAULT 300
) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog
AS $fn$
DECLARE r factory_runtime.loop_checkpoints%ROWTYPE;
        new_epoch BIGINT;
        expires_at TIMESTAMPTZ;
BEGIN
  IF p_worker_id !~ '^[A-Za-z0-9._:-]{4,100}$' OR
     p_lease_seconds NOT BETWEEN 30 AND 900 THEN
    RAISE EXCEPTION 'invalid_lease_request' USING ERRCODE = '22023';
  END IF;
  -- Lock parent before checkpoint: serializes with cancellation/deletion.
  PERFORM 1 FROM public.agent_tasks t
    WHERE t.id = p_task_id AND t.tenant_id = p_tenant_id
      AND t.status IN ('open','in_progress')
      AND t.input->>'factory_kind' = 'software_factory' FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'task_binding_revoked' USING ERRCODE = '42501'; END IF;
  SELECT * INTO r FROM factory_runtime.loop_checkpoints
   WHERE task_id = p_task_id AND tenant_id = p_tenant_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'loop_not_found' USING ERRCODE = 'P0002'; END IF;
  IF r.snapshot->>'status' IN ('review_required','blocked') THEN
    RAISE EXCEPTION 'loop_terminal' USING ERRCODE = '55000';
  END IF;
  IF (r.snapshot->>'deadlineAtMs')::BIGINT <
     (extract(epoch FROM clock_timestamp()) * 1000)::BIGINT THEN
    RAISE EXCEPTION 'loop_deadline_exceeded' USING ERRCODE = '55000';
  END IF;
  IF r.lease_expires_at IS NOT NULL AND r.lease_expires_at > clock_timestamp() THEN
    RAISE EXCEPTION 'loop_already_claimed' USING ERRCODE = '55P03';
  END IF;
  new_epoch := r.lease_epoch + 1;
  expires_at := clock_timestamp() + make_interval(secs => p_lease_seconds);
  UPDATE factory_runtime.loop_checkpoints
     SET lease_owner = p_worker_id, lease_epoch = new_epoch,
         lease_expires_at = expires_at, updated_at = now()
   WHERE task_id = p_task_id;
  INSERT INTO public.agent_events(tenant_id, event_type, subject_type, subject_id, agent, payload)
  VALUES (p_tenant_id, 'factory.loop.lease_claimed', 'task', p_task_id::TEXT, p_worker_id,
          jsonb_build_object('lease_epoch', new_epoch));
  RETURN jsonb_build_object('version', r.version, 'lease_epoch', new_epoch,
                            'lease_expires_at', expires_at);
END $fn$;


-- Current lease holder may extend its lease without changing the fence epoch.
CREATE OR REPLACE FUNCTION factory_runtime.loop_heartbeat(
  p_task_id UUID, p_tenant_id UUID, p_worker_id TEXT,
  p_lease_epoch BIGINT, p_lease_seconds INT DEFAULT 300
) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog
AS $fn$
DECLARE r factory_runtime.loop_checkpoints%ROWTYPE;
        v_exp TIMESTAMPTZ;
BEGIN
  IF p_worker_id !~ '^[A-Za-z0-9._:-]{4,100}$' OR
     p_lease_epoch < 1 OR p_lease_seconds NOT BETWEEN 30 AND 900 THEN
    RAISE EXCEPTION 'invalid_heartbeat' USING ERRCODE = '22023';
  END IF;
  PERFORM 1 FROM public.agent_tasks t
    WHERE t.id = p_task_id AND t.tenant_id = p_tenant_id
      AND t.status IN ('open','in_progress')
      AND t.input->>'factory_kind' = 'software_factory' FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'task_binding_revoked' USING ERRCODE = '42501'; END IF;
  SELECT * INTO r FROM factory_runtime.loop_checkpoints
   WHERE task_id = p_task_id AND tenant_id = p_tenant_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'loop_not_found' USING ERRCODE = 'P0002'; END IF;
  IF r.snapshot->>'status' IN ('review_required','blocked') OR
     (r.snapshot->>'deadlineAtMs')::BIGINT <=
       (extract(epoch FROM clock_timestamp()) * 1000)::BIGINT THEN
    RAISE EXCEPTION 'loop_terminal_or_expired' USING ERRCODE = '55000';
  END IF;
  IF r.lease_owner IS DISTINCT FROM p_worker_id OR
     r.lease_epoch IS DISTINCT FROM p_lease_epoch OR
     r.lease_expires_at IS NULL OR r.lease_expires_at <= clock_timestamp() THEN
    RAISE EXCEPTION 'stale_or_missing_lease' USING ERRCODE = '55P03';
  END IF;
  v_exp := LEAST(clock_timestamp() + make_interval(secs => p_lease_seconds),
                  to_timestamp((r.snapshot->>'deadlineAtMs')::NUMERIC / 1000));
  UPDATE factory_runtime.loop_checkpoints
     SET lease_expires_at = v_exp, updated_at = now()
   WHERE task_id = p_task_id;
  RETURN jsonb_build_object('version', r.version, 'lease_epoch', r.lease_epoch,
                            'lease_expires_at', v_exp);
END $fn$;

-- Early release for planned handoff, fenced against stale workers.
CREATE OR REPLACE FUNCTION factory_runtime.loop_release(
  p_task_id UUID, p_tenant_id UUID, p_worker_id TEXT, p_lease_epoch BIGINT
) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog
AS $fn$
DECLARE r factory_runtime.loop_checkpoints%ROWTYPE;
BEGIN
  IF p_worker_id !~ '^[A-Za-z0-9._:-]{4,100}$' OR p_lease_epoch < 1 THEN
    RAISE EXCEPTION 'invalid_release' USING ERRCODE = '22023';
  END IF;
  PERFORM 1 FROM public.agent_tasks t
    WHERE t.id = p_task_id AND t.tenant_id = p_tenant_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'task_binding_revoked' USING ERRCODE = '42501'; END IF;
  SELECT * INTO r FROM factory_runtime.loop_checkpoints
   WHERE task_id = p_task_id AND tenant_id = p_tenant_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'loop_not_found' USING ERRCODE = 'P0002'; END IF;
  IF r.lease_owner IS DISTINCT FROM p_worker_id OR
     r.lease_epoch IS DISTINCT FROM p_lease_epoch OR
     r.lease_expires_at IS NULL OR r.lease_expires_at <= clock_timestamp() THEN
    RAISE EXCEPTION 'stale_or_missing_lease' USING ERRCODE = '55P03';
  END IF;
  UPDATE factory_runtime.loop_checkpoints
     SET lease_owner = NULL, lease_expires_at = NULL, updated_at = now()
   WHERE task_id = p_task_id;
  INSERT INTO public.agent_events(tenant_id, event_type, subject_type,
                                 subject_id, agent, payload)
  VALUES (p_tenant_id, 'factory.loop.lease_released', 'task',
          p_task_id::TEXT, p_worker_id,
          jsonb_build_object('lease_epoch', p_lease_epoch));
  RETURN jsonb_build_object('released', true, 'lease_epoch', p_lease_epoch);
END $fn$;

-- Atomic compare-and-swap + append-only event. Caller must own a live lease.
CREATE OR REPLACE FUNCTION factory_runtime.loop_commit(
  p_task_id UUID, p_tenant_id UUID, p_expected_version BIGINT,
  p_worker_id TEXT, p_lease_epoch BIGINT, p_idempotency_key TEXT,
  p_snapshot JSONB, p_event JSONB
) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog
AS $fn$
DECLARE r factory_runtime.loop_checkpoints%ROWTYPE;
        previous factory_runtime.loop_events%ROWTYPE;
        n INT;
        from_state TEXT;
        to_state TEXT;
        event_type TEXT;
BEGIN
  IF p_idempotency_key !~ '^[A-Za-z0-9._:-]{8,100}$' OR
     p_snapshot IS NULL OR jsonb_typeof(p_snapshot) <> 'object' OR
     octet_length(p_snapshot::text) > 65536 OR
     p_event IS NULL OR jsonb_typeof(p_event) <> 'object' OR
     octet_length(p_event::text) > 4096 THEN
    RAISE EXCEPTION 'invalid_commit_payload' USING ERRCODE = '22023';
  END IF;
  -- Lock parent before checkpoint: serializes with cancellation/deletion.
  PERFORM 1 FROM public.agent_tasks t
    WHERE t.id = p_task_id AND t.tenant_id = p_tenant_id
      AND t.status IN ('open','in_progress')
      AND t.input->>'factory_kind' = 'software_factory' FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'task_binding_revoked' USING ERRCODE = '42501'; END IF;
  SELECT * INTO r FROM factory_runtime.loop_checkpoints
   WHERE task_id = p_task_id AND tenant_id = p_tenant_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'loop_not_found' USING ERRCODE = 'P0002'; END IF;
  SELECT * INTO previous FROM factory_runtime.loop_events
   WHERE task_id = p_task_id AND idempotency_key = p_idempotency_key;
  IF FOUND THEN
    IF previous.snapshot IS DISTINCT FROM p_snapshot OR previous.event_data IS DISTINCT FROM p_event THEN
      RAISE EXCEPTION 'idempotency_conflict' USING ERRCODE = '23505';
    END IF;
    RETURN jsonb_build_object('version', previous.version, 'replayed', true);
  END IF;
  IF r.version <> p_expected_version THEN
    RAISE EXCEPTION 'stale_checkpoint_version' USING ERRCODE = '40001';
  END IF;
  IF r.lease_owner IS DISTINCT FROM p_worker_id OR r.lease_epoch <> p_lease_epoch OR
     r.lease_expires_at IS NULL OR r.lease_expires_at <= clock_timestamp() THEN
    RAISE EXCEPTION 'stale_or_missing_lease' USING ERRCODE = '55P03';
  END IF;
  -- Server clock is authoritative; only a blocked stop may arrive late.
  IF (p_snapshot->>'deadlineAtMs')::BIGINT <
     (extract(epoch FROM clock_timestamp()) * 1000)::BIGINT AND
     p_snapshot->>'status' IS DISTINCT FROM 'blocked' THEN
    RAISE EXCEPTION 'loop_deadline_exceeded' USING ERRCODE = '55000';
  END IF;
  from_state := r.snapshot->>'status';
  to_state := p_snapshot->>'status';
  event_type := p_event->>'type';
  IF NOT (
      (from_state = 'ready' AND to_state = 'awaiting_verification' AND event_type = 'evidence_submitted') OR
      (from_state = 'awaiting_verification' AND
       to_state IN ('retry_required','review_required','blocked') AND event_type = 'verification_completed') OR
      (from_state = 'retry_required' AND to_state = 'ready' AND event_type = 'retry_started') OR
      (from_state IN ('ready','awaiting_verification','retry_required') AND
       to_state = 'blocked' AND event_type = 'loop_stopped')
  ) THEN RAISE EXCEPTION 'invalid_loop_transition' USING ERRCODE = '22023'; END IF;
  IF p_snapshot->'goal' IS DISTINCT FROM r.snapshot->'goal' OR
     p_snapshot->'limits' IS DISTINCT FROM r.snapshot->'limits' OR
     p_snapshot->>'runId' IS DISTINCT FROM r.run_id OR
     p_snapshot->>'startedAtMs' IS DISTINCT FROM r.snapshot->>'startedAtMs' OR
     p_snapshot->>'deadlineAtMs' IS DISTINCT FROM r.snapshot->>'deadlineAtMs' OR
     (p_snapshot->>'checkpointVersion')::BIGINT IS DISTINCT FROM r.version + 1 OR
     jsonb_typeof(p_snapshot->'nextSteps') IS DISTINCT FROM 'array' OR
     jsonb_typeof(p_snapshot->'events') IS DISTINCT FROM 'array' THEN
    RAISE EXCEPTION 'checkpoint_contract_mismatch' USING ERRCODE = '22023';
  END IF;
  n := jsonb_array_length(p_snapshot->'events');
  IF n IS DISTINCT FROM jsonb_array_length(r.snapshot->'events') + 1 OR
     (p_snapshot->'events' - (n - 1)) IS DISTINCT FROM r.snapshot->'events' OR
     (p_snapshot->'events'->(n - 1)) IS DISTINCT FROM p_event OR
     (p_event->>'seq')::INT IS DISTINCT FROM n THEN
    RAISE EXCEPTION 'event_history_mismatch' USING ERRCODE = '22023';
  END IF;
  IF (p_snapshot->>'iteration')::INT IS NULL OR
     (p_snapshot->>'spentCents')::INT IS NULL OR
     (p_snapshot->>'iteration')::INT < (r.snapshot->>'iteration')::INT OR
     (p_snapshot->>'iteration')::INT > (p_snapshot->'limits'->>'maxIterations')::INT OR
     (p_snapshot->>'spentCents')::INT < (r.snapshot->>'spentCents')::INT OR
     (p_snapshot->>'spentCents')::INT > (p_snapshot->'limits'->>'maxCostCents')::INT THEN
    RAISE EXCEPTION 'loop_limit_mismatch' USING ERRCODE = '22023';
  END IF;
  -- Label inequality is not an attestation, but blocks obvious self-review.
  IF to_state = 'review_required' AND (
      p_event->'details'->>'verifierId' IS NULL OR
      p_event->'details'->>'verifierId' IS NOT DISTINCT FROM
        p_snapshot->'submission'->>'authorId'
  ) THEN RAISE EXCEPTION 'verifier_not_independent' USING ERRCODE = '22023'; END IF;
  IF to_state = 'review_required' AND (
      jsonb_typeof(p_snapshot->'checks') IS DISTINCT FROM 'array' OR
      jsonb_array_length(p_snapshot->'checks') IS DISTINCT FROM
        jsonb_array_length(p_snapshot->'goal'->'criteria') OR
      EXISTS (SELECT 1 FROM jsonb_array_elements(p_snapshot->'checks') x
                WHERE x->>'passed' IS DISTINCT FROM 'true')
  ) THEN RAISE EXCEPTION 'review_requires_all_checks' USING ERRCODE = '22023'; END IF;

  -- A single PostgreSQL function call is one transaction. An event failure
  -- rolls back the checkpoint UPDATE as well.
  UPDATE factory_runtime.loop_checkpoints
     SET snapshot = p_snapshot, version = r.version + 1, updated_at = now()
   WHERE task_id = p_task_id;
  INSERT INTO factory_runtime.loop_events
      (task_id, tenant_id, version, idempotency_key, snapshot, event_data)
  VALUES (p_task_id, p_tenant_id, r.version + 1,
          p_idempotency_key, p_snapshot, p_event);
  INSERT INTO public.agent_events(tenant_id, event_type, subject_type, subject_id, agent, payload)
  VALUES (p_tenant_id, 'factory.loop.' || event_type, 'task', p_task_id::TEXT,
          p_worker_id, jsonb_build_object('run_id', r.run_id,
          'version', r.version + 1, 'status', to_state));
  RETURN jsonb_build_object('version', r.version + 1, 'replayed', false);
END $fn$;

-- Function EXECUTE must be explicitly granted; no public API.
REVOKE ALL ON FUNCTION factory_runtime.loop_read(UUID,UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION factory_runtime.loop_init(UUID,UUID,TEXT,JSONB,JSONB) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION factory_runtime.loop_claim(UUID,UUID,TEXT,INT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION factory_runtime.loop_heartbeat(UUID,UUID,TEXT,BIGINT,INT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION factory_runtime.loop_release(UUID,UUID,TEXT,BIGINT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION factory_runtime.loop_commit(UUID,UUID,BIGINT,TEXT,BIGINT,TEXT,JSONB,JSONB)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION factory_runtime.loop_read(UUID,UUID) TO service_role;
GRANT EXECUTE ON FUNCTION factory_runtime.loop_init(UUID,UUID,TEXT,JSONB,JSONB) TO service_role;
GRANT EXECUTE ON FUNCTION factory_runtime.loop_claim(UUID,UUID,TEXT,INT) TO service_role;
GRANT EXECUTE ON FUNCTION factory_runtime.loop_heartbeat(UUID,UUID,TEXT,BIGINT,INT) TO service_role;
GRANT EXECUTE ON FUNCTION factory_runtime.loop_release(UUID,UUID,TEXT,BIGINT) TO service_role;
GRANT EXECUTE ON FUNCTION factory_runtime.loop_commit(UUID,UUID,BIGINT,TEXT,BIGINT,TEXT,JSONB,JSONB)
  TO service_role;
COMMIT;
