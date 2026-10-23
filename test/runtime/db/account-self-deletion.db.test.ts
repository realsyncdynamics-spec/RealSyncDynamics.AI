/**
 * Art. 17 Selbstlöschung: `delete_sole_member_tenants` (Migration
 * 20261023120000, R-03) gegen das voll migrierte Schema.
 *
 * Regression zum E2E-Test vom 20.10.2026: Die Registrierung legt einen
 * Workspace an (Trigger auf auth.users), und gdpr-delete lehnte danach jede
 * Selbstlöschung mit 409 SOLE_OWNER ab. Die Fixtures nutzen deshalb den
 * Workspace, den die Registrierung selbst anlegt.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { closeDb, openDb, requireDbOrFail, type DbCtx } from './db-helpers';

const d = requireDbOrFail('account-self-deletion') ? describe : describe.skip;

interface CleanupResult {
  ok: boolean;
  dry_run?: boolean;
  tenants?: number;
  blocked?: Array<{ tenant_id?: string; name?: string; reason: string; sqlstate?: string }>;
}

async function signUp(ctx: DbCtx): Promise<{ userId: string; tenantId: string }> {
  const email = `self_del_${Date.now()}_${Math.random().toString(36).slice(2, 10)}@example.com`;
  const { rows } = await ctx.client.query<{ id: string }>(`INSERT INTO auth.users(email) VALUES ($1) RETURNING id`, [email]);
  const userId = rows[0]!.id;
  const { rows: t } = await ctx.client.query<{ tenant_id: string }>(
    `SELECT tenant_id FROM public.memberships WHERE user_id = $1 AND role = 'owner'`, [userId]);
  expect(t, 'Registrierung legt genau einen eigenen Workspace an').toHaveLength(1);
  return { userId, tenantId: t[0]!.tenant_id };
}

async function cleanup(ctx: DbCtx, userId: string, dryRun: boolean): Promise<CleanupResult> {
  const { rows } = await ctx.client.query<{ r: CleanupResult }>(
    `SELECT public.delete_sole_member_tenants($1, $2) AS r`, [userId, dryRun]);
  return rows[0]!.r;
}

async function count(ctx: DbCtx, sql: string, params: unknown[]): Promise<number> {
  const { rows } = await ctx.client.query<{ n: string }>(`SELECT count(*)::text AS n FROM ${sql}`, params);
  return Number(rows[0]!.n);
}

d('account self-deletion: delete_sole_member_tenants (DB)', () => {
  let ctx: DbCtx | null = null;
  beforeEach(async () => { ctx = await openDb(); });
  afterEach(async () => { await closeDb(ctx); ctx = null; });

  it('1: fresh sign-up — dry run changes nothing, the real run removes workspace, memberships and placeholder', async () => {
    const { userId, tenantId } = await signUp(ctx!);
    await ctx!.client.query(`INSERT INTO public.tenant_memberships(tenant_id, user_id, role) VALUES ($1, $2, 'owner')`, [tenantId, userId]);
    expect(await count(ctx!, `public.subscriptions WHERE tenant_id = $1 AND stripe_subscription_id IS NULL AND stripe_customer_id NOT LIKE 'cus\\_%'`, [tenantId])).toBe(1);

    expect(await cleanup(ctx!, userId, true)).toEqual({ ok: true, dry_run: true, tenants: 1 });
    expect(await count(ctx!, 'public.tenants WHERE id = $1', [tenantId])).toBe(1);

    expect(await cleanup(ctx!, userId, false)).toEqual({ ok: true, dry_run: false, tenants: 1 });
    for (const table of ['tenants WHERE id', 'memberships WHERE tenant_id', 'tenant_memberships WHERE tenant_id', 'subscriptions WHERE tenant_id']) {
      expect(await count(ctx!, `public.${table} = $1`, [tenantId]), table).toBe(0);
    }
    expect(await count(ctx!, 'auth.users WHERE id = $1', [userId]), 'das Konto löscht gdpr-delete danach').toBe(1);
  });

  it('2: another member (also only via tenant_memberships) blocks; nothing is deleted', async () => {
    const owner = await signUp(ctx!);
    const guest = await signUp(ctx!);
    await ctx!.client.query(`INSERT INTO public.tenant_memberships(tenant_id, user_id, role) VALUES ($1, $2, 'member')`, [owner.tenantId, guest.userId]);
    const r = await cleanup(ctx!, owner.userId, false);
    expect(r.ok).toBe(false);
    expect(r.blocked).toEqual([expect.objectContaining({ tenant_id: owner.tenantId, reason: 'other_members' })]);
    expect(typeof r.blocked![0]!.name).toBe('string');
    expect(await count(ctx!, 'public.tenants WHERE id = $1', [owner.tenantId])).toBe(1);
  });

  it('3: Stripe billing (subscription or real customer) blocks for retention', async () => {
    const { userId, tenantId } = await signUp(ctx!);
    await ctx!.client.query(
      `UPDATE public.subscriptions SET stripe_customer_id = 'cus_TEST123', stripe_subscription_id = 'sub_TEST123' WHERE tenant_id = $1`, [tenantId]);
    expect((await cleanup(ctx!, userId, true)).blocked?.[0]?.reason).toBe('billing_records');
    await ctx!.client.query(`UPDATE public.subscriptions SET stripe_subscription_id = NULL WHERE tenant_id = $1`, [tenantId]);
    expect((await cleanup(ctx!, userId, false)).blocked?.[0]?.reason).toBe('billing_records');
    expect(await count(ctx!, 'public.tenants WHERE id = $1', [tenantId])).toBe(1);
  });

  it('4: retained evidence blocks already in the dry run; workspace and evidence stay', async () => {
    const { userId, tenantId } = await signUp(ctx!);
    await ctx!.client.query(
      `INSERT INTO public.evidence_anchors(tenant_id, chain_index, chain_hash, event_count)
       VALUES ($1, 1, decode(repeat('ab', 32), 'hex'), 1)`, [tenantId]);
    for (const dry of [true, false]) {
      const r = await cleanup(ctx!, userId, dry);
      expect(r.ok, `dry_run=${dry}`).toBe(false);
      expect(r.blocked?.[0]?.reason).toBe('retained_records');
    }
    expect(await count(ctx!, 'public.tenants WHERE id = $1', [tenantId])).toBe(1);
    expect(await count(ctx!, 'public.memberships WHERE tenant_id = $1', [tenantId])).toBe(1);
    expect(await count(ctx!, 'public.evidence_anchors WHERE tenant_id = $1', [tenantId])).toBe(1);
  });

  it('5: a workspace with a second owner is left alone', async () => {
    const owner = await signUp(ctx!);
    const second = await signUp(ctx!);
    await ctx!.client.query(`INSERT INTO public.memberships(tenant_id, user_id, role) VALUES ($1, $2, 'owner')`, [owner.tenantId, second.userId]);
    expect(await cleanup(ctx!, owner.userId, false)).toEqual({ ok: true, dry_run: false, tenants: 0 });
    expect(await count(ctx!, 'public.tenants WHERE id = $1', [owner.tenantId])).toBe(1);
  });

  it('6: all or nothing — one blocked workspace keeps the deletable one as well', async () => {
    const owner = await signUp(ctx!);
    const guest = await signUp(ctx!);
    const { rows } = await ctx!.client.query<{ id: string }>(`INSERT INTO public.tenants(name) VALUES ('zweiter') RETURNING id`);
    const second = rows[0]!.id;
    await ctx!.client.query(`INSERT INTO public.memberships(tenant_id, user_id, role) VALUES ($1, $2, 'owner'), ($1, $3, 'editor')`, [second, owner.userId, guest.userId]);
    expect((await cleanup(ctx!, owner.userId, false)).ok).toBe(false);
    expect(await count(ctx!, 'public.tenants WHERE id = ANY($1)', [[owner.tenantId, second]])).toBe(2);
  });

  it('7: only service_role may execute; NULL is rejected', async () => {
    const { rows } = await ctx!.client.query<{ anon: boolean; auth: boolean; svc: boolean }>(`
      SELECT has_function_privilege('anon', 'public.delete_sole_member_tenants(uuid, boolean)', 'EXECUTE') AS anon,
             has_function_privilege('authenticated', 'public.delete_sole_member_tenants(uuid, boolean)', 'EXECUTE') AS auth,
             has_function_privilege('service_role', 'public.delete_sole_member_tenants(uuid, boolean)', 'EXECUTE') AS svc`);
    expect(rows[0]).toEqual({ anon: false, auth: false, svc: true });

    await ctx!.client.query('SAVEPOINT null_arg');
    try {
      await ctx!.client.query('SELECT public.delete_sole_member_tenants(NULL, true)');
      throw new Error('NULL wurde akzeptiert');
    } catch (err) {
      await ctx!.client.query('ROLLBACK TO SAVEPOINT null_arg');
      expect((err as { code?: string }).code).toBe('22023');
    }
  });

  it('8: works as service_role, the role gdpr-delete uses', async () => {
    const { userId, tenantId } = await signUp(ctx!);
    const r = await ctx!.withClaims({ role: 'service_role' }, () => cleanup(ctx!, userId, false));
    expect(r).toEqual({ ok: true, dry_run: false, tenants: 1 });
    expect(await count(ctx!, 'public.tenants WHERE id = $1', [tenantId])).toBe(0);
  });
});
