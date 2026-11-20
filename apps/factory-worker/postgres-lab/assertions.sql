-- SF-008: PostgreSQL assertions in disposable sf008_test ONLY.
\set ON_ERROR_STOP on

SET ROLE sf008_worker;
DO $t$
DECLARE
  outcome text;
  visible_foreign bigint;
  rejected boolean;
BEGIN
  SELECT sf008.advance('internal_A','normal',0,'key_normal',
     repeat('a',64),'running',false) INTO outcome;
  IF outcome <> 'committed' THEN RAISE EXCEPTION 'commit_not_observed'; END IF;

  SELECT sf008.advance('internal_A','normal',0,'key_normal',
     repeat('a',64),'running',false) INTO outcome;
  IF outcome <> 'replay' THEN RAISE EXCEPTION 'idempotent_replay_failed'; END IF;

  rejected := false;
  BEGIN
    PERFORM sf008.advance('internal_A','normal',0,'key_normal',
      repeat('b',64),'running',false);
  EXCEPTION WHEN OTHERS THEN
    rejected := SQLERRM = 'idempotency_conflict';
  END;
  IF NOT rejected THEN RAISE EXCEPTION 'payload_conflict_not_rejected'; END IF;

  rejected := false;
  BEGIN
    PERFORM sf008.advance('internal_A','normal',0,'key_other',
      repeat('c',64),'testing',false);
  EXCEPTION WHEN OTHERS THEN
    rejected := SQLERRM = 'version_conflict';
  END;
  IF NOT rejected THEN RAISE EXCEPTION 'version_conflict_not_rejected'; END IF;

  rejected := false;
  BEGIN
    PERFORM sf008.advance('internal_A','rollback',0,'key_rollback',
      repeat('d',64),'running',true);
  EXCEPTION WHEN OTHERS THEN
    rejected := SQLERRM = 'forced_rollback';
  END;
  IF NOT rejected THEN RAISE EXCEPTION 'forced_rollback_not_triggered'; END IF;

  -- The real PostgreSQL transaction must roll back ALL five objects together.
  IF (SELECT version FROM sf008.jobs WHERE scope_id='internal_A' AND job_id='rollback') <> 0
    OR EXISTS(SELECT 1 FROM sf008.events WHERE job_id='rollback')
    OR EXISTS(SELECT 1 FROM sf008.receipts WHERE job_id='rollback')
    OR EXISTS(SELECT 1 FROM sf008.outbox WHERE job_id='rollback')
    OR EXISTS(SELECT 1 FROM sf008.cost_ledger WHERE job_id='rollback') THEN
    RAISE EXCEPTION 'atomic_rollback_failed';
  END IF;

  IF (SELECT version FROM sf008.jobs WHERE scope_id='internal_A' AND job_id='normal') <> 1
    OR (SELECT count(*) FROM sf008.events WHERE job_id='normal') <> 1
    OR (SELECT count(*) FROM sf008.receipts WHERE job_id='normal') <> 1
    OR (SELECT count(*) FROM sf008.outbox WHERE job_id='normal') <> 1
    OR (SELECT count(*) FROM sf008.cost_ledger WHERE job_id='normal') <> 1 THEN
    RAISE EXCEPTION 'atomic_commit_artifacts_missing';
  END IF;

  SELECT count(*) INTO visible_foreign FROM sf008.jobs WHERE scope_id='internal_B';
  IF visible_foreign <> 0 THEN RAISE EXCEPTION 'cross_scope_read_leaked'; END IF;

  rejected := false;
  BEGIN
    PERFORM sf008.advance('internal_B','foreign',0,'key_foreign',
      repeat('e',64),'running',false);
  EXCEPTION WHEN OTHERS THEN
    rejected := SQLERRM = 'version_conflict';
  END;
  IF NOT rejected THEN RAISE EXCEPTION 'cross_scope_mutation_allowed'; END IF;

  rejected := false;
  BEGIN
    INSERT INTO sf008.events(scope_id,job_id,seq,to_state,payload_hash)
      VALUES ('internal_B','foreign',1,'running',repeat('f',64));
  EXCEPTION WHEN OTHERS THEN rejected := true;
  END;
  IF NOT rejected THEN RAISE EXCEPTION 'cross_scope_insert_allowed'; END IF;

  rejected := false;
  BEGIN
    UPDATE sf008.events SET to_state='tampered' WHERE scope_id='internal_A' AND job_id='normal';
  EXCEPTION WHEN OTHERS THEN rejected := true;
  END;
  IF NOT rejected THEN RAISE EXCEPTION 'event_mutation_allowed'; END IF;
END;
$t$;

DO $t$
DECLARE
  epoch bigint;
  rejected boolean;
BEGIN
  SELECT sf008.acquire_lease('internal_A','lease_job','worker_a',60) INTO epoch;
  IF epoch <> 1 THEN RAISE EXCEPTION 'first_epoch_not_one'; END IF;

  rejected := false;
  BEGIN
    PERFORM sf008.acquire_lease('internal_A','lease_job','worker_b',60);
  EXCEPTION WHEN OTHERS THEN
    rejected := SQLERRM = 'lease_busy_or_missing';
  END;
  IF NOT rejected THEN RAISE EXCEPTION 'parallel_lease_not_blocked'; END IF;

  IF sf008.require_fence('internal_A','lease_job','worker_a',1) IS DISTINCT FROM true
    THEN RAISE EXCEPTION 'valid_fence_rejected'; END IF;
END;
$t$;
RESET ROLE;

-- Simulate expiry ONLY as the disposable test database administrator.
UPDATE sf008.leases
  SET expires_at = clock_timestamp() - interval '1 second'
  WHERE scope_id='internal_A' AND job_id='lease_job';

SET ROLE sf008_worker;
DO $t$
DECLARE
  epoch bigint;
  rejected boolean;
BEGIN
  SELECT sf008.acquire_lease('internal_A','lease_job','worker_b',60) INTO epoch;
  IF epoch <> 2 THEN RAISE EXCEPTION 'fencing_epoch_not_monotonic'; END IF;

  rejected := false;
  BEGIN
    PERFORM sf008.require_fence('internal_A','lease_job','worker_a',1);
  EXCEPTION WHEN OTHERS THEN
    rejected := SQLERRM = 'stale_fence';
  END;
  IF NOT rejected THEN RAISE EXCEPTION 'old_fence_allowed'; END IF;

  IF sf008.require_fence('internal_A','lease_job','worker_b',2) IS DISTINCT FROM true
    THEN RAISE EXCEPTION 'current_fence_rejected'; END IF;
END;
$t$;
RESET ROLE;

-- Administrative assertion that foreign-scope data remained unchanged.
DO $t$
BEGIN
  IF (SELECT version FROM sf008.jobs WHERE scope_id='internal_B' AND job_id='foreign') <> 0
     OR EXISTS (SELECT 1 FROM sf008.events WHERE scope_id='internal_B') THEN
    RAISE EXCEPTION 'foreign_scope_modified';
  END IF;
END;
$t$;

SELECT 'sf008_assertions_ok' AS result;
