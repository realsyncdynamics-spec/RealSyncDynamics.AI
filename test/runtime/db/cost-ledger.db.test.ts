/**
 * RFC-004 Part B — Cost Ledger (DB integration)
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

d('RFC-004 / tenant_cost_ledger contract (DB)', () => {
  let ctx: DbCtx | null = null;
  beforeEach(async () => { ctx = await openDb(); });
  afterEach(async () => { await closeDb(ctx); ctx = null; });

  it('insert without attribution (no agent/flow/trace) is rejected', async () => {
    const { tenantId } = await createTenantWithMember(ctx!);
    await expect(
      ctx!.client.query(
        `INSERT INTO public.tenant_cost_ledger
           (tenant_id, cost_kind, units, unit_price_usd)
         VALUES ($1, 'llm_input', 100, 0.000001)`,
        [tenantId],
      ),
    ).rejects.toMatchObject({ code: '23514' }); // check_violation
  });

  it('amount_usd is generated (units × unit_price_usd)', async () => {
    const { tenantId } = await createTenantWithMember(ctx!);
    const r = await ctx!.client.query<{ amount_usd: string }>(
      `INSERT INTO public.tenant_cost_ledger
         (tenant_id, cost_kind, units, unit_price_usd, agent_ref)
       VALUES ($1, 'llm_input', 1000, 0.000003, 'agent-x')
       RETURNING amount_usd`,
      [tenantId],
    );
    expect(Number(r.rows[0]!.amount_usd)).toBeCloseTo(0.003, 6);
  });

  it('is_simulated=true requires replay_run_id', async () => {
    const { tenantId } = await createTenantWithMember(ctx!);
    await expect(
      ctx!.client.query(
        `INSERT INTO public.tenant_cost_ledger
           (tenant_id, cost_kind, units, unit_price_usd, agent_ref, is_simulated)
         VALUES ($1, 'llm_input', 100, 0.000001, 'agent-x', true)`,
        [tenantId],
      ),
    ).rejects.toMatchObject({ code: '23514' });
  });

  it('is_simulated=true with replay_run_id is accepted', async () => {
    const { tenantId } = await createTenantWithMember(ctx!);
    const r = await ctx!.client.query(
      `INSERT INTO public.tenant_cost_ledger
         (tenant_id, cost_kind, units, unit_price_usd, agent_ref,
          is_simulated, replay_run_id)
       VALUES ($1, 'llm_input', 100, 0.000001, 'agent-x', true, gen_random_uuid())
       RETURNING id`,
      [tenantId],
    );
    expect(r.rows[0]!.id).toBeDefined();
  });

  it('DELETE is blocked by append-only trigger', async () => {
    const { tenantId } = await createTenantWithMember(ctx!);
    const r = await ctx!.client.query<{ id: string }>(
      `INSERT INTO public.tenant_cost_ledger
         (tenant_id, cost_kind, units, unit_price_usd, agent_ref)
       VALUES ($1, 'llm_input', 1, 0.01, 'agent-x') RETURNING id`,
      [tenantId],
    );
    await expect(
      ctx!.client.query(
        `DELETE FROM public.tenant_cost_ledger WHERE id=$1`,
        [r.rows[0]!.id],
      ),
    ).rejects.toMatchObject({ code: '42501' });
  });

  it('UPDATE for reservation settlement is allowed', async () => {
    // Reservation lifecycle requires UPDATE (settled false → true)
    const { tenantId } = await createTenantWithMember(ctx!);
    const ins = await ctx!.client.query<{ id: string }>(
      `INSERT INTO public.tenant_cost_ledger
         (tenant_id, cost_kind, units, unit_price_usd, agent_ref,
          reservation_id, settled, expires_at)
       VALUES ($1, 'reservation', 1000, 0.000003, 'agent-x',
               gen_random_uuid(), false, now() + INTERVAL '5 minutes')
       RETURNING id`,
      [tenantId],
    );
    const upd = await ctx!.client.query(
      `UPDATE public.tenant_cost_ledger
          SET settled = true, settled_at = now()
        WHERE id = $1`,
      [ins.rows[0]!.id],
    );
    expect(upd.rowCount).toBe(1);
  });
});
