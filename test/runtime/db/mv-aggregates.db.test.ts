/**
 * RFC-004 — Materialized Views + security_invoker wrapper views
 *
 * Validates that:
 *   • MV refresh produces expected aggregates after data is inserted
 *   • Wrapper views enforce tenant isolation via has_tenant_membership
 *   • Authenticated cannot read the bare MVs (only via wrapper view)
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

async function refresh(ctx: DbCtx, concurrent = false): Promise<void> {
  await ctx.withClaims({ role: 'service_role' }, async () => {
    await ctx.client.query(
      `SELECT public.refresh_governance_mvs($1::bool)`,
      [concurrent],
    );
  });
}

async function settleCost(
  ctx: DbCtx,
  tenantId: string,
  costKind: string,
  units: number,
  unitPrice: number,
  opts: { agentRef?: string; flowRef?: string } = {},
): Promise<void> {
  await ctx.client.query(
    `INSERT INTO public.tenant_cost_ledger
       (tenant_id, cost_kind, units, unit_price_usd, agent_ref, flow_ref)
     VALUES ($1, $2, $3::numeric, $4::numeric, $5, $6)`,
    [tenantId, costKind, units, unitPrice, opts.agentRef ?? null, opts.flowRef ?? null],
  );
}

d('RFC-004 / mv_cost_per_tenant (DB)', () => {
  let ctx: DbCtx | null = null;
  beforeEach(async () => { ctx = await openDb(); });
  afterEach(async () => { await closeDb(ctx); ctx = null; });

  it('aggregates llm_input + llm_output into llm_usd_7d', async () => {
    const { tenantId, userId } = await createTenantWithMember(ctx!);
    await settleCost(ctx!, tenantId, 'llm_input',  1000, 0.000003, { agentRef: 'a' });
    await settleCost(ctx!, tenantId, 'llm_output',  500, 0.000015, { agentRef: 'a' });
    await refresh(ctx!);

    const r = await ctx!.withClaims({ sub: userId }, async () => {
      return ctx!.client.query<{
        tokens_in_7d: string;
        tokens_out_7d: string;
        llm_usd_7d: string;
      }>(
        `SELECT tokens_in_7d, tokens_out_7d, llm_usd_7d
           FROM public.v_cost_per_tenant WHERE tenant_id=$1`,
        [tenantId],
      );
    });
    expect(Number(r.rows[0]!.tokens_in_7d)).toBe(1000);
    expect(Number(r.rows[0]!.tokens_out_7d)).toBe(500);
    // 1000*0.000003 + 500*0.000015 = 0.003 + 0.0075 = 0.0105
    expect(Number(r.rows[0]!.llm_usd_7d)).toBeCloseTo(0.0105, 6);
  });

  it('wrapper view enforces tenant isolation', async () => {
    const A = await createTenantWithMember(ctx!, { tenantName: 'A', userEmail: 'a@iso.de' });
    const B = await createTenantWithMember(ctx!, { tenantName: 'B', userEmail: 'b@iso.de' });
    await settleCost(ctx!, A.tenantId, 'llm_input', 1000, 0.000003, { agentRef: 'a' });
    await settleCost(ctx!, B.tenantId, 'llm_input', 9999, 0.000003, { agentRef: 'b' });
    await refresh(ctx!);

    // User B reads — must NOT see A's row
    const r = await ctx!.withClaims({ sub: B.userId }, async () => {
      return ctx!.client.query<{ tenant_id: string; tokens_in_7d: string }>(
        `SELECT tenant_id, tokens_in_7d FROM public.v_cost_per_tenant ORDER BY tokens_in_7d`,
      );
    });
    expect(r.rows.every((x) => x.tenant_id === B.tenantId)).toBe(true);
    expect(r.rows).toHaveLength(1);
    expect(Number(r.rows[0]!.tokens_in_7d)).toBe(9999);
  });

  it('authenticated cannot read bare MV directly', async () => {
    const { tenantId, userId } = await createTenantWithMember(ctx!);
    await settleCost(ctx!, tenantId, 'llm_input', 100, 0.000001, { agentRef: 'a' });
    await refresh(ctx!);

    await expect(
      ctx!.withClaims({ sub: userId }, async () => {
        await ctx!.client.query(`SELECT * FROM public.mv_cost_per_tenant`);
      }),
    ).rejects.toThrow(/permission denied/);
  });
});

d('RFC-004 / mv_cost_per_feature + mv_cost_per_agent (DB)', () => {
  let ctx: DbCtx | null = null;
  beforeEach(async () => { ctx = await openDb(); });
  afterEach(async () => { await closeDb(ctx); ctx = null; });

  it('per-feature aggregation groups by flow_ref + cost_kind', async () => {
    const { tenantId, userId } = await createTenantWithMember(ctx!);
    await settleCost(ctx!, tenantId, 'llm_input', 1000, 0.000003, { flowRef: 'flow-A' });
    await settleCost(ctx!, tenantId, 'llm_input', 2000, 0.000003, { flowRef: 'flow-A' });
    await settleCost(ctx!, tenantId, 'llm_input',  500, 0.000003, { flowRef: 'flow-B' });
    await refresh(ctx!);

    const r = await ctx!.withClaims({ sub: userId }, async () => {
      return ctx!.client.query<{ flow_ref: string; units_30d: string }>(
        `SELECT flow_ref, units_30d FROM public.v_cost_per_feature
          WHERE tenant_id=$1 AND cost_kind='llm_input'
          ORDER BY flow_ref`,
        [tenantId],
      );
    });
    expect(r.rows).toHaveLength(2);
    expect(r.rows[0]!.flow_ref).toBe('flow-A');
    expect(Number(r.rows[0]!.units_30d)).toBe(3000);
    expect(r.rows[1]!.flow_ref).toBe('flow-B');
    expect(Number(r.rows[1]!.units_30d)).toBe(500);
  });

  it('per-agent aggregation excludes rows without agent_ref', async () => {
    const { tenantId, userId } = await createTenantWithMember(ctx!);
    await settleCost(ctx!, tenantId, 'llm_input', 1000, 0.000003, { agentRef: 'agent-x', flowRef: 'f' });
    await settleCost(ctx!, tenantId, 'llm_input',  500, 0.000003, { flowRef: 'f-no-agent' });
    await refresh(ctx!);

    const r = await ctx!.withClaims({ sub: userId }, async () => {
      return ctx!.client.query<{ agent_ref: string; tokens_in_30d: string }>(
        `SELECT agent_ref, tokens_in_30d FROM public.v_cost_per_agent
          WHERE tenant_id=$1`,
        [tenantId],
      );
    });
    expect(r.rows).toHaveLength(1);
    expect(r.rows[0]!.agent_ref).toBe('agent-x');
    expect(Number(r.rows[0]!.tokens_in_30d)).toBe(1000);
  });
});

d('RFC-004 / mv_tenant_risk_score + quadrant MV (DB)', () => {
  let ctx: DbCtx | null = null;
  beforeEach(async () => { ctx = await openDb(); });
  afterEach(async () => { await closeDb(ctx); ctx = null; });

  it('refresh produces a risk_score row per tenant', async () => {
    const { tenantId, userId } = await createTenantWithMember(ctx!);
    await ctx!.client.query(
      `INSERT INTO public.runtime_events
         (tenant_id, type, severity, source, review_status, payload)
       VALUES ($1, 'incident.opened', 'critical', 'test', 'auto', '{}'::jsonb)`,
      [tenantId],
    );
    await refresh(ctx!);

    const r = await ctx!.withClaims({ sub: userId }, async () => {
      return ctx!.client.query<{ incident_component: string; tenant_risk_score: string }>(
        `SELECT incident_component, tenant_risk_score
           FROM public.v_tenant_risk_score WHERE tenant_id=$1`,
        [tenantId],
      );
    });
    // 1 critical = 25 → component=25 → tenant_risk = 0.30 × 25 = 7.5
    expect(Number(r.rows[0]!.incident_component)).toBe(25);
    expect(Number(r.rows[0]!.tenant_risk_score)).toBeCloseTo(7.5, 2);
  });

  it('quadrant MV reflects empty-tenant classification', async () => {
    const { tenantId, userId } = await createTenantWithMember(ctx!);
    await refresh(ctx!);

    const r = await ctx!.withClaims({ sub: userId }, async () => {
      return ctx!.client.query<{ quadrant: string }>(
        `SELECT quadrant FROM public.v_tenant_risk_cost_quadrant
          WHERE tenant_id=$1`,
        [tenantId],
      );
    });
    expect(r.rows[0]!.quadrant).toBe('reserved_capacity');
  });
});

d('RFC-004 / refresh helper gating (DB)', () => {
  let ctx: DbCtx | null = null;
  beforeEach(async () => { ctx = await openDb(); });
  afterEach(async () => { await closeDb(ctx); ctx = null; });

  it('refresh_governance_mvs is service-role only', async () => {
    const { userId } = await createTenantWithMember(ctx!);
    await expect(
      ctx!.withClaims({ sub: userId }, async () => {
        await ctx!.client.query(`SELECT public.refresh_governance_mvs(false)`);
      }),
    ).rejects.toThrow(/forbidden|permission denied/);
  });
});
