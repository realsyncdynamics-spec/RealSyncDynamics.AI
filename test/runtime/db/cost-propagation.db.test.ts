/**
 * RFC-004 §5.1 — Cost propagation along causation-DAG (DB integration)
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

d('RFC-004 / propagate_cost_attribution (DB)', () => {
  let ctx: DbCtx | null = null;
  beforeEach(async () => { ctx = await openDb(); });
  afterEach(async () => { await closeDb(ctx); ctx = null; });

  it('walks a 3-event chain and sums cost_units along the path', async () => {
    const { tenantId, userId } = await createTenantWithMember(ctx!);

    const root = await insertEvent(ctx!, tenantId, {
      type: 'flow.started',
      payload: { cost_units: { total: 0.01 } },
    });
    const mid = await insertEvent(ctx!, tenantId, {
      type: 'ai.completion',
      causation_id: root.id,
      payload: { cost_units: { total: 0.05 } },
    });
    await insertEvent(ctx!, tenantId, {
      type: 'flow.completed',
      causation_id: mid.id,
      payload: { cost_units: { total: 0.02 } },
    });

    const r = await ctx!.withClaims({ sub: userId }, async () => {
      return ctx!.client.query<{
        event_id: string; depth: number;
        intrinsic: string; accumulated: string;
      }>(
        `SELECT * FROM public.propagate_cost_attribution($1::uuid, $2::uuid)
          ORDER BY depth`,
        [tenantId, root.id],
      );
    });
    expect(r.rows).toHaveLength(3);
    expect(Number(r.rows[0]!.accumulated)).toBeCloseTo(0.01, 6);
    expect(Number(r.rows[1]!.accumulated)).toBeCloseTo(0.06, 6);
    expect(Number(r.rows[2]!.accumulated)).toBeCloseTo(0.08, 6);
  });

  it('treats events without cost_units payload as intrinsic=0', async () => {
    const { tenantId, userId } = await createTenantWithMember(ctx!);

    const root = await insertEvent(ctx!, tenantId, {
      type: 'flow.no_cost',
      payload: {},
    });
    await insertEvent(ctx!, tenantId, {
      type: 'flow.no_cost_child',
      causation_id: root.id,
      payload: {},
    });

    const r = await ctx!.withClaims({ sub: userId }, async () => {
      return ctx!.client.query<{ accumulated: string }>(
        `SELECT accumulated FROM public.propagate_cost_attribution($1::uuid, $2::uuid)`,
        [tenantId, root.id],
      );
    });
    expect(r.rows.every((x) => Number(x.accumulated) === 0)).toBe(true);
  });

  it('rejects non-members', async () => {
    const { tenantId } = await createTenantWithMember(ctx!);
    const root = await insertEvent(ctx!, tenantId);

    const { rows: u } = await ctx!.client.query<{ id: string }>(
      `INSERT INTO auth.users(email) VALUES ('cost-out@x.de') RETURNING id`,
    );
    await expect(
      ctx!.withClaims({ sub: u[0]!.id }, async () => {
        await ctx!.client.query(
          `SELECT * FROM public.propagate_cost_attribution($1::uuid, $2::uuid)`,
          [tenantId, root.id],
        );
      }),
    ).rejects.toThrow(/forbidden/);
  });

  it('cross-tenant lookup returns empty (tenant_id filter in CTE)', async () => {
    const A = await createTenantWithMember(ctx!, { tenantName: 'A', userEmail: 'a@x.de' });
    const B = await createTenantWithMember(ctx!, { tenantName: 'B', userEmail: 'b@x.de' });

    const rootA = await insertEvent(ctx!, A.tenantId, {
      type: 'flow.cross',
      payload: { cost_units: { total: 0.99 } },
    });

    // Member of B requests with A's root_event_id
    const r = await ctx!.withClaims({ sub: B.userId }, async () => {
      return ctx!.client.query(
        `SELECT * FROM public.propagate_cost_attribution($1::uuid, $2::uuid)`,
        [B.tenantId, rootA.id],
      );
    });
    expect(r.rows).toEqual([]);
  });
});
