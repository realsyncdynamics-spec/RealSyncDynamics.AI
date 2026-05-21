/**
 * RFC-004 Part B §6 — Hard Caps Enforcement (DB integration)
 *
 * Pre-check + reservation + settle round-trip, backpressure semantics,
 * expiry sweeper.
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

async function setCaps(
  ctx: DbCtx,
  tenantId: string,
  llmUsdMonthly: number,
  warnThreshold = 0.8,
): Promise<void> {
  await ctx.client.query(
    `INSERT INTO public.tenant_cost_caps
       (tenant_id, llm_usd_monthly, warn_threshold)
     VALUES ($1, $2, $3)
     ON CONFLICT (tenant_id) DO UPDATE
       SET llm_usd_monthly = EXCLUDED.llm_usd_monthly,
           warn_threshold  = EXCLUDED.warn_threshold`,
    [tenantId, llmUsdMonthly, warnThreshold],
  );
}

async function callCheckAndReserve(
  ctx: DbCtx,
  tenantId: string,
  units: number,
  unitPrice: number,
  costKind = 'llm_input',
): Promise<{
  decision: string;
  reservation_id: string | null;
  cap_remaining: string;
  cap_used: string;
  cap_total: string;
}> {
  return ctx.withClaims({ role: 'service_role' }, async () => {
    const r = await ctx.client.query(
      `SELECT * FROM public.cost_check_and_reserve(
          $1::uuid, $2, $3::numeric, $4::numeric,
          jsonb_build_object('agent_ref', 'test-agent'))`,
      [tenantId, costKind, units, unitPrice],
    );
    return r.rows[0];
  });
}

d('RFC-004 / cost_check_and_reserve (DB)', () => {
  let ctx: DbCtx | null = null;
  beforeEach(async () => { ctx = await openDb(); });
  afterEach(async () => { await closeDb(ctx); ctx = null; });

  it('returns allow + creates reservation when under warn threshold', async () => {
    const { tenantId } = await createTenantWithMember(ctx!);
    await setCaps(ctx!, tenantId, 100); // 100 USD cap

    const r = await callCheckAndReserve(ctx!, tenantId, 10000, 0.000003); // 0.03 USD
    expect(r.decision).toBe('allow');
    expect(r.reservation_id).not.toBeNull();
    expect(Number(r.cap_remaining)).toBeCloseTo(100, 2);

    const led = await ctx!.client.query(
      `SELECT cost_kind, settled FROM public.tenant_cost_ledger
        WHERE reservation_id = $1`,
      [r.reservation_id],
    );
    expect(led.rows[0]!.cost_kind).toBe('reservation');
    expect(led.rows[0]!.settled).toBe(false);
  });

  it('returns warn when usage crosses warn_threshold', async () => {
    const { tenantId } = await createTenantWithMember(ctx!);
    await setCaps(ctx!, tenantId, 10, 0.5); // 10 USD cap, warn at 50%

    // Pre-spend 6 USD (60% > 50% warn threshold)
    await ctx!.client.query(
      `INSERT INTO public.tenant_cost_ledger
         (tenant_id, cost_kind, units, unit_price_usd, agent_ref)
       VALUES ($1, 'llm_input', 6000000, 0.000001, 'pre')`,
      [tenantId],
    );

    const r = await callCheckAndReserve(ctx!, tenantId, 1000000, 0.000001); // +1 USD
    expect(r.decision).toBe('warn');
    expect(r.reservation_id).not.toBeNull();
  });

  it('returns throttle when estimate would exceed cap, no reservation written', async () => {
    const { tenantId } = await createTenantWithMember(ctx!);
    await setCaps(ctx!, tenantId, 1); // 1 USD cap

    // Estimate 2 USD → throttle
    const r = await callCheckAndReserve(ctx!, tenantId, 2000000, 0.000001);
    expect(r.decision).toBe('throttle');
    expect(r.reservation_id).toBeNull();

    // No reservation row created
    const res = await ctx!.client.query<{ n: number }>(
      `SELECT count(*)::int AS n FROM public.tenant_cost_ledger
        WHERE tenant_id = $1 AND cost_kind = 'reservation'`,
      [tenantId],
    );
    expect(res.rows[0]!.n).toBe(0);
  });

  it('throttle emits cost.cap_violation_blocked T0 critical event', async () => {
    const { tenantId } = await createTenantWithMember(ctx!);
    await setCaps(ctx!, tenantId, 1);

    await callCheckAndReserve(ctx!, tenantId, 2000000, 0.000001);

    const r = await ctx!.client.query<{ severity: string; type: string }>(
      `SELECT type, severity FROM public.runtime_events
        WHERE tenant_id = $1 AND type = 'cost.cap_violation_blocked'`,
      [tenantId],
    );
    expect(r.rows[0]!.severity).toBe('critical');
  });

  it('simulated cost rows are excluded from cap aggregation', async () => {
    const { tenantId } = await createTenantWithMember(ctx!);
    await setCaps(ctx!, tenantId, 1); // 1 USD cap

    // 5 USD of simulated cost — must NOT count against the cap
    await ctx!.client.query(
      `INSERT INTO public.tenant_cost_ledger
         (tenant_id, cost_kind, units, unit_price_usd, agent_ref,
          is_simulated, replay_run_id)
       VALUES ($1, 'llm_input', 5000000, 0.000001, 'replay',
               true, gen_random_uuid())`,
      [tenantId],
    );

    const r = await callCheckAndReserve(ctx!, tenantId, 500000, 0.000001); // 0.50 USD live
    expect(r.decision).toBe('allow');
  });
});

d('RFC-004 / cost_writer_settle (DB)', () => {
  let ctx: DbCtx | null = null;
  beforeEach(async () => { ctx = await openDb(); });
  afterEach(async () => { await closeDb(ctx); ctx = null; });

  it('settle flips reservation row to settled + sets cost_kind/units', async () => {
    const { tenantId } = await createTenantWithMember(ctx!);
    await setCaps(ctx!, tenantId, 100);

    const reserve = await callCheckAndReserve(ctx!, tenantId, 10000, 0.000003);
    expect(reserve.decision).toBe('allow');

    const settled = await ctx!.withClaims({ role: 'service_role' }, async () => {
      return ctx!.client.query<{ id: string }>(
        `SELECT public.cost_writer_settle($1::uuid, 'llm_input', 8000, 0.000003) AS id`,
        [reserve.reservation_id],
      );
    });
    expect(settled.rows[0]!.id).toBeDefined();

    const row = await ctx!.client.query<{
      cost_kind: string;
      settled: boolean;
      units: string;
      amount_usd: string;
    }>(
      `SELECT cost_kind, settled, units, amount_usd
         FROM public.tenant_cost_ledger
        WHERE reservation_id = $1`,
      [reserve.reservation_id],
    );
    expect(row.rows[0]!.cost_kind).toBe('llm_input');
    expect(row.rows[0]!.settled).toBe(true);
    expect(Number(row.rows[0]!.units)).toBe(8000);
    expect(Number(row.rows[0]!.amount_usd)).toBeCloseTo(0.024, 6);
  });

  it('settle on a nonexistent reservation raises', async () => {
    await expect(
      ctx!.withClaims({ role: 'service_role' }, async () => {
        await ctx!.client.query(
          `SELECT public.cost_writer_settle($1::uuid, 'llm_input', 100, 0.000001)`,
          ['00000000-0000-0000-0000-000000000000'],
        );
      }),
    ).rejects.toThrow(/reservation .* not found/);
  });
});

d('RFC-004 / reservation expiry sweeper (DB)', () => {
  let ctx: DbCtx | null = null;
  beforeEach(async () => { ctx = await openDb(); });
  afterEach(async () => { await closeDb(ctx); ctx = null; });

  it('sweeper deletes expired unsettled reservations + emits event', async () => {
    const { tenantId } = await createTenantWithMember(ctx!);

    // Plant an already-expired reservation directly
    const rid = (await ctx!.client.query<{ rid: string }>(
      `INSERT INTO public.tenant_cost_ledger
         (tenant_id, cost_kind, units, unit_price_usd, agent_ref,
          reservation_id, settled, expires_at)
       VALUES ($1, 'reservation', 100, 0.000001, 'agent-x',
               gen_random_uuid(), false, now() - INTERVAL '1 minute')
       RETURNING reservation_id AS rid`,
      [tenantId],
    )).rows[0]!.rid;

    const swept = await ctx!.withClaims({ role: 'service_role' }, async () => {
      return ctx!.client.query<{ n: number }>(
        `SELECT public.cost_sweep_expired_reservations()::int AS n`,
      );
    });
    expect(swept.rows[0]!.n).toBeGreaterThanOrEqual(1);

    const left = await ctx!.client.query<{ n: number }>(
      `SELECT count(*)::int AS n FROM public.tenant_cost_ledger
        WHERE reservation_id = $1`,
      [rid],
    );
    expect(left.rows[0]!.n).toBe(0);

    const ev = await ctx!.client.query<{ severity: string }>(
      `SELECT severity FROM public.runtime_events
        WHERE tenant_id = $1
          AND type = 'cost.reservation_expired'
          AND (payload->>'reservation_id')::uuid = $2`,
      [tenantId, rid],
    );
    expect(ev.rows[0]!.severity).toBe('low');
  });
});
