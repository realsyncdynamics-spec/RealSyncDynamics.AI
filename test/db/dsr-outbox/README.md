# DSR Outbox – P0 Review Candidate

**Status:** Stacked on PR #2362; SQL in this directory is **NOT** a production migration. The published Edge Function does not use it.

## Scope

1. `intake.sql` (PR #2362): stores `dsr_requests` and durable `dsr_outbox` in one transaction, idempotent by tenant + operation ID for the same actor.
2. `consumer.sql` (PR #2363): `dsr_outbox_claim` leases tasks with `SKIP LOCKED`; `dsr_outbox_fail` schedules retries or marks dead letter; `dsr_outbox_complete` commits governance admin log, runtime evidence and queue ACK atomically.
3. `consumer-acceptance.mjs`: uses a local throwaway PostgreSQL database and a synthetic schema; GitHub Actions runs it against a PostgreSQL 16 service.

## Run only in an isolated environment

```bash
# Requires repo npm dependencies and disposable LOCAL PostgreSQL database.
TEST_DB_URL=postgresql://postgres:postgres@127.0.0.1:5432/postgres \
  node test/db/dsr-outbox/consumer-acceptance.mjs
```

**Destructive test warning:** the runner drops the `public` schema of the specified database, then constructs synthetic tables. Only run against a fresh, disposable database. The test enforces a loopback hostname but cannot distinguish a personal local DB from a throwaway DB.

## Verified invariants (synthetic PostgreSQL model)

- Regular users cannot call consumer RPCs or read outbox directly.
- Concurrent claims return exactly one lease for each ready task.
- Missing HMAC subject reference/mapping leaves a durable pending/retry task.
- Expired leases fence stale workers.
- Simulated `runtime_events` failure rolls back admin log, erasure marker and ACK.
- One completed task results in one audit row and one evidence row; retry after ACK is rejected.
- Exhausted abandoned tasks become visible `failed` entries.

## Not verified and still blocking release

- Real Supabase migrations, partitioned `runtime_events`, hash-chain triggers and RLS policy interactions.
- Authentication and tenant RBAC across the actual Edge Functions; service-only SQL grants are not an Edge JWT test.
- The producer currently uses **only** `dsr.created`; `update/assign/close` are not routed to the outbox.
- A linked HMAC `subject_ref` and matching `subject_ref_mappings` must be provisioned before `dsr_outbox_complete` can succeed. The existing `ensureSubjectRef` path is not yet wired to `dsr_intake`.
- The database consumer is *not scheduled*; a separately authorized worker must call claim/fail/complete and expose dead-letter monitoring.
- Producer idempotency checks the same actor and operation ID, **not** the incoming payload fingerprint. Replaying an operation ID with changed fields currently returns the first request; add payload equality or reject mismatches.
- Idempotency for erasure execution also requires the real `process_subject_erasure_queue()` and `dsr_finalize_erased_requests()` tests, including retention periods.
- Outbox RLS allows no direct client read. A tenant-scoped, read-only `evidence_status` view/API is still required for the dashboard.

## Release sequence

Review against `docs/infra/migration-drift.md`; bootstrap real migrations in an isolated Supabase-compatible database; test 401/403, RLS, hash chain, concurrent retries and retention; connect authenticated Edge writes and service-only consumer; expose pending/retry/failed metrics; deploy only after a separate production cutover approval and rollback plan. Never merge the SQL files into `supabase/migrations/` by renaming alone.
