-- SF-003: ONLY for a disposable, local PostgreSQL test database.
-- NOT a Supabase migration. DO NOT execute against any existing RealSync DB.
-- The test runner checks both hostname and database name before loading this.
DROP SCHEMA IF EXISTS sf003_test CASCADE;
CREATE SCHEMA sf003_test;
REVOKE ALL ON SCHEMA sf003_test FROM PUBLIC;

DO $roles$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'sf003_operator_test') THEN
    CREATE ROLE sf003_operator_test NOLOGIN;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'sf003_untrusted_test') THEN
    CREATE ROLE sf003_untrusted_test NOLOGIN;
  END IF;
END
$roles$;

CREATE TABLE sf003_test.jobs (
  id uuid PRIMARY KEY,
  request_key text NOT NULL UNIQUE,
  fingerprint text NOT NULL,
  status text NOT NULL DEFAULT 'queued'
    CHECK (status IN ('queued', 'running', 'validating', 'blocked', 'draft_pr_ready', 'cancelled')),
  version bigint NOT NULL DEFAULT 0 CHECK (version >= 0),
  budget_cents bigint NOT NULL CHECK (budget_cents BETWEEN 0 AND 1000000),
  spent_cents bigint NOT NULL DEFAULT 0 CHECK (spent_cents >= 0 AND spent_cents <= budget_cents),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE TABLE sf003_test.leases (
  job_id uuid PRIMARY KEY REFERENCES sf003_test.jobs(id),
  worker_id text NOT NULL,
  epoch bigint NOT NULL CHECK (epoch > 0),
  expires_at timestamptz NOT NULL
);
CREATE TABLE sf003_test.events (
  event_id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  job_id uuid NOT NULL REFERENCES sf003_test.jobs(id),
  command_id text NOT NULL,
  job_version bigint NOT NULL,
  event_type text NOT NULL,
  evidence_sha256 text NOT NULL CHECK (evidence_sha256 ~ '^[a-f0-9]{64}$'),
  recorded_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  UNIQUE (job_id, job_version),
  UNIQUE (job_id, command_id)
);
CREATE TABLE sf003_test.receipts (
  job_id uuid NOT NULL REFERENCES sf003_test.jobs(id),
  command_id text NOT NULL,
  fingerprint text NOT NULL,
  result jsonb NOT NULL,
  PRIMARY KEY (job_id, command_id)
);

-- RLS is defense in depth; no clients receive write privileges.
ALTER TABLE sf003_test.jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE sf003_test.jobs FORCE ROW LEVEL SECURITY;
ALTER TABLE sf003_test.leases ENABLE ROW LEVEL SECURITY;
ALTER TABLE sf003_test.leases FORCE ROW LEVEL SECURITY;
ALTER TABLE sf003_test.events ENABLE ROW LEVEL SECURITY;
ALTER TABLE sf003_test.events FORCE ROW LEVEL SECURITY;
ALTER TABLE sf003_test.receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE sf003_test.receipts FORCE ROW LEVEL SECURITY;

REVOKE ALL ON ALL TABLES IN SCHEMA sf003_test FROM PUBLIC;
GRANT USAGE ON SCHEMA sf003_test TO sf003_operator_test, sf003_untrusted_test;
GRANT SELECT ON sf003_test.jobs TO sf003_operator_test, sf003_untrusted_test;
CREATE POLICY sf003_operator_read ON sf003_test.jobs
  FOR SELECT TO sf003_operator_test USING (true);
-- No policy for sf003_untrusted_test: table SELECT privilege alone cannot bypass RLS.

-- Even privileged test code may not accidentally mutate evidence history.
CREATE FUNCTION sf003_test.reject_event_mutation() RETURNS trigger
LANGUAGE plpgsql AS $fn$
BEGIN
  RAISE EXCEPTION 'sf003_immutable_event';
END
$fn$;
CREATE TRIGGER sf003_events_immutable
BEFORE UPDATE OR DELETE OR TRUNCATE ON sf003_test.events
FOR EACH STATEMENT EXECUTE FUNCTION sf003_test.reject_event_mutation();
