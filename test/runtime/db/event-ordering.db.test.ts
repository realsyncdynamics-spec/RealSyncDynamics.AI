/**
 * SPEC-001 — Event Ordering (DB integration)
 *
 * tenant_seq must be gap-free per tenant. global_seq strictly monotone
 * runtime-wide. Concurrency test uses multiple parallel pg clients
 * (single test client + transaction wouldn't expose the advisory lock
 * behavior, because the lock is per-transaction).
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { Client } from 'pg';
import {
  closeDb,
  createTenantWithMember,
  getDbUrl,
  insertEvent,
  openDb,
  type DbCtx,
} from './db-helpers';

const skip = !getDbUrl();
const d = skip ? describe.skip : describe;

d('SPEC-001 / event ordering (DB)', () => {
  let ctx: DbCtx | null = null;
  beforeEach(async () => { ctx = await openDb(); });
  afterEach(async () => { await closeDb(ctx); ctx = null; });

  it('global_seq is strictly monotone across two tenants', async () => {
    const A = await createTenantWithMember(ctx!, { tenantName: 'A' });
    const B = await createTenantWithMember(ctx!, { tenantName: 'B' });

    const a1 = await insertEvent(ctx!, A.tenantId, { type: 'a.one' });
    const b1 = await insertEvent(ctx!, B.tenantId, { type: 'b.one' });
    const a2 = await insertEvent(ctx!, A.tenantId, { type: 'a.two' });
    const b2 = await insertEvent(ctx!, B.tenantId, { type: 'b.two' });

    const seqs = [a1, b1, a2, b2].map((e) => Number(e.global_seq));
    for (let i = 1; i < seqs.length; i++) {
      expect(seqs[i]).toBeGreaterThan(seqs[i - 1]!);
    }
  });

  it('tenant_seq starts at 1 and increments per tenant independently', async () => {
    const A = await createTenantWithMember(ctx!, { tenantName: 'A' });
    const B = await createTenantWithMember(ctx!, { tenantName: 'B' });

    const a1 = await insertEvent(ctx!, A.tenantId);
    const b1 = await insertEvent(ctx!, B.tenantId);
    const a2 = await insertEvent(ctx!, A.tenantId);
    const a3 = await insertEvent(ctx!, A.tenantId);
    const b2 = await insertEvent(ctx!, B.tenantId);

    expect(Number(a1.tenant_seq)).toBe(1);
    expect(Number(a2.tenant_seq)).toBe(2);
    expect(Number(a3.tenant_seq)).toBe(3);
    expect(Number(b1.tenant_seq)).toBe(1);
    expect(Number(b2.tenant_seq)).toBe(2);
  });

  it(
    'tenant_seq is gap-free under 20-way parallel inserts (advisory lock)',
    async () => {
      // Create the tenant inside the test transaction, but the parallel
      // inserts run on separate connections (committed) so they actually
      // contend for the advisory lock. We'll create a fresh tenant via
      // a dedicated committed connection to avoid the test transaction
      // hiding the row from the worker clients.
      const url = getDbUrl()!;
      const setup = new Client({ connectionString: url });
      await setup.connect();
      const { rows: tRows } = await setup.query<{ id: string }>(
        `INSERT INTO public.tenants(name) VALUES ($1) RETURNING id`,
        [`parallel-${Date.now()}`],
      );
      const tenantId = tRows[0]!.id;

      const N = 20;
      const workers = Array.from({ length: N }, async (_, i) => {
        const c = new Client({ connectionString: url });
        await c.connect();
        try {
          const { rows } = await c.query<{ tenant_seq: string }>(
            `INSERT INTO public.runtime_events
               (tenant_id, type, severity, source, review_status, payload)
             VALUES ($1, 'parallel.test', 'info', 'integration-test', 'auto', '{}'::jsonb)
             RETURNING tenant_seq`,
            [tenantId],
          );
          return Number(rows[0]!.tenant_seq);
        } finally {
          await c.end();
        }
      });

      const seqs = (await Promise.all(workers)).sort((a, b) => a - b);

      // Gap-free 1..N
      expect(seqs).toEqual(Array.from({ length: N }, (_, i) => i + 1));

      // No cleanup: the test DB is ephemeral; per-test transaction
      // ROLLBACK handles isolation for everything else. Tenant rows
      // committed by the setup client and the runtime_events rows
      // committed by workers stay until the DB is dropped.
      // (Note: cascading DELETE on public.tenants would fire the
      // append-only DELETE trigger on runtime_events and fail —
      // surfaced as Open Question for tenant offboarding design.)
      await setup.end();
    },
    30_000,
  );
});
