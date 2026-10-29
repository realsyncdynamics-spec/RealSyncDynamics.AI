/**
 * Last-Owner RLS Hardening (20261029100000_last_owner_rls_hardening.sql).
 *
 *   - tenants/subscriptions: keine Schreib-Policy fuer authenticated (20261029101000)
 *   - memberships: der letzte Owner eines Mandanten kann nicht unter 'owner'
 *     herabgestuft werden (memberships prevent-last-owner-downgrade); existiert
 *     ein zweiter Owner, bleibt die Herabstufung erlaubt
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { closeDb, openDb, requireDbOrFail, type DbCtx } from './db-helpers';

const d = requireDbOrFail('last-owner-rls-hardening') ? describe : describe.skip;

type Outcome = 'allow' | 'deny';

d('Last-Owner RLS Hardening', () => {
  let ctx: DbCtx | null = null;

  beforeEach(async () => {
    ctx = await openDb();
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

  async function seed() {
    const q = <T extends Record<string, unknown>>(sql: string, params: unknown[] = []) =>
      ctx!.client.query<T>(sql, params);
    const tenantId = (
      await q<{ id: string }>(`INSERT INTO public.tenants(name) VALUES ($1) RETURNING id`, [`lo-${Date.now()}`])
    ).rows[0]!.id;
    const mkUser = async (tag: string) =>
      (
        await q<{ id: string }>(
          `INSERT INTO auth.users(email) VALUES ($1) RETURNING id`,
          [`lo_${tag}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}@example.com`],
        )
      ).rows[0]!.id;
    const owner1 = await mkUser('o1');
    const owner2 = await mkUser('o2');
    const admin = await mkUser('ad');
    const editor = await mkUser('ed');

    await q(
      `INSERT INTO public.memberships(tenant_id, user_id, role)
       VALUES ($1,$2,'owner'), ($1,$3,'admin'), ($1,$4,'editor')`,
      [tenantId, owner1, admin, editor],
    );
    return { tenantId, owner1, owner2, admin, editor };
  }

  it('verhindert Herabstufung des einzigen Owners, erlaubt sie aber bei zwei Ownern', async () => {
    const { tenantId, owner1, owner2, admin, editor } = await seed();
    const setRole = `UPDATE public.memberships SET role = $3 WHERE tenant_id = $1 AND user_id = $2`;

    expect(await attempt(owner1, setRole, [tenantId, owner1, 'admin'])).toBe('deny');
    expect(await attempt(admin, setRole, [tenantId, owner1, 'admin'])).toBe('deny');
    expect(await attempt(admin, setRole, [tenantId, editor, 'dpo'])).toBe('allow');
    expect(await attempt(owner1, setRole, [tenantId, editor, 'admin'])).toBe('allow');

    await ctx!.client.query(
      `INSERT INTO public.memberships(tenant_id, user_id, role) VALUES ($1, $2, 'owner')`,
      [tenantId, owner2],
    );
    expect(await attempt(owner1, setRole, [tenantId, owner2, 'admin'])).toBe('allow');
  });

  it('öffnet keine Schreib-Policy auf subscriptions oder DELETE auf tenants (20261029101000)', async () => {
    const { rows } = await ctx!.client.query<{ tablename: string; policyname: string; cmd: string }>(
      `SELECT tablename, policyname, cmd FROM pg_policies
        WHERE schemaname = 'public'
          AND permissive = 'PERMISSIVE'
          AND roles && ARRAY['authenticated', 'anon', 'public']::name[]
          AND ((tablename = 'subscriptions' AND cmd <> 'SELECT')
            OR (tablename = 'tenants' AND cmd IN ('DELETE', 'ALL')))`,
    );
    expect(rows).toEqual([]);
  });
});
