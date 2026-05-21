/**
 * RFC-004 Part C — RACPO + Quadrant + change emitter (DB integration)
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

async function settleCost(
  ctx: DbCtx,
  tenantId: string,
  flowRef: string,
  amountUsd: number,
): Promise<void> {
  await ctx.client.query(
    `INSERT INTO public.tenant_cost_ledger
       (tenant_id, cost_kind, units, unit_price_usd, flow_ref)
     VALUES ($1, 'llm_input', $2::numeric, 1.0, $3)`,
    [tenantId, amountUsd, flowRef],
  );
}

d('RFC-004 / compute_racpo (DB)', () => {
  let ctx: DbCtx | null = null;
  beforeEach(async () => { ctx = await openDb(); });
  afterEach(async () => { await closeDb(ctx); ctx = null; });

  it('returns raw cost when risk and pressure are 0', async () => {
    const { tenantId, userId } = await createTenantWithMember(ctx!);
    await settleCost(ctx!, tenantId, 'flow-clean', 0.50);
    // Two completions of flow-clean
    await insertEvent(ctx!, tenantId, {
      type: 'outcome.completed',
      payload: { flow_ref: 'flow-clean' },
    });
    await insertEvent(ctx!, tenantId, {
      type: 'outcome.completed',
      payload: { flow_ref: 'flow-clean' },
    });

    const r = await ctx!.withClaims({ sub: userId }, async () => {
      return ctx!.client.query<{
        raw_cost_per_completed: string; racpo: string;
        tenant_risk_score: string; incident_pressure: string;
      }>(
        `SELECT * FROM public.compute_racpo($1::uuid, 'flow-clean')`,
        [tenantId],
      );
    });
    expect(Number(r.rows[0]!.raw_cost_per_completed)).toBeCloseTo(0.25, 6);
    expect(Number(r.rows[0]!.tenant_risk_score)).toBe(0);
    expect(Number(r.rows[0]!.incident_pressure)).toBe(0);
    expect(Number(r.rows[0]!.racpo)).toBeCloseTo(0.25, 6);
  });

  it('amplifies cost with risk × pressure multipliers', async () => {
    const { tenantId, userId } = await createTenantWithMember(ctx!);

    await settleCost(ctx!, tenantId, 'flow-risky', 1.0);
    await insertEvent(ctx!, tenantId, {
      type: 'outcome.completed',
      payload: { flow_ref: 'flow-risky' },
    });

    // Drive tenant_risk_score: 1 critical incident → component=25, risk=7.5
    await insertEvent(ctx!, tenantId, {
      type: 'incident.opened',
      severity: 'critical',
    });
    // Drive incident_pressure for this flow: 1 critical incident with
    // flow_ref payload → pressure = 25
    await insertEvent(ctx!, tenantId, {
      type: 'incident.opened',
      severity: 'critical',
      payload: { flow_ref: 'flow-risky' },
    });

    const r = await ctx!.withClaims({ sub: userId }, async () => {
      return ctx!.client.query<{
        raw_cost_per_completed: string;
        tenant_risk_score: string;
        incident_pressure: string;
        racpo: string;
      }>(
        `SELECT * FROM public.compute_racpo($1::uuid, 'flow-risky')`,
        [tenantId],
      );
    });
    // raw = 1.0
    // risk = 0.30 × (25 + 25) = 15 → 0.30 × 50 = 15 (two incidents at critical)
    // Actually: incidents are global → SUM over them, capped at 100.
    //   2 × 25 = 50 → component=50 → tenant_risk=15
    // pressure = 25 (only the one with flow_ref payload)
    // racpo = 1 × (1+0.15) × (1+0.25) = 1.4375
    expect(Number(r.rows[0]!.raw_cost_per_completed)).toBe(1);
    expect(Number(r.rows[0]!.tenant_risk_score)).toBeCloseTo(15, 1);
    expect(Number(r.rows[0]!.incident_pressure)).toBe(25);
    expect(Number(r.rows[0]!.racpo)).toBeCloseTo(1.4375, 4);
  });
});

d('RFC-004 / compute_tenant_quadrant (DB)', () => {
  let ctx: DbCtx | null = null;
  beforeEach(async () => { ctx = await openDb(); });
  afterEach(async () => { await closeDb(ctx); ctx = null; });

  it('empty tenant → reserved_capacity', async () => {
    const { tenantId, userId } = await createTenantWithMember(ctx!);
    const r = await ctx!.withClaims({ sub: userId }, async () => {
      return ctx!.client.query<{ quadrant: string }>(
        `SELECT * FROM public.compute_tenant_quadrant($1::uuid)`,
        [tenantId],
      );
    });
    expect(r.rows[0]!.quadrant).toBe('reserved_capacity');
  });

  it('high-severity incidents + zero spend → investigate', async () => {
    const { tenantId, userId } = await createTenantWithMember(ctx!);
    // 3 critical incidents → component=75, tenant_risk = 22.5 — below 50.
    // Bump higher: 5 critical → component capped at 100 wait, 5 × 25 = 125, capped to 100, risk = 30.
    // To exceed 50 with the simplified 2-component formula:
    //   tenant_risk = 0.30 × consent + 0.30 × incident
    //   need 50 / 0.30 = 167 across the two components combined.
    // Use consent: 1 critical pre_consent → 5*1 + 0.5*1 = 5.5
    //   need many critical events for high consent component.
    //
    // Easier: 6 consent_regression + 4 critical incidents:
    //   consent = min(100, 6*5 + 6*0.5) = 33
    //   incident = 4 × 25 = 100
    //   risk = 0.30 × 33 + 0.30 × 100 = 9.9 + 30 = 39.9 — still under.
    //
    // To force risk >= 50, push incident to 100 and consent above 67:
    //   need consent_component = 67 → ~13 high+0.5 = 13×5 + 13×0.5 = 71.5 OK
    //   risk = 0.30 × 71.5 + 0.30 × 100 = 21.45 + 30 = 51.45 ✓
    for (let i = 0; i < 13; i++) {
      await insertEvent(ctx!, tenantId, {
        type: 'tracker.pre_consent_detected',
        severity: 'high',
      });
    }
    for (let i = 0; i < 4; i++) {
      await insertEvent(ctx!, tenantId, {
        type: 'incident.opened',
        severity: 'critical',
      });
    }

    const r = await ctx!.withClaims({ sub: userId }, async () => {
      return ctx!.client.query<{ risk_score: string; spend_90d: string; quadrant: string }>(
        `SELECT * FROM public.compute_tenant_quadrant($1::uuid)`,
        [tenantId],
      );
    });
    expect(Number(r.rows[0]!.risk_score)).toBeGreaterThanOrEqual(50);
    expect(Number(r.rows[0]!.spend_90d)).toBe(0);
    expect(r.rows[0]!.quadrant).toBe('investigate');
  });

  it('high spend (≥ 1.5× cohort median) + low risk → premium_review', async () => {
    // Two-tenant cohort: A spends 10, B spends 100. Median = 55, 1.5× = 82.5.
    // B's 100 ≥ 82.5 → high cost. With no risk events, B's quadrant = premium_review.
    const A = await createTenantWithMember(ctx!, { tenantName: 'A', userEmail: 'a@p.de' });
    const B = await createTenantWithMember(ctx!, { tenantName: 'B', userEmail: 'b@p.de' });
    await settleCost(ctx!, A.tenantId, 'flow-x', 10);
    await settleCost(ctx!, B.tenantId, 'flow-x', 100);

    const r = await ctx!.withClaims({ sub: B.userId }, async () => {
      return ctx!.client.query<{ quadrant: string; spend_90d: string; median_spend: string }>(
        `SELECT * FROM public.compute_tenant_quadrant($1::uuid)`,
        [B.tenantId],
      );
    });
    expect(r.rows[0]!.quadrant).toBe('premium_review');
  });
});

d('RFC-004 / emit_quadrant_changes (DB)', () => {
  let ctx: DbCtx | null = null;
  beforeEach(async () => { ctx = await openDb(); });
  afterEach(async () => { await closeDb(ctx); ctx = null; });

  it('emits joint.tenant_quadrant_changed on initial classification', async () => {
    const { tenantId } = await createTenantWithMember(ctx!);

    const r = await ctx!.withClaims({ role: 'service_role' }, async () => {
      return ctx!.client.query<{ n: number }>(
        `SELECT public.emit_quadrant_changes()::int AS n`,
      );
    });
    expect(r.rows[0]!.n).toBeGreaterThanOrEqual(1);

    const ev = await ctx!.client.query<{
      severity: string; current: string; previous: string | null;
    }>(
      `SELECT severity,
              payload->>'current'  AS current,
              payload->>'previous' AS previous
         FROM public.runtime_events
        WHERE tenant_id = $1 AND type = 'joint.tenant_quadrant_changed'
        ORDER BY tenant_seq DESC LIMIT 1`,
      [tenantId],
    );
    expect(ev.rows[0]!.current).toBe('reserved_capacity');
    expect(ev.rows[0]!.previous).toBeNull();
    expect(ev.rows[0]!.severity).toBe('info');
  });

  it('does NOT re-emit when quadrant is unchanged', async () => {
    const { tenantId } = await createTenantWithMember(ctx!);

    await ctx!.withClaims({ role: 'service_role' }, async () => {
      await ctx!.client.query(`SELECT public.emit_quadrant_changes()`);
      await ctx!.client.query(`SELECT public.emit_quadrant_changes()`);
    });

    const r = await ctx!.client.query<{ n: number }>(
      `SELECT count(*)::int AS n FROM public.runtime_events
        WHERE tenant_id = $1 AND type = 'joint.tenant_quadrant_changed'`,
      [tenantId],
    );
    expect(r.rows[0]!.n).toBe(1);
  });

  it('emit_quadrant_changes is service-role only', async () => {
    const { userId } = await createTenantWithMember(ctx!);
    await expect(
      ctx!.withClaims({ sub: userId }, async () => {
        await ctx!.client.query(`SELECT public.emit_quadrant_changes()`);
      }),
    ).rejects.toThrow(/forbidden|permission denied/);
  });
});
