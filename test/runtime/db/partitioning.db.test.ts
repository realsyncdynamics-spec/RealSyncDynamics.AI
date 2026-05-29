/**
 * SPEC-001 — Partitioning (DB integration)
 *
 * RANGE-on-ts monthly partitions. Bootstrap creates -1..+6 months.
 * Inserts route to the correct partition; the helper RPC can be called
 * to extend further into the future.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  closeDb,
  createTenantWithMember,
  getDbUrl,
  openDb,
  type DbCtx,
} from './db-helpers';

const skip = !getDbUrl();
const d = skip ? describe.skip : describe;

d('SPEC-001 / monthly partitioning (DB)', () => {
  let ctx: DbCtx | null = null;
  beforeEach(async () => { ctx = await openDb(); });
  afterEach(async () => { await closeDb(ctx); ctx = null; });

  it('insert with ts in the current month lands in the current-month partition', async () => {
    const { tenantId } = await createTenantWithMember(ctx!);

    const r = await ctx!.client.query<{
      tableoid: string;
      relname: string;
    }>(`
        WITH inserted AS (
            INSERT INTO public.runtime_events
                (tenant_id, type, severity, source, review_status, payload, ts)
            VALUES ($1, 'part.now', 'info', 'integration-test', 'auto',
                    '{}'::jsonb, now())
            RETURNING tableoid
        )
        SELECT i.tableoid::regclass::text AS relname
          FROM inserted i
    `, [tenantId]);

    const month = new Date().toISOString().slice(0, 7).replace('-', '');
    expect(r.rows[0]!.relname).toContain(`runtime_events_${month}`);
  });

  it('insert with ts in the next month lands in the next-month partition', async () => {
    const { tenantId } = await createTenantWithMember(ctx!);

    const now = new Date();
    const next = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 15));
    const nextMonth = next.toISOString().slice(0, 7).replace('-', '');

    const r = await ctx!.client.query<{ relname: string }>(`
        WITH inserted AS (
            INSERT INTO public.runtime_events
                (tenant_id, type, severity, source, review_status, payload, ts)
            VALUES ($1, 'part.next', 'info', 'integration-test', 'auto',
                    '{}'::jsonb, $2::timestamptz)
            RETURNING tableoid
        )
        SELECT i.tableoid::regclass::text AS relname FROM inserted i
    `, [tenantId, next.toISOString()]);

    expect(r.rows[0]!.relname).toContain(`runtime_events_${nextMonth}`);
  });

  it('ensure_partition is idempotent for an existing month', async () => {
    const r = await ctx!.client.query<{ name: string }>(
      `SELECT public.runtime_events_ensure_partition(now()) AS name`,
    );
    expect(r.rows[0]!.name).toMatch(/^runtime_events_\d{6}$/);

    // Second call same month should not raise
    await ctx!.client.query(
      `SELECT public.runtime_events_ensure_partition(now())`,
    );
  });

  it('ensure_partition creates a partition 12 months out', async () => {
    const future = new Date();
    future.setUTCMonth(future.getUTCMonth() + 12);

    const r = await ctx!.client.query<{ name: string }>(
      `SELECT public.runtime_events_ensure_partition($1::timestamptz) AS name`,
      [future.toISOString()],
    );

    const expectedSuffix = future.toISOString().slice(0, 7).replace('-', '');
    expect(r.rows[0]!.name).toBe(`runtime_events_${expectedSuffix}`);

    // Verify the partition exists in pg_class
    const check = await ctx!.client.query<{ relname: string }>(
      `SELECT c.relname
         FROM pg_class c
         JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public'
          AND c.relname = $1`,
      [`runtime_events_${expectedSuffix}`],
    );
    expect(check.rows).toHaveLength(1);
  });
});
