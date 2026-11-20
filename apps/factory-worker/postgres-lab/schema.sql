-- SF-008: EPHEMERAL test schema, NEVER a Supabase migration.
-- Execute only against the purpose-created sf008_test database.
\set ON_ERROR_STOP on
BEGIN;

CREATE SCHEMA sf008;
REVOKE ALL ON SCHEMA sf008 FROM PUBLIC;
CREATE ROLE sf008_worker NOLOGIN;
CREATE ROLE sf008_intruder NOLOGIN;
GRANT USAGE ON SCHEMA sf008 TO sf008_worker;

CREATE TABLE sf008.jobs (
  scope_id text NOT NULL,
  job_id text NOT NULL,
  version bigint NOT NULL DEFAULT 0 CHECK (version >= 0),
  state text NOT NULL DEFAULT 'draft',
  PRIMARY KEY(scope_id, job_id)
);
CREATE TABLE sf008.events (
  scope_id text NOT NULL,
  job_id text NOT NULL,
  seq bigint NOT NULL,
  to_state text NOT NULL,
  payload_hash text NOT NULL,
  PRIMARY KEY(scope_id, job_id, seq)
);
CREATE TABLE sf008.receipts (
  scope_id text NOT NULL,
  job_id text NOT NULL,
  request_key text NOT NULL,
  payload_hash text NOT NULL,
  result_version bigint NOT NULL,
  PRIMARY KEY(scope_id, job_id, request_key)
);
CREATE TABLE sf008.outbox (
  scope_id text NOT NULL,
  job_id text NOT NULL,
  seq bigint NOT NULL,
  destination text NOT NULL,
  payload_hash text NOT NULL,
  PRIMARY KEY(scope_id, job_id, seq, destination)
);
CREATE TABLE sf008.cost_ledger (
  scope_id text NOT NULL,
  job_id text NOT NULL,
  request_key text NOT NULL,
  reserved_cents bigint NOT NULL CHECK(reserved_cents >= 0),
  PRIMARY KEY(scope_id, job_id, request_key)
);
CREATE TABLE sf008.leases (
  scope_id text NOT NULL,
  job_id text NOT NULL,
  revision bigint NOT NULL DEFAULT 0 CHECK(revision >= 0),
  fencing_epoch bigint NOT NULL DEFAULT 0 CHECK(fencing_epoch >= 0),
  holder_id text,
  expires_at timestamptz,
  PRIMARY KEY(scope_id, job_id)
);

-- RLS is enabled on ALL private test tables. Only the test worker can see scope A.
-- The test role is not equivalent to an authenticated production operator/JWT.
ALTER TABLE sf008.jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE sf008.events ENABLE ROW LEVEL SECURITY;
ALTER TABLE sf008.receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE sf008.outbox ENABLE ROW LEVEL SECURITY;
ALTER TABLE sf008.cost_ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE sf008.leases ENABLE ROW LEVEL SECURITY;

CREATE POLICY sf008_jobs_read ON sf008.jobs FOR SELECT TO sf008_worker
  USING (scope_id = 'internal_A');
CREATE POLICY sf008_jobs_update ON sf008.jobs FOR UPDATE TO sf008_worker
  USING (scope_id = 'internal_A') WITH CHECK (scope_id = 'internal_A');
CREATE POLICY sf008_events_read ON sf008.events FOR SELECT TO sf008_worker
  USING (scope_id = 'internal_A');
CREATE POLICY sf008_events_insert ON sf008.events FOR INSERT TO sf008_worker
  WITH CHECK (scope_id = 'internal_A');
CREATE POLICY sf008_receipts_read ON sf008.receipts FOR SELECT TO sf008_worker
  USING (scope_id = 'internal_A');
CREATE POLICY sf008_receipts_insert ON sf008.receipts FOR INSERT TO sf008_worker
  WITH CHECK (scope_id = 'internal_A');
CREATE POLICY sf008_outbox_read ON sf008.outbox FOR SELECT TO sf008_worker
  USING (scope_id = 'internal_A');
CREATE POLICY sf008_outbox_insert ON sf008.outbox FOR INSERT TO sf008_worker
  WITH CHECK (scope_id = 'internal_A');
CREATE POLICY sf008_ledger_read ON sf008.cost_ledger FOR SELECT TO sf008_worker
  USING (scope_id = 'internal_A');
CREATE POLICY sf008_ledger_insert ON sf008.cost_ledger FOR INSERT TO sf008_worker
  WITH CHECK (scope_id = 'internal_A');
CREATE POLICY sf008_leases_read ON sf008.leases FOR SELECT TO sf008_worker
  USING (scope_id = 'internal_A');
CREATE POLICY sf008_leases_update ON sf008.leases FOR UPDATE TO sf008_worker
  USING (scope_id = 'internal_A') WITH CHECK (scope_id = 'internal_A');

GRANT SELECT, UPDATE ON sf008.jobs TO sf008_worker;
GRANT SELECT, INSERT ON sf008.events, sf008.receipts, sf008.outbox, sf008.cost_ledger TO sf008_worker;
GRANT SELECT, UPDATE ON sf008.leases TO sf008_worker;
REVOKE ALL ON ALL TABLES IN SCHEMA sf008 FROM PUBLIC;

