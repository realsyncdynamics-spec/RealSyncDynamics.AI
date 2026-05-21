/**
 * SPEC-001 — Event Ordering
 *
 * global_seq ist runtime-weit monoton; tenant_seq ist pro Tenant
 * monoton und gap-frei (advisory-lock im Trigger). Hier sind die
 * Vertrags-Tests; die echten Concurrency-Tests laufen gegen Staging.
 */
import { describe, it } from 'vitest';

describe('SPEC-001 / event ordering — contract', () => {
  it.todo(
    'global_seq is strictly monotone across all inserts in any tenant',
  );

  it.todo(
    'tenant_seq starts at 1 for the first event of a tenant',
  );

  it.todo(
    'tenant_seq is gap-free per tenant under 100-way parallel inserts',
  );

  it.todo(
    'tenant_seq across two tenants is independently counted (no shared sequence)',
  );

  it.todo(
    'replay cursor advance with global_seq smaller than stored returns false',
  );

  it.todo(
    'replay cursor advance with strictly greater global_seq returns true and updates row',
  );

  it.todo('replay cursor rejects callers without tenant membership');

  it.todo(
    'partition routing: insert with ts in next month lands in next partition',
  );

  it.todo(
    'partition prepare helper creates partition for arbitrary future month',
  );
});
