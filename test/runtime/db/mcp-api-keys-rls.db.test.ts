/**
 * mcp_api_keys: Mitglieder lesen nur, schreiben darf nur service_role
 * (20260927180000_mcp_api_keys_rls_readonly.sql).
 *
 * Vorher: Policy FOR ALL ohne WITH CHECK — ein Mitglied konnte Keys anlegen,
 * reaktivieren, scopes ändern und key_hash lesen.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { closeDb, createTenantWithMember, openDb, requireDbOrFail, type DbCtx } from './db-helpers';

const d = requireDbOrFail('mcp-api-keys-rls') ? describe : describe.skip;

type Rolle = 'anon' | 'authenticated' | 'service_role';

async function als<T>(ctx: DbCtx, rolle: Rolle, sub: string | null, fn: () => Promise<T>): Promise<T> {
  const sp = `sp_${Math.random().toString(36).slice(2, 10)}`;
  await ctx.client.query(`SAVEPOINT ${sp}`);
  await ctx.client.query(`SELECT set_config('request.jwt.claims', $1, true)`, [
    JSON.stringify({ sub, role: rolle }),
  ]);
  await ctx.client.query(`SET LOCAL ROLE ${rolle}`);
  try {
    const out = await fn();
    await ctx.client.query(`RESET ROLE`);
    await ctx.client.query(`RELEASE SAVEPOINT ${sp}`);
    return out;
  } catch (err) {
    await ctx.client.query(`ROLLBACK TO SAVEPOINT ${sp}`);
    await ctx.client.query(`RESET ROLE`);
    throw err;
  }
}

const VERWEIGERT = { code: '42501' };
const SICHTBAR = 'id, tenant_id, key_prefix, name, scopes, active, expires_at';

async function keyFuer(ctx: DbCtx, tenantId: string, prefix: string): Promise<string> {
  const { rows } = await ctx.client.query<{ id: string }>(
    `INSERT INTO public.mcp_api_keys (tenant_id, key_prefix, key_hash, name, active)
     VALUES ($1, $2, md5(random()::text), 'k', false) RETURNING id`,
    [tenantId, prefix],
  );
  return rows[0]!.id;
}

d('mcp_api_keys · nur lesen für Mitglieder', () => {
  let ctx: DbCtx | null = null;
  beforeEach(async () => { ctx = await openDb(); });
  afterEach(async () => { await closeDb(ctx); ctx = null; });

  it('Mitglied liest eigene Keys, fremder Mandant und anon sehen nichts', async () => {
    const a = await createTenantWithMember(ctx!);
    const b = await createTenantWithMember(ctx!);
    const keyA = await keyFuer(ctx!, a.tenantId, 'rsk_a0001');

    const eigen = await als(ctx!, 'authenticated', a.userId, () =>
      ctx!.client.query(`SELECT ${SICHTBAR} FROM public.mcp_api_keys WHERE id = $1`, [keyA]));
    expect(eigen.rowCount).toBe(1);

    const fremd = await als(ctx!, 'authenticated', b.userId, () =>
      ctx!.client.query(`SELECT ${SICHTBAR} FROM public.mcp_api_keys WHERE id = $1`, [keyA]));
    expect(fremd.rowCount).toBe(0);

    await expect(als(ctx!, 'anon', null, () =>
      ctx!.client.query(`SELECT id FROM public.mcp_api_keys`))).rejects.toMatchObject(VERWEIGERT);
  });

  it('key_hash und last_used_ip sind für Mitglieder nicht lesbar', async () => {
    const a = await createTenantWithMember(ctx!);
    await keyFuer(ctx!, a.tenantId, 'rsk_a0002');
    for (const spalte of ['key_hash', 'last_used_ip']) {
      await expect(als(ctx!, 'authenticated', a.userId, () =>
        ctx!.client.query(`SELECT ${spalte} FROM public.mcp_api_keys`))).rejects.toMatchObject(VERWEIGERT);
    }
  });

  it('Mitglied kann weder anlegen, ändern noch löschen', async () => {
    const a = await createTenantWithMember(ctx!);
    const keyA = await keyFuer(ctx!, a.tenantId, 'rsk_a0003');

    await expect(als(ctx!, 'authenticated', a.userId, () =>
      ctx!.client.query(
        `INSERT INTO public.mcp_api_keys (tenant_id, key_prefix, key_hash, name)
         VALUES ($1, 'rsk_evil01', 'x', 'evil')`, [a.tenantId]))).rejects.toMatchObject(VERWEIGERT);

    await expect(als(ctx!, 'authenticated', a.userId, () =>
      ctx!.client.query(`UPDATE public.mcp_api_keys SET active = true, scopes = '{admin}' WHERE id = $1`, [keyA])))
      .rejects.toMatchObject(VERWEIGERT);

    await expect(als(ctx!, 'authenticated', a.userId, () =>
      ctx!.client.query(`DELETE FROM public.mcp_api_keys WHERE id = $1`, [keyA]))).rejects.toMatchObject(VERWEIGERT);

    const { rows } = await ctx!.client.query<{ active: boolean }>(
      `SELECT active FROM public.mcp_api_keys WHERE id = $1`, [keyA]);
    expect(rows[0]!.active).toBe(false);
  });

  it('service_role verwaltet Keys weiterhin', async () => {
    const a = await createTenantWithMember(ctx!);
    const keyA = await keyFuer(ctx!, a.tenantId, 'rsk_a0004');
    const upd = await als(ctx!, 'service_role', null, () =>
      ctx!.client.query(`UPDATE public.mcp_api_keys SET active = true WHERE id = $1 RETURNING key_hash`, [keyA]));
    expect(upd.rowCount).toBe(1);
  });
});
