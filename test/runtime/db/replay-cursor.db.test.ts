/**
 * SPEC-001 — Replay Cursor (DB integration)
 *
 * runtime_events_advance_cursor must be monotone (no rewind) and
 * membership-gated. global_seq is the cursor basis.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
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

d('SPEC-001 / replay cursor (DB)', () => {
  let ctx: DbCtx | null = null;
  beforeEach(async () => { ctx = await openDb(); });
  afterEach(async () => { await closeDb(ctx); ctx = null; });

  it('first advance creates a cursor row', async () => {
    const { tenantId, userId } = await createTenantWithMember(ctx!);
    const a = await insertEvent(ctx!, tenantId);

    const result = await ctx!.withClaims({ sub: userId }, async () => {
      return ctx!.client.query<{ advanced: boolean }>(
        `SELECT public.runtime_events_advance_cursor(
            $1::uuid, 'test-consumer', $2::bigint, '1.0', 1
         ) AS advanced`,
        [tenantId, a.global_seq],
      );
    });
    expect(result.rows[0]!.advanced).toBe(true);

    const r = await ctx!.client.query(
      `SELECT last_global_seq::bigint::int AS seq, events_consumed::int AS consumed
         FROM public.runtime_event_cursors
        WHERE tenant_id=$1 AND consumer='test-consumer'`,
      [tenantId],
    );
    expect(Number(r.rows[0]!.seq)).toBe(Number(a.global_seq));
    expect(r.rows[0]!.consumed).toBe(1);
  });

  it('advance with strictly greater global_seq returns true and updates row', async () => {
    const { tenantId, userId } = await createTenantWithMember(ctx!);
    const a = await insertEvent(ctx!, tenantId);
    const b = await insertEvent(ctx!, tenantId);

    await ctx!.withClaims({ sub: userId }, async () => {
      await ctx!.client.query(
        `SELECT public.runtime_events_advance_cursor($1::uuid, 'c1', $2::bigint, '1.0', 1)`,
        [tenantId, a.global_seq],
      );
      const r2 = await ctx!.client.query<{ advanced: boolean }>(
        `SELECT public.runtime_events_advance_cursor($1::uuid, 'c1', $2::bigint, '1.0', 1) AS advanced`,
        [tenantId, b.global_seq],
      );
      expect(r2.rows[0]!.advanced).toBe(true);
    });

    const r = await ctx!.client.query<{ seq: string; consumed: number }>(
      `SELECT last_global_seq AS seq, events_consumed::int AS consumed
         FROM public.runtime_event_cursors
        WHERE tenant_id=$1 AND consumer='c1'`,
      [tenantId],
    );
    expect(Number(r.rows[0]!.seq)).toBe(Number(b.global_seq));
    expect(r.rows[0]!.consumed).toBe(2);
  });

  it('advance with smaller global_seq returns false (no rewind)', async () => {
    const { tenantId, userId } = await createTenantWithMember(ctx!);
    const a = await insertEvent(ctx!, tenantId);
    const b = await insertEvent(ctx!, tenantId);

    await ctx!.withClaims({ sub: userId }, async () => {
      await ctx!.client.query(
        `SELECT public.runtime_events_advance_cursor($1::uuid, 'c2', $2::bigint, '1.0', 1)`,
        [tenantId, b.global_seq],
      );
      const rewind = await ctx!.client.query<{ advanced: boolean }>(
        `SELECT public.runtime_events_advance_cursor($1::uuid, 'c2', $2::bigint, '1.0', 1) AS advanced`,
        [tenantId, a.global_seq],
      );
      expect(rewind.rows[0]!.advanced).toBe(false);
    });

    const r = await ctx!.client.query<{ seq: string }>(
      `SELECT last_global_seq AS seq
         FROM public.runtime_event_cursors
        WHERE tenant_id=$1 AND consumer='c2'`,
      [tenantId],
    );
    // Stays at b — not rewound to a
    expect(Number(r.rows[0]!.seq)).toBe(Number(b.global_seq));
  });

  it('advance rejects callers without tenant membership', async () => {
    const { tenantId } = await createTenantWithMember(ctx!);
    const a = await insertEvent(ctx!, tenantId);

    const { rows: u } = await ctx!.client.query<{ id: string }>(
      `INSERT INTO auth.users(email) VALUES ('cursor-outsider@example.com') RETURNING id`,
    );
    const outsiderId = u[0]!.id;

    await expect(
      ctx!.withClaims({ sub: outsiderId }, async () => {
        await ctx!.client.query(
          `SELECT public.runtime_events_advance_cursor($1::uuid, 'c3', $2::bigint, '1.0', 1)`,
          [tenantId, a.global_seq],
        );
      }),
    ).rejects.toThrow(/forbidden/);
  });

  it('two consumers per tenant track independently', async () => {
    const { tenantId, userId } = await createTenantWithMember(ctx!);
    const a = await insertEvent(ctx!, tenantId);
    const b = await insertEvent(ctx!, tenantId);

    await ctx!.withClaims({ sub: userId }, async () => {
      await ctx!.client.query(
        `SELECT public.runtime_events_advance_cursor($1::uuid, 'fast', $2::bigint, '1.0', 1)`,
        [tenantId, b.global_seq],
      );
      await ctx!.client.query(
        `SELECT public.runtime_events_advance_cursor($1::uuid, 'slow', $2::bigint, '1.0', 1)`,
        [tenantId, a.global_seq],
      );
    });

    const r = await ctx!.client.query<{ consumer: string; seq: string }>(
      `SELECT consumer, last_global_seq AS seq
         FROM public.runtime_event_cursors
        WHERE tenant_id=$1
        ORDER BY consumer`,
      [tenantId],
    );
    expect(r.rows).toHaveLength(2);
    const m = Object.fromEntries(r.rows.map((x) => [x.consumer, Number(x.seq)]));
    expect(m.fast).toBe(Number(b.global_seq));
    expect(m.slow).toBe(Number(a.global_seq));
  });
});
