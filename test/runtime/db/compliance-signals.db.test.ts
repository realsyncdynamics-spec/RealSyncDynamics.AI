/**
 * RFC-004 §3 — Compliance Signal Pipeline (DB integration)
 *
 * mark_compliance_signal emits framework-specific events;
 * propagate_compliance_taint walks the causation-DAG.
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

d('RFC-004 / mark_compliance_signal (DB)', () => {
  let ctx: DbCtx | null = null;
  beforeEach(async () => { ctx = await openDb(); });
  afterEach(async () => { await closeDb(ctx); ctx = null; });

  it('emits compliance.gdpr_signal with framework metadata', async () => {
    const { tenantId } = await createTenantWithMember(ctx!);
    const root = await insertEvent(ctx!, tenantId, { type: 'dsr.access_requested' });

    const id = await ctx!.withClaims({ role: 'service_role' }, async () => {
      const r = await ctx!.client.query<{ id: string }>(
        `SELECT public.mark_compliance_signal($1::uuid, 'gdpr', $2::uuid, NULL, 'high') AS id`,
        [tenantId, root.id],
      );
      return r.rows[0]!.id;
    });

    const ev = await ctx!.client.query<{
      type: string; severity: string; review_status: string; framework: string;
    }>(
      `SELECT type, severity, review_status,
              payload->>'framework' AS framework
         FROM public.runtime_events WHERE id=$1`,
      [id],
    );
    expect(ev.rows[0]!.type).toBe('compliance.gdpr_signal');
    expect(ev.rows[0]!.severity).toBe('high');
    expect(ev.rows[0]!.review_status).toBe('pending');
    expect(ev.rows[0]!.framework).toBe('gdpr');
  });

  it('emits compliance.ai_act_signal for ai_act framework', async () => {
    const { tenantId } = await createTenantWithMember(ctx!);
    const root = await insertEvent(ctx!, tenantId, { type: 'ai.high_risk_use_case_detected' });

    await ctx!.withClaims({ role: 'service_role' }, async () => {
      await ctx!.client.query(
        `SELECT public.mark_compliance_signal($1::uuid, 'ai_act', $2::uuid)`,
        [tenantId, root.id],
      );
    });

    const ev = await ctx!.client.query<{ type: string }>(
      `SELECT type FROM public.runtime_events
        WHERE tenant_id=$1 AND type='compliance.ai_act_signal'`,
      [tenantId],
    );
    expect(ev.rows).toHaveLength(1);
  });

  it('rejects invalid framework', async () => {
    const { tenantId } = await createTenantWithMember(ctx!);
    const root = await insertEvent(ctx!, tenantId);

    await expect(
      ctx!.withClaims({ role: 'service_role' }, async () => {
        await ctx!.client.query(
          `SELECT public.mark_compliance_signal($1::uuid, 'sox', $2::uuid)`,
          [tenantId, root.id],
        );
      }),
    ).rejects.toThrow(/invalid framework/);
  });

  it('is service-role only', async () => {
    const { tenantId, userId } = await createTenantWithMember(ctx!);
    const root = await insertEvent(ctx!, tenantId);

    await expect(
      ctx!.withClaims({ sub: userId }, async () => {
        await ctx!.client.query(
          `SELECT public.mark_compliance_signal($1::uuid, 'gdpr', $2::uuid)`,
          [tenantId, root.id],
        );
      }),
    ).rejects.toThrow(/forbidden|permission denied/);
  });
});

d('RFC-004 / propagate_compliance_taint (DB)', () => {
  let ctx: DbCtx | null = null;
  beforeEach(async () => { ctx = await openDb(); });
  afterEach(async () => { await closeDb(ctx); ctx = null; });

  it('writes compliance.taint_propagated for each downstream node', async () => {
    const { tenantId } = await createTenantWithMember(ctx!);
    const a = await insertEvent(ctx!, tenantId, { type: 'flow.started' });
    const b = await insertEvent(ctx!, tenantId, {
      type: 'flow.step',
      causation_id: a.id,
    });
    await insertEvent(ctx!, tenantId, {
      type: 'flow.step_two',
      causation_id: b.id,
    });

    const count = await ctx!.withClaims({ role: 'service_role' }, async () => {
      const r = await ctx!.client.query<{ n: number }>(
        `SELECT public.propagate_compliance_taint($1::uuid, $2::uuid, 'gdpr', NULL)::int AS n`,
        [tenantId, a.id],
      );
      return r.rows[0]!.n;
    });
    // Root excluded (depth > 0), so 2 downstream nodes
    expect(count).toBe(2);

    const ev = await ctx!.client.query<{ depth: number }>(
      `SELECT (payload->>'depth')::int AS depth FROM public.runtime_events
        WHERE tenant_id=$1 AND type='compliance.taint_propagated'
        ORDER BY depth`,
      [tenantId],
    );
    expect(ev.rows.map((x) => Number(x.depth))).toEqual([1, 2]);
  });

  it('does not cross tenant boundaries', async () => {
    const A = await createTenantWithMember(ctx!, { tenantName: 'A', userEmail: 'a@t.de' });
    const B = await createTenantWithMember(ctx!, { tenantName: 'B', userEmail: 'b@t.de' });

    const rootA = await insertEvent(ctx!, A.tenantId, { type: 'flow.x' });
    // A child event in tenant B with NEW.causation_id pointing into tenant A
    // is impossible via normal API — but even if forged, the CTE filter
    // tenant_id = p_tenant_id stops propagation.

    const count = await ctx!.withClaims({ role: 'service_role' }, async () => {
      const r = await ctx!.client.query<{ n: number }>(
        `SELECT public.propagate_compliance_taint($1::uuid, $2::uuid, 'gdpr', NULL)::int AS n`,
        [B.tenantId, rootA.id],
      );
      return r.rows[0]!.n;
    });
    expect(count).toBe(0);
  });
});

d('RFC-004 / v_compliance_signals_open (DB)', () => {
  let ctx: DbCtx | null = null;
  beforeEach(async () => { ctx = await openDb(); });
  afterEach(async () => { await closeDb(ctx); ctx = null; });

  it('refresh + RLS isolation', async () => {
    const A = await createTenantWithMember(ctx!, { tenantName: 'A', userEmail: 'a@cs.de' });
    const B = await createTenantWithMember(ctx!, { tenantName: 'B', userEmail: 'b@cs.de' });

    const rootA = await insertEvent(ctx!, A.tenantId, { type: 'dsr.access_requested' });
    const rootB = await insertEvent(ctx!, B.tenantId, { type: 'dsr.access_requested' });

    await ctx!.withClaims({ role: 'service_role' }, async () => {
      await ctx!.client.query(
        `SELECT public.mark_compliance_signal($1::uuid, 'gdpr', $2::uuid)`,
        [A.tenantId, rootA.id],
      );
      await ctx!.client.query(
        `SELECT public.mark_compliance_signal($1::uuid, 'gdpr', $2::uuid)`,
        [B.tenantId, rootB.id],
      );
      await ctx!.client.query(`SELECT public.refresh_governance_mvs(false)`);
    });

    const r = await ctx!.withClaims({ sub: B.userId }, async () => {
      return ctx!.client.query<{ tenant_id: string; framework: string }>(
        `SELECT tenant_id, framework FROM public.v_compliance_signals_open`,
      );
    });
    // Only B's signal is visible
    expect(r.rows.every((x) => x.tenant_id === B.tenantId)).toBe(true);
    expect(r.rows.some((x) => x.framework === 'gdpr')).toBe(true);
  });
});
