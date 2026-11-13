/**
 * RSD-014: Mandantenisolation nach Anwenden der Migration in der Testtransaktion.
 * Laeuft nur mit TEST_DB_URL (wie die anderen runtime/db-Tests). Ohne DB: skip.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { resolve } from 'node:path';
import {
  applyMigration,
  closeDb,
  openDb,
  requireDbOrFail,
  type DbCtx,
} from './db-helpers';

/** Lokaler Stack (GoTrue): auth.users.id hat keinen Default — im Gegensatz zum CI-Bootstrap. */
async function createTenantWithMember(
  ctx: DbCtx,
): Promise<{ tenantId: string; userId: string }> {
  const tenantName = `t_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
  const userEmail = `u_${Date.now()}_${Math.random().toString(36).slice(2, 10)}@example.com`;
  const { rows: tRows } = await ctx.client.query<{ id: string }>(
    `INSERT INTO public.tenants(name) VALUES ($1) RETURNING id`,
    [tenantName],
  );
  const tenantId = tRows[0]!.id;
  const { rows: uRows } = await ctx.client.query<{ id: string }>(
    `INSERT INTO auth.users(id, email) VALUES (gen_random_uuid(), $1) RETURNING id`,
    [userEmail],
  );
  const userId = uRows[0]!.id;
  await ctx.client.query(
    `INSERT INTO public.memberships(tenant_id, user_id, role) VALUES ($1,$2,'owner')`,
    [tenantId, userId],
  );
  const hasTenantMemberships = await ctx.client.query(
    `SELECT to_regclass('public.tenant_memberships') AS rel`,
  );
  if (hasTenantMemberships.rows[0]?.rel) {
    await ctx.client.query(
      `INSERT INTO public.tenant_memberships(tenant_id, user_id, role) VALUES ($1,$2,'owner')`,
      [tenantId, userId],
    );
  }
  return { tenantId, userId };
}

const d = requireDbOrFail('rsd014-tenant-isolation') ? describe : describe.skip;
const migrationsDir = resolve(__dirname, '../../../supabase/migrations');

type Outcome = 'allow' | 'deny';

d('RSD-014 Tenant-Isolation', () => {
  let ctx: DbCtx | null = null;

  beforeEach(async () => {
    ctx = await openDb();
    await applyMigration(ctx, migrationsDir, '20261114104700_rsd014_tenant_rls_policies.sql');
  });

  afterEach(async () => {
    await closeDb(ctx);
    ctx = null;
  });

  async function attempt(userId: string, sql: string, params: unknown[] = []): Promise<Outcome> {
    const sp = `sp_${Math.random().toString(36).slice(2, 10)}`;
    await ctx!.client.query(`SAVEPOINT ${sp}`);
    try {
      await ctx!.client.query(`SELECT set_config('request.jwt.claims', $1, true)`, [
        JSON.stringify({ sub: userId, role: 'authenticated' }),
      ]);
      await ctx!.client.query(`SET LOCAL ROLE authenticated`);
      const res = await ctx!.client.query(sql, params);
      return (res.rowCount ?? 0) > 0 ? 'allow' : 'deny';
    } catch (err) {
      const msg = String((err as Error).message);
      if (/row-level security|permission denied/i.test(msg)) return 'deny';
      throw err;
    } finally {
      await ctx!.client.query(`ROLLBACK TO SAVEPOINT ${sp}`);
      await ctx!.client.query(`RESET ROLE`);
    }
  }

  it('laesst Mitglied A nur Zeilen des eigenen Mandanten in enterprise_connectors sehen', async () => {
    const a = await createTenantWithMember(ctx!);
    const b = await createTenantWithMember(ctx!);
    await ctx!.client.query(
      `INSERT INTO public.enterprise_connectors (tenant_id, name, type, status)
       VALUES ($1, 'conn-a', 'custom_api', 'connected'), ($2, 'conn-b', 'custom_api', 'connected')`,
      [a.tenantId, b.tenantId],
    );

    const visibleA = await attempt(
      a.userId,
      `SELECT name FROM public.enterprise_connectors WHERE tenant_id = $1`,
      [a.tenantId],
    );
    const visibleBfromA = await attempt(
      a.userId,
      `SELECT name FROM public.enterprise_connectors WHERE tenant_id = $1`,
      [b.tenantId],
    );
    const visibleB = await attempt(
      b.userId,
      `SELECT name FROM public.enterprise_connectors WHERE tenant_id = $1`,
      [b.tenantId],
    );

    expect(visibleA).toBe('allow');
    expect(visibleBfromA).toBe('deny');
    expect(visibleB).toBe('allow');
  });

  it('haelt _operation_metrics fuer authenticated geschlossen', async () => {
    const a = await createTenantWithMember(ctx!);
    await ctx!.client.query(
      `INSERT INTO public._operation_metrics (operation_name, success, tenant_id)
       VALUES ('probe', true, $1)`,
      [a.tenantId],
    );
    const seen = await attempt(
      a.userId,
      `SELECT operation_name FROM public._operation_metrics WHERE tenant_id = $1`,
      [a.tenantId],
    );
    expect(seen).toBe('deny');
  });

  it('setzt die restriktive memberships-Policy nicht mehr auf USING true', async () => {
    const { rows } = await ctx!.client.query<{ qual: string | null }>(
      `SELECT pg_get_expr(polqual, polrelid) AS qual
         FROM pg_policy
        WHERE polrelid = 'public.memberships'::regclass
          AND polname = 'memberships prevent-last-owner-downgrade'`,
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]!.qual).toMatch(/is_tenant_member/i);
    expect(rows[0]!.qual).not.toBe('true');
  });
});
