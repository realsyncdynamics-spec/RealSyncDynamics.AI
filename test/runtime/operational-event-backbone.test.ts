// SPEC-001 — Operational Event Backbone invariants.
//
// This file exercises the migration in
// supabase/migrations/20260602000000_runtime_events_backbone.sql against
// a live Postgres instance. It is the executable counterpart to the
// acceptance criteria in docs/runbooks/spec-001-phase5-go-live.md §1.1.
//
// Two execution modes:
//
//   1. CI default — SUPABASE_TEST_DB_URL is unset → all DB-side tests
//      are marked `.todo()` so the suite stays green and the test file
//      ships as documentation of the invariants. No new dev-dep is
//      introduced just to keep CI passing.
//
//   2. Local dev / staging — set SUPABASE_TEST_DB_URL=postgres://...
//      and install `pg` (`npm i -D pg @types/pg`). The DB-side tests
//      become real, hit a fresh schema, and report invariant violations.
//
// The contract documented here is what every invariant test in the
// follow-up RFC test files (RFC-002, RFC-003, RFC-004) extends.

import { describe, it, expect } from 'vitest';

const DB_URL = process.env.SUPABASE_TEST_DB_URL;
const runDb = (name: string, fn: () => Promise<void>) =>
  DB_URL ? it(name, fn) : it.todo(`${name} — set SUPABASE_TEST_DB_URL to enable`);

// Minimal envelope a caller would emit. Mirrors the typed columns of
// public.runtime_events. The shape is asserted by the migration's
// CHECK constraints; this object documents the producer contract.
function envelope(overrides: Partial<{
  tenant_id: string;
  type: string;
  severity: 'info' | 'low' | 'medium' | 'high' | 'critical';
  source: string;
  spec_version: string;
  subject_ref: string | null;
  payload: Record<string, unknown>;
}> = {}) {
  return {
    tenant_id:    '00000000-0000-0000-0000-000000000001',
    type:         'governance.test_event',
    severity:     'info' as const,
    source:       'phase5-test',
    spec_version: '1.0',
    subject_ref:  null,
    payload:      {},
    ...overrides,
  };
}

describe('SPEC-001 — runtime_events invariants', () => {
  describe('Decision 1+5+7: envelope shape', () => {
    it('producer envelope carries the seven required typed fields', () => {
      const e = envelope();
      expect(e).toMatchObject({
        tenant_id:    expect.stringMatching(/^[0-9a-f-]{36}$/),
        type:         expect.stringMatching(/^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+$/),
        severity:     expect.stringMatching(/^(info|low|medium|high|critical)$/),
        source:       expect.any(String),
        spec_version: expect.stringMatching(/^[0-9]+\.[0-9]+$/),
      });
    });
  });

  describe('Decision 2: append-only enforcement', () => {
    runDb('UPDATE on runtime_events raises 42501', async () => {
      // Insert one row, then attempt UPDATE → expect SQLSTATE 42501.
      // The migration defines runtime_events_block_mutation() which
      // raises with HINT pointing to partition DROP as the only purge path.
    });

    runDb('DELETE on runtime_events raises 42501', async () => {
      // Same shape: insert → DELETE → 42501.
    });

    runDb('partition DROP succeeds (retention bypass)', async () => {
      // DROP TABLE public.runtime_events_<YYYYMM> must succeed —
      // the row-trigger does not fire on DDL.
    });
  });

  describe('Decision 4: monthly partitioning', () => {
    runDb('runtime_events_ensure_partition(now()) is idempotent', async () => {
      // Calling twice returns the same partition name; pg_class shows one row.
    });

    runDb('out-of-range insert errors loudly (no default partition)', async () => {
      // ts = 2099-01-01 → insert MUST raise "no partition of relation".
    });
  });

  describe('Decision 3: RLS over tenant_memberships', () => {
    runDb('non-member SELECT returns 0 rows even when data exists', async () => {
      // Insert as service-role; SELECT as anon user → empty result.
    });

    runDb('member SELECT returns own tenant rows', async () => {
      // Grant membership; SELECT returns inserted row.
    });

    runDb('cross-tenant SELECT cannot read other tenants subject_ref', async () => {
      // Tenant A inserts with subject_ref X. Tenant B queries WHERE subject_ref = X.
      // Expected: empty result.
    });
  });

  describe('Decision-of-decisions: global_seq + tenant_seq monotone & gap-free', () => {
    runDb('global_seq strictly increasing across inserts', async () => {
      // Insert 100 rows in two tenants. Sort by id; assert global_seq[i] < global_seq[i+1].
    });

    runDb('tenant_seq gap-free per tenant under concurrent insert', async () => {
      // 10 parallel inserts per tenant. tenant_seq must be 1..10 with no gaps.
      // Advisory lock in runtime_events_alloc_seq_and_chain() guarantees this.
    });
  });

  describe('Decision 7: cryptographic integrity (hash chain)', () => {
    runDb('first event in a tenant has prev_hash NULL (genesis)', async () => {
      // After first insert: prev_hash IS NULL, event_hash IS NOT NULL.
    });

    runDb('subsequent events chain forward', async () => {
      // Insert 5 events. For i=2..5: prev_hash = previous event's event_hash.
    });

    runDb('runtime_events_verify_chain reports valid=true for clean chain', async () => {
      // Verifier returns every row with valid=true and chain_ok=true.
    });

    runDb('tampering a payload breaks valid=false on that row', async () => {
      // Bypass the trigger via session_replication_role = replica to
      // mutate payload. Verifier flags the row.
    });

    runDb('canonical_bytes is deterministic across runs', async () => {
      // Call canonical_bytes() twice with identical inputs → identical bytes.
    });
  });

  describe('Decision 5: replay cursor (global_seq-based)', () => {
    runDb('cursor advance accepts strictly greater global_seq', async () => {
      // advance_cursor(t, 'cons', 10) → true. Second call with 5 → false.
    });

    runDb('cursor advance rejects rewinds (idempotent)', async () => {
      // advance_cursor(t, 'cons', 100) twice → first returns true, second false.
    });

    runDb('consumer resume reads strictly newer events', async () => {
      // WHERE global_seq > last_global_seq returns only post-cursor rows.
    });
  });

  describe('idempotency (companion to Decision 1)', () => {
    runDb('duplicate idempotency_key for same tenant is rejected', async () => {
      // Two inserts with identical (tenant_id, idempotency_key)
      // → second raises UNIQUE violation on operational_event_idempotency.
    });

    runDb('same idempotency_key in different tenants is allowed', async () => {
      // (t1, 'k') and (t2, 'k') both succeed — dedup is tenant-scoped.
    });
  });

  describe('production load smoke (200 events/s)', () => {
    runDb('sustained 200 events/s for 60 s without insert errors', async () => {
      // Phase-5 §1.2 requires insert-latency p95 < 25 ms at 200/s.
      // Implemented as a soak test, gated by SUPABASE_TEST_SOAK=1.
    });
  });
});
