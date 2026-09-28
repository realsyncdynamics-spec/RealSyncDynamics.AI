/**
 * Gate 2 · Finding-Status nur über public.set_finding_status
 * (20260928140000_gate2_finding_status_rpc.sql).
 *
 * Vorher: Der Client schrieb findings.status per UPDATE; ohne UPDATE-Policy
 * traf das unter RLS 0 Zeilen, ohne Fehler — die UI meldete Erfolg.
 *
 * Geprüft wird unter echten Rollen:
 *   - direktes UPDATE durch ein Mitglied ändert weiterhin nichts (keine
 *     breite Policy eingeführt)
 *   - Mitglied mit Schreibrolle: erlaubter Übergang wird gespeichert, mit
 *     Historie; unerlaubter Übergang scheitert
 *   - viewer_auditor, fremder Mandant, anon: scheitern, Zeile unverändert
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { closeDb, createTenantWithMember, openDb, requireDbOrFail, type DbCtx } from './db-helpers';

const d = requireDbOrFail('gate2-finding-status') ? describe : describe.skip;

type Rolle = 'anon' | 'authenticated';

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

async function finding(ctx: DbCtx, tenantId: string, status = 'open'): Promise<string> {
  const { rows } = await ctx.client.query<{ id: string }>(
    `INSERT INTO public.findings (tenant_id, category, severity, status, detector, summary)
     VALUES ($1, 'security', 'high', $2, 'gdpr-audit', 'HSTS fehlt') RETURNING id`,
    [tenantId, status],
  );
  return rows[0]!.id;
}

async function statusOf(ctx: DbCtx, id: string): Promise<string> {
  const { rows } = await ctx.client.query<{ status: string }>(`SELECT status FROM public.findings WHERE id = $1`, [id]);
  return rows[0]!.status;
}

async function pgCode(p: Promise<unknown>): Promise<string | null> {
  try { await p; return null; } catch (e) { return (e as { code?: string }).code ?? 'unknown'; }
}

d('Gate 2 · set_finding_status', () => {
  let ctx: DbCtx | null = null;
  beforeEach(async () => { ctx = await openDb(); });
  afterEach(async () => { await closeDb(ctx); ctx = null; });

  it('direktes UPDATE durch ein Mitglied bleibt wirkungslos', async () => {
    const a = await createTenantWithMember(ctx!);
    const id = await finding(ctx!, a.tenantId);
    // Je nach Grant-Stand: 0 Zeilen (RLS) oder 42501 (kein UPDATE-Recht) — beides ist „nichts geändert".
    const rowCount = await als(ctx!, 'authenticated', a.userId, () =>
      ctx!.client.query(`UPDATE public.findings SET status = 'fixed' WHERE id = $1`, [id]))
      .then((r) => r.rowCount, (e: { code?: string }) => (e.code === '42501' ? 0 : Promise.reject(e)));
    expect(rowCount).toBe(0);
    expect(await statusOf(ctx!, id)).toBe('open');
  });

  it('Owner: erlaubter Übergang wird gespeichert, mit Historie', async () => {
    const a = await createTenantWithMember(ctx!);
    const id = await finding(ctx!, a.tenantId);
    const { rows } = await als(ctx!, 'authenticated', a.userId, () =>
      ctx!.client.query<{ id: string; status: string }>(`SELECT * FROM public.set_finding_status($1, 'acknowledged')`, [id]));
    expect(rows).toEqual([expect.objectContaining({ id, status: 'acknowledged' })]);
    const { rows: after } = await ctx!.client.query<{ status: string; raw_payload: { status_history: Array<Record<string, unknown>> } }>(
      `SELECT status, raw_payload FROM public.findings WHERE id = $1`, [id]);
    expect(after[0]!.status).toBe('acknowledged');
    expect(after[0]!.raw_payload.status_history).toEqual([
      expect.objectContaining({ from: 'open', to: 'acknowledged', by: a.userId }),
    ]);
  });

  it('resolved setzt resolved_at, open setzt es zurück', async () => {
    const a = await createTenantWithMember(ctx!);
    const id = await finding(ctx!, a.tenantId, 'fixed');
    await als(ctx!, 'authenticated', a.userId, () =>
      ctx!.client.query(`SELECT public.set_finding_status($1, 'resolved')`, [id]));
    const r1 = await ctx!.client.query<{ resolved_at: string | null }>(`SELECT resolved_at FROM public.findings WHERE id = $1`, [id]);
    expect(r1.rows[0]!.resolved_at).not.toBeNull();
    await als(ctx!, 'authenticated', a.userId, () =>
      ctx!.client.query(`SELECT public.set_finding_status($1, 'open')`, [id]));
    const r2 = await ctx!.client.query<{ resolved_at: string | null }>(`SELECT resolved_at FROM public.findings WHERE id = $1`, [id]);
    expect(r2.rows[0]!.resolved_at).toBeNull();
  });

  it('unerlaubter Übergang scheitert (22023)', async () => {
    const a = await createTenantWithMember(ctx!);
    const id = await finding(ctx!, a.tenantId);
    const code = await pgCode(als(ctx!, 'authenticated', a.userId, () =>
      ctx!.client.query(`SELECT public.set_finding_status($1, 'resolved')`, [id])));
    expect(code).toBe('22023');
    expect(await statusOf(ctx!, id)).toBe('open');
  });

  it('fremder Mandant: nicht gefunden (P0002), Zeile unverändert', async () => {
    const a = await createTenantWithMember(ctx!);
    const b = await createTenantWithMember(ctx!);
    const id = await finding(ctx!, a.tenantId);
    const code = await pgCode(als(ctx!, 'authenticated', b.userId, () =>
      ctx!.client.query(`SELECT public.set_finding_status($1, 'acknowledged')`, [id])));
    expect(code).toBe('P0002');
    expect(await statusOf(ctx!, id)).toBe('open');
  });

  it('viewer_auditor darf lesen, aber nicht ändern (42501)', async () => {
    const a = await createTenantWithMember(ctx!);
    const { rows: u } = await ctx!.client.query<{ id: string }>(
      `INSERT INTO auth.users(email) VALUES ($1) RETURNING id`,
      [`viewer_${Date.now()}_${Math.random().toString(36).slice(2, 8)}@example.com`]);
    await ctx!.client.query(
      `INSERT INTO public.memberships(tenant_id, user_id, role) VALUES ($1, $2, 'viewer_auditor')`, [a.tenantId, u[0]!.id]);
    const id = await finding(ctx!, a.tenantId);
    const code = await pgCode(als(ctx!, 'authenticated', u[0]!.id, () =>
      ctx!.client.query(`SELECT public.set_finding_status($1, 'acknowledged')`, [id])));
    expect(code).toBe('42501');
    expect(await statusOf(ctx!, id)).toBe('open');
  });

  it('anon hat kein EXECUTE', async () => {
    const a = await createTenantWithMember(ctx!);
    const id = await finding(ctx!, a.tenantId);
    const code = await pgCode(als(ctx!, 'anon', null, () =>
      ctx!.client.query(`SELECT public.set_finding_status($1, 'acknowledged')`, [id])));
    expect(code).toBe('42501');
    expect(await statusOf(ctx!, id)).toBe('open');
  });
});
