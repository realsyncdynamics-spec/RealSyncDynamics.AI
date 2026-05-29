/**
 * SPEC-001 — Append-only + idempotency contract
 *
 * UPDATE/DELETE raise 42501, retention purges drop whole partitions
 * (bypass triggers by design).
 */
import { describe, it } from 'vitest';

describe('SPEC-001 / append-only enforcement', () => {
  it.todo('UPDATE on runtime_events raises 42501 even as service_role');
  it.todo('DELETE on runtime_events raises 42501 even as service_role');
  it.todo(
    'DROP PARTITION succeeds (bypasses row triggers) for retention purges',
  );
  it.todo('REVOKE UPDATE/DELETE on runtime_events from PUBLIC is active');
});

describe('SPEC-001 / idempotency keys (advisory)', () => {
  // SPEC-001 does not enforce uniqueness on idempotency_key within
  // runtime_events itself (partition-key requirement would weaken dedup
  // to per-month). Producers use operational_event_idempotency-style
  // tables; the runtime_events table only carries the key as a tag.
  it.todo(
    'producer-side dedup table rejects second insert with same (tenant, key)',
  );
});