-- Pure ephemeral test procedure: DB atomicity, version conflict and idempotency.
-- No external operations are triggered; amount=0 means NO real budget proof.
CREATE FUNCTION sf008.advance(
  p_scope text, p_job text, p_expected bigint, p_key text,
  p_hash text, p_state text, p_force_error boolean DEFAULT false
) RETURNS text
LANGUAGE plpgsql SECURITY INVOKER SET search_path = pg_catalog, sf008
AS $fn$
DECLARE
  previous_hash text;
  next_version bigint;
BEGIN
  IF p_scope !~ '^[A-Za-z0-9_-]{1,80}$'
     OR p_job !~ '^[A-Za-z0-9_-]{1,80}$'
     OR p_key !~ '^[A-Za-z0-9_-]{1,120}$'
     OR p_hash !~ '^[0-9a-f]{64}$'
     OR p_expected < 0
     OR p_state NOT IN ('running', 'testing', 'review_required') THEN
    RAISE EXCEPTION 'invalid_request';
  END IF;
  SELECT payload_hash INTO previous_hash FROM sf008.receipts
    WHERE scope_id = p_scope AND job_id = p_job AND request_key = p_key;
  IF FOUND THEN
    IF previous_hash <> p_hash THEN
      RAISE EXCEPTION 'idempotency_conflict';
    END IF;
    RETURN 'replay';
  END IF;
  UPDATE sf008.jobs SET version = version + 1, state = p_state
    WHERE scope_id = p_scope AND job_id = p_job AND version = p_expected
    RETURNING version INTO next_version;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'version_conflict';
  END IF;
  INSERT INTO sf008.events(scope_id, job_id, seq, to_state, payload_hash)
    VALUES (p_scope, p_job, next_version, p_state, p_hash);
  INSERT INTO sf008.receipts(scope_id, job_id, request_key, payload_hash, result_version)
    VALUES (p_scope, p_job, p_key, p_hash, next_version);
  INSERT INTO sf008.outbox(scope_id, job_id, seq, destination, payload_hash)
    VALUES (p_scope, p_job, next_version, 'fixture_only', p_hash);
  INSERT INTO sf008.cost_ledger(scope_id, job_id, request_key, reserved_cents)
    VALUES (p_scope, p_job, p_key, 0);
  IF p_force_error THEN RAISE EXCEPTION 'forced_rollback'; END IF;
  RETURN 'committed';
END;
$fn$;

CREATE FUNCTION sf008.acquire_lease(
  p_scope text, p_job text, p_holder text, p_ttl_seconds integer
) RETURNS bigint
LANGUAGE plpgsql SECURITY INVOKER SET search_path = pg_catalog, sf008
AS $fn$
DECLARE new_epoch bigint;
BEGIN
  IF p_holder !~ '^[A-Za-z0-9_-]{1,100}$'
     OR p_ttl_seconds IS NULL OR p_ttl_seconds < 1 OR p_ttl_seconds > 300 THEN
    RAISE EXCEPTION 'invalid_lease_request';
  END IF;
  UPDATE sf008.leases
    SET revision = revision + 1,
        fencing_epoch = fencing_epoch + 1,
        holder_id = p_holder,
        expires_at = clock_timestamp() + make_interval(secs => p_ttl_seconds)
    WHERE scope_id = p_scope AND job_id = p_job
      AND (holder_id IS NULL OR expires_at <= clock_timestamp())
    RETURNING fencing_epoch INTO new_epoch;
  IF NOT FOUND THEN RAISE EXCEPTION 'lease_busy_or_missing'; END IF;
  RETURN new_epoch;
END;
$fn$;

CREATE FUNCTION sf008.require_fence(
  p_scope text, p_job text, p_holder text, p_epoch bigint
) RETURNS boolean
LANGUAGE plpgsql SECURITY INVOKER SET search_path = pg_catalog, sf008
AS $fn$
BEGIN
  IF NOT EXISTS(
    SELECT 1 FROM sf008.leases
      WHERE scope_id = p_scope AND job_id = p_job
        AND holder_id = p_holder AND fencing_epoch = p_epoch
        AND expires_at > clock_timestamp()
  ) THEN RAISE EXCEPTION 'stale_fence'; END IF;
  RETURN true;
END;
$fn$;

REVOKE ALL ON ALL FUNCTIONS IN SCHEMA sf008 FROM PUBLIC;
GRANT EXECUTE ON FUNCTION sf008.advance(text,text,bigint,text,text,text,boolean)
  TO sf008_worker;
GRANT EXECUTE ON FUNCTION sf008.acquire_lease(text,text,text,integer)
  TO sf008_worker;
GRANT EXECUTE ON FUNCTION sf008.require_fence(text,text,text,bigint)
  TO sf008_worker;

-- Synthetic seeds; the worker cannot create jobs or leases.
INSERT INTO sf008.jobs(scope_id, job_id) VALUES
 ('internal_A','normal'), ('internal_A','rollback'),
 ('internal_A','race'), ('internal_A','lease_job'),
 ('internal_B','foreign');
INSERT INTO sf008.leases(scope_id, job_id) VALUES
 ('internal_A','lease_job'), ('internal_B','foreign');
COMMIT;
