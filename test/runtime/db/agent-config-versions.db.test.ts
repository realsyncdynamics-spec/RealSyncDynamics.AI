/**
 * M5 agent_config_versions — Versionierung, RLS, Unveränderlichkeit, kontrollierte Aktivierung.
 * Läuft nur mit gesetztem TEST_DB_URL.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { closeDb, getDbUrl, openDb, type DbCtx } from './db-helpers';

const dbUrl = getDbUrl();
if (!dbUrl && process.env.REQUIRE_DB_TESTS === '1') {
  describe('agent_config_versions', () => {
    it('TEST_DB_URL muss gesetzt sein, wenn REQUIRE_DB_TESTS=1', () => {
      throw new Error('REQUIRE_DB_TESTS=1, aber TEST_DB_URL fehlt.');
    });
  });
}
const d = dbUrl ? describe : describe.skip;

d('M5 agent_config_versions', () => {
  let ctx: DbCtx | null = null;
  const ids = {} as { tA: string; tB: string; uA: string; uB: string; mA: string };
  const q = <T extends Record<string, unknown> = Record<string, unknown>>(sql: string, p: unknown[] = []) =>
    ctx!.client.query<T>(sql, p);

  async function as<T>(sub: string | null, fn: () => Promise<T>, role: 'anon' | 'authenticated' = 'authenticated'): Promise<T> {
    const sp = `sp_${Math.random().toString(36).slice(2, 10)}`;
    await q(`SAVEPOINT ${sp}`);
    try {
      await q(`SELECT set_config('request.jwt.claims', $1, true)`, [JSON.stringify({ sub, role })]);
      await q(`SET LOCAL ROLE ${role}`);
      return await fn();
    } finally {
      await q(`ROLLBACK TO SAVEPOINT ${sp}`);
      await q(`RESET ROLE`);
    }
  }
  async function asKeep<T>(sub: string, fn: () => Promise<T>): Promise<T> {
    await q(`SELECT set_config('request.jwt.claims', $1, true)`, [JSON.stringify({ sub, role: 'authenticated' })]);
    await q(`SET LOCAL ROLE authenticated`);
    try { return await fn(); } finally { await q(`RESET ROLE`); }
  }
  const denied = /row-level security|permission denied|unveränderlich/i;
  const draft = (sub: string, tenant: string, cfg = '{"role":"Reviewer"}') =>
    asKeep(sub, async () => (await q<{ id: string; version: number; status: string }>(
      `INSERT INTO public.agent_config_versions(tenant_id, agent_ref, section, config, status)
       VALUES ($1,'grok:github-bot','details',$2::jsonb,'active') RETURNING id, version, status`, [tenant, cfg])).rows[0]!);

  beforeEach(async () => {
    ctx = await openDb();
    const tenant = async (n: string) =>
      (await q<{ id: string }>(`INSERT INTO public.tenants(name) VALUES ($1) RETURNING id`, [n])).rows[0]!.id;
    const user = async () =>
      (await q<{ id: string }>(`INSERT INTO auth.users(email) VALUES ($1) RETURNING id`, [
        `acv_${Date.now()}_${Math.random().toString(36).slice(2, 10)}@example.com`,
      ])).rows[0]!.id;
    ids.tA = await tenant(`acv-A-${Date.now()}`);
    ids.tB = await tenant(`acv-B-${Date.now()}`);
    ids.uA = await user(); ids.uB = await user(); ids.mA = await user();
    await q(`INSERT INTO public.memberships(tenant_id, user_id, role) VALUES ($1,$2,'owner'),($3,$4,'owner'),($1,$5,'editor')`,
      [ids.tA, ids.uA, ids.tB, ids.uB, ids.mA]);
  });
  afterEach(async () => { await closeDb(ctx); ctx = null; });

  it('Client-Insert wird Entwurf mit fortlaufender Version', async () => {
    const a = await draft(ids.uA, ids.tA);
    const b = await draft(ids.uA, ids.tA);
    expect(a).toMatchObject({ version: 1, status: 'draft' });
    expect(b.version).toBe(2);
  });

  it('Editor (nicht Admin) und fremder Mandant dürfen keine Entwürfe anlegen', async () => {
    for (const [u, t] of [[ids.mA, ids.tA], [ids.uB, ids.tA]] as const) {
      await expect(as(u, () => q(`INSERT INTO public.agent_config_versions(tenant_id, agent_ref, section, config)
        VALUES ($1,'x','details','{}')`, [t]))).rejects.toThrow(denied);
    }
  });

  it('Mandantentrennung beim Lesen; anon sieht nichts', async () => {
    await draft(ids.uA, ids.tA);
    expect((await as(ids.mA, () => q(`SELECT 1 FROM public.agent_config_versions WHERE tenant_id=$1`, [ids.tA]))).rowCount).toBe(1);
    expect((await as(ids.uB, () => q(`SELECT 1 FROM public.agent_config_versions WHERE tenant_id=$1`, [ids.tA]))).rowCount).toBe(0);
    await expect(as(null, () => q(`SELECT 1 FROM public.agent_config_versions`), 'anon')).rejects.toThrow(denied);
  });

  it('Client kann Versionen weder ändern noch löschen', async () => {
    const a = await draft(ids.uA, ids.tA);
    const u = await as(ids.uA, () => q(`UPDATE public.agent_config_versions SET status='active' WHERE id=$1`, [a.id]))
      .catch((e: Error) => e);
    if (!(u instanceof Error)) expect(u.rowCount).toBe(0);
    const del = await as(ids.uA, () => q(`DELETE FROM public.agent_config_versions WHERE id=$1`, [a.id])).catch((e: Error) => e);
    if (!(del instanceof Error)) expect(del.rowCount).toBe(0);
    expect((await q(`SELECT status FROM public.agent_config_versions WHERE id=$1`, [a.id])).rows[0]).toEqual({ status: 'draft' });
  });

  it('Inhalt ist auch für privilegierte Rollen unveränderlich', async () => {
    const a = await draft(ids.uA, ids.tA);
    await q('SAVEPOINT imm');
    await expect(q(`UPDATE public.agent_config_versions SET config='{"x":1}' WHERE id=$1`, [a.id])).rejects.toThrow(/unveränderlich/);
    await q('ROLLBACK TO SAVEPOINT imm');
  });

  it('Aktivierung ohne Bestätigung / durch Member / fremden Owner abgelehnt', async () => {
    const a = await draft(ids.uA, ids.tA);
    await expect(as(ids.uA, () => q(`SELECT public.activate_agent_config_version($1,false)`, [a.id]))).rejects.toThrow(/Bestätigung/);
    await expect(as(ids.mA, () => q(`SELECT public.activate_agent_config_version($1,true)`, [a.id]))).rejects.toThrow(/Owner\/Admin/);
    await expect(as(ids.uB, () => q(`SELECT public.activate_agent_config_version($1,true)`, [a.id]))).rejects.toThrow(/Owner\/Admin/);
    await expect(as(null, () => q(`SELECT public.activate_agent_config_version($1,true)`, [a.id]), 'anon')).rejects.toThrow(/permission denied/);
  });

  it('Aktivierung ersetzt vorherige aktive Version und schreibt Audit', async () => {
    const a = await draft(ids.uA, ids.tA);
    const b = await draft(ids.uA, ids.tA, '{"role":"Lead"}');
    await asKeep(ids.uA, () => q(`SELECT public.activate_agent_config_version($1,true)`, [a.id]));
    const r = await asKeep(ids.uA, () => q<{ r: { superseded_id: string } }>(`SELECT public.activate_agent_config_version($1,true) r`, [b.id]));
    expect(r.rows[0]!.r.superseded_id).toBe(a.id);
    const st = await q<{ id: string; status: string }>(`SELECT id, status FROM public.agent_config_versions WHERE tenant_id=$1 ORDER BY version`, [ids.tA]);
    expect(st.rows.map((x) => x.status)).toEqual(['superseded', 'active']);
    const log = await q(`SELECT 1 FROM public.agent_actions_log WHERE tenant_id=$1 AND action_type='config_activate'`, [ids.tA]);
    expect(log.rowCount).toBe(2);
    await expect(as(ids.uA, () => q(`SELECT public.activate_agent_config_version($1,true)`, [a.id]))).rejects.toThrow(/nur Entwürfe/);
  });
});
