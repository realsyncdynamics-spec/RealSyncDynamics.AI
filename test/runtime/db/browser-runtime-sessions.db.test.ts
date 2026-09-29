/**
 * Governed Browser Runtime — Datenbankzusagen
 * (20260929100000_browser_runtime_governed_sessions.sql).
 *
 *   - browser_sessions: Mitglieder lesen nur den eigenen Mandanten, niemand
 *     außer service_role schreibt
 *   - browser_approval_bindings / browser_executor_status: für anon und
 *     authenticated unsichtbar (Fingerprint über unredigierte Aktion)
 *   - consume_browser_approval: genau ein Verbrauch, auch parallel; Ablauf,
 *     Ablehnung, falsche Session/Aktion/Mandant werden erkannt
 *   - finish_browser_approval: nur nach Verbrauch, genau einmal
 *   - erweiterte Status-/Aktionswerte werden angenommen, fremde abgewiesen
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { Client } from 'pg';
import { closeDb, createTenantWithMember, getDbUrl, openDb, requireDbOrFail, type DbCtx } from './db-helpers';

const d = requireDbOrFail('browser-runtime-sessions') ? describe : describe.skip;
const FP = `browser:v2:${'a'.repeat(64)}`;

async function pgCode(p: Promise<unknown>): Promise<string | null> {
  try { await p; return null; } catch (e) { return (e as { code?: string }).code ?? 'unknown'; }
}

/** Führt eine Anweisung in einem Savepoint aus — ein erwarteter Fehler bricht die Test-Transaktion nicht ab. */
async function sqlCode(c: Client, sql: string, params: unknown[] = []): Promise<string | null> {
  const sp = `sp_${Math.random().toString(36).slice(2, 10)}`;
  await c.query(`SAVEPOINT ${sp}`);
  try {
    await c.query(sql, params);
    await c.query(`RELEASE SAVEPOINT ${sp}`);
    return null;
  } catch (e) {
    await c.query(`ROLLBACK TO SAVEPOINT ${sp}`);
    return (e as { code?: string }).code ?? 'unknown';
  }
}

async function insertSession(c: Client, tenantId: string, userId: string, suffix = 'a'): Promise<string> {
  const { rows } = await c.query<{ id: string }>(
    `INSERT INTO public.browser_sessions (tenant_id, user_id, executor_session_id, status, expires_at)
     VALUES ($1, $2, $3, 'ready', now() + interval '15 minutes') RETURNING id`,
    [tenantId, userId, `rsx_${suffix.repeat(32)}_${Math.random().toString(36).slice(2, 8)}`],
  );
  return rows[0]!.id;
}

async function insertApproval(
  c: Client,
  tenantId: string,
  sessionId: string,
  opts: { status?: string; expiresIn?: string; fingerprint?: string } = {},
): Promise<string> {
  const { rows: ev } = await c.query<{ id: string }>(
    `INSERT INTO public.governance_events (tenant_id, event_type, event_source, title, risk_level, policy_action)
     VALUES ($1, 'browser.action.requested', 'agent_runtime', 'Browser-Aktion wartet auf Freigabe', 'high', 'require_approval')
     RETURNING id`, [tenantId]);
  const { rows } = await c.query<{ id: string }>(
    `INSERT INTO public.governance_approvals (tenant_id, event_id, status, requested_action, browser_session_id, expires_at)
     VALUES ($1, $2, $3, 'browser:click:#submit', $4, now() + $5::interval) RETURNING id`,
    [tenantId, ev[0]!.id, opts.status ?? 'pending', sessionId, opts.expiresIn ?? '15 minutes'],
  );
  await c.query(
    `INSERT INTO public.browser_approval_bindings (approval_id, tenant_id, browser_session_id, fingerprint, action_type, page_url)
     VALUES ($1, $2, $3, $4, 'click', 'https://example.com/')`,
    [rows[0]!.id, tenantId, sessionId, opts.fingerprint ?? FP],
  );
  return rows[0]!.id;
}

async function consume(c: Client, approvalId: string, tenantId: string, sessionId: string, fp = FP, consumer: string | null = null) {
  const { rows } = await c.query<{ code: string }>(
    `SELECT public.consume_browser_approval($1, $2, $3, $4, $5) AS code`,
    [approvalId, tenantId, sessionId, fp, consumer],
  );
  return rows[0]!.code;
}

d('Browser-Runtime · Sessions und Freigaben', () => {
  let ctx: DbCtx | null = null;
  beforeEach(async () => { ctx = await openDb(); });
  afterEach(async () => { await closeDb(ctx); ctx = null; });

  it('Mitglieder lesen nur Sessions des eigenen Mandanten', async () => {
    const a = await createTenantWithMember(ctx!);
    const b = await createTenantWithMember(ctx!);
    const sid = await insertSession(ctx!.client, a.tenantId, a.userId);
    const own = await ctx!.withClaims({ sub: a.userId, role: 'authenticated' }, async () =>
      (await ctx!.client.query('SELECT id FROM public.browser_sessions WHERE id = $1', [sid])).rowCount);
    const foreign = await ctx!.withClaims({ sub: b.userId, role: 'authenticated' }, async () =>
      (await ctx!.client.query('SELECT id FROM public.browser_sessions WHERE id = $1', [sid])).rowCount);
    expect(own).toBe(1);
    expect(foreign).toBe(0);
  });

  it('authenticated kann Sessions weder anlegen noch ändern noch löschen', async () => {
    const a = await createTenantWithMember(ctx!);
    const sid = await insertSession(ctx!.client, a.tenantId, a.userId);
    const insert = await pgCode(ctx!.withClaims({ sub: a.userId, role: 'authenticated' }, () =>
      ctx!.client.query(`INSERT INTO public.browser_sessions (tenant_id, user_id, executor_session_id, expires_at)
                         VALUES ($1, $2, 'rsx_bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb', now())`, [a.tenantId, a.userId])));
    const update = await pgCode(ctx!.withClaims({ sub: a.userId, role: 'authenticated' }, () =>
      ctx!.client.query(`UPDATE public.browser_sessions SET status = 'closed' WHERE id = $1`, [sid])));
    const del = await pgCode(ctx!.withClaims({ sub: a.userId, role: 'authenticated' }, () =>
      ctx!.client.query(`DELETE FROM public.browser_sessions WHERE id = $1`, [sid])));
    expect(insert).toBe('42501');
    expect(update).toBe('42501');
    expect(del).toBe('42501');
  });

  it('Bindungen und Executor-Status sind für anon/authenticated unsichtbar', async () => {
    const a = await createTenantWithMember(ctx!);
    const sid = await insertSession(ctx!.client, a.tenantId, a.userId);
    await insertApproval(ctx!.client, a.tenantId, sid);
    for (const role of ['authenticated', 'anon'] as const) {
      for (const table of ['browser_approval_bindings', 'browser_executor_status']) {
        const code = await pgCode(ctx!.withClaims({ sub: role === 'anon' ? undefined : a.userId, role }, () =>
          ctx!.client.query(`SELECT * FROM public.${table}`)));
        expect(code, `${role} → ${table}`).toBe('42501');
      }
    }
  });

  it('Verbrauch: pending → approved → genau einmal consumed → executed', async () => {
    const a = await createTenantWithMember(ctx!);
    const sid = await insertSession(ctx!.client, a.tenantId, a.userId);
    const ap = await insertApproval(ctx!.client, a.tenantId, sid);
    expect(await consume(ctx!.client, ap, a.tenantId, sid)).toBe('pending');
    await ctx!.client.query(`UPDATE public.governance_approvals SET status = 'approved' WHERE id = $1`, [ap]);
    expect(await consume(ctx!.client, ap, a.tenantId, sid, FP, a.userId)).toBe('consumed');
    expect(await consume(ctx!.client, ap, a.tenantId, sid)).toBe('already_used');
    const fin = await ctx!.client.query<{ ok: boolean }>(`SELECT public.finish_browser_approval($1, $2, 'executed') AS ok`, [ap, a.tenantId]);
    expect(fin.rows[0]!.ok).toBe(true);
    const again = await ctx!.client.query<{ ok: boolean }>(`SELECT public.finish_browser_approval($1, $2, 'failed') AS ok`, [ap, a.tenantId]);
    expect(again.rows[0]!.ok).toBe(false);
    const { rows } = await ctx!.client.query(`SELECT status, consumed_by FROM public.governance_approvals WHERE id = $1`, [ap]);
    expect(rows[0]).toEqual({ status: 'executed', consumed_by: a.userId });
  });

  it('finish ohne vorherigen Verbrauch ändert nichts', async () => {
    const a = await createTenantWithMember(ctx!);
    const sid = await insertSession(ctx!.client, a.tenantId, a.userId);
    const ap = await insertApproval(ctx!.client, a.tenantId, sid, { status: 'approved' });
    const fin = await ctx!.client.query<{ ok: boolean }>(`SELECT public.finish_browser_approval($1, $2, 'executed') AS ok`, [ap, a.tenantId]);
    expect(fin.rows[0]!.ok).toBe(false);
    expect(await sqlCode(ctx!.client, `SELECT public.finish_browser_approval($1, $2, 'approved')`, [ap, a.tenantId])).toBe('22023');
  });

  it('falsche Aktion, falsche Session, fremder Mandant, Ablauf, Ablehnung', async () => {
    const a = await createTenantWithMember(ctx!);
    const b = await createTenantWithMember(ctx!);
    const sid = await insertSession(ctx!.client, a.tenantId, a.userId, 'c');
    const other = await insertSession(ctx!.client, a.tenantId, a.userId, 'd');
    const ap = await insertApproval(ctx!.client, a.tenantId, sid, { status: 'approved' });
    expect(await consume(ctx!.client, ap, a.tenantId, sid, `browser:v2:${'b'.repeat(64)}`)).toBe('mismatch');
    expect(await consume(ctx!.client, ap, a.tenantId, other)).toBe('mismatch');
    expect(await consume(ctx!.client, ap, b.tenantId, sid)).toBe('not_found');

    const expired = await insertApproval(ctx!.client, a.tenantId, sid, { status: 'approved', expiresIn: '-1 minute' });
    expect(await consume(ctx!.client, expired, a.tenantId, sid)).toBe('expired');
    const { rows } = await ctx!.client.query(`SELECT status FROM public.governance_approvals WHERE id = $1`, [expired]);
    expect(rows[0]!.status).toBe('expired');

    const rejected = await insertApproval(ctx!.client, a.tenantId, sid, { status: 'rejected' });
    expect(await consume(ctx!.client, rejected, a.tenantId, sid)).toBe('rejected');
    const cancelled = await insertApproval(ctx!.client, a.tenantId, sid, { status: 'cancelled' });
    expect(await consume(ctx!.client, cancelled, a.tenantId, sid)).toBe('cancelled');
  });

  it('anon und authenticated haben kein EXECUTE auf consume/finish', async () => {
    const a = await createTenantWithMember(ctx!);
    for (const role of ['anon', 'authenticated'] as const) {
      const c1 = await pgCode(ctx!.withClaims({ sub: role === 'anon' ? undefined : a.userId, role }, () =>
        ctx!.client.query(`SELECT public.consume_browser_approval(gen_random_uuid(), $1, gen_random_uuid(), $2, NULL)`, [a.tenantId, FP])));
      const c2 = await pgCode(ctx!.withClaims({ sub: role === 'anon' ? undefined : a.userId, role }, () =>
        ctx!.client.query(`SELECT public.finish_browser_approval(gen_random_uuid(), $1, 'executed')`, [a.tenantId])));
      expect(c1, role).toBe('42501');
      expect(c2, role).toBe('42501');
    }
  });

  it('erweiterte Werte werden angenommen, fremde abgewiesen', async () => {
    const a = await createTenantWithMember(ctx!);
    const sid = await insertSession(ctx!.client, a.tenantId, a.userId);
    const ap = await insertApproval(ctx!.client, a.tenantId, sid);
    const c = ctx!.client;
    expect(await sqlCode(c, `UPDATE public.governance_approvals SET status = 'cancelled' WHERE id = $1`, [ap])).toBeNull();
    expect(await sqlCode(c, `UPDATE public.governance_approvals SET status = 'bogus' WHERE id = $1`, [ap])).toBe('23514');
    expect(await sqlCode(c, `UPDATE public.browser_sessions SET status = 'teleporting' WHERE id = $1`, [sid])).toBe('23514');
    expect(await sqlCode(c,
      `INSERT INTO public.browser_actions (tenant_id, session_id, browser_session_id, browser_action, status, policy_decision, risk_level)
       VALUES ($1, $2::text, $2::uuid, 'click', 'awaiting_approval', 'require_approval', 'high')`, [a.tenantId, sid])).toBeNull();
    expect(await sqlCode(c,
      `INSERT INTO public.browser_actions (tenant_id, session_id, browser_action, status) VALUES ($1, 'x', 'eval', 'started')`, [a.tenantId])).toBe('23514');
    // Vorschau-Ereignisse der alten Clients bleiben gültig.
    expect(await sqlCode(c,
      `INSERT INTO public.browser_actions (tenant_id, session_id, browser_action, status) VALUES ($1, 'bs_legacy', 'preview_load', 'completed')`, [a.tenantId])).toBeNull();
  });
});

d('Browser-Runtime · paralleler Verbrauch (zwei Verbindungen)', () => {
  it('genau ein Aufrufer gewinnt', async () => {
    const url = getDbUrl()!;
    const setup = new Client({ connectionString: url });
    await setup.connect();
    const tenantName = `bt_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    let tenantId = '';
    try {
      const { rows: t } = await setup.query<{ id: string }>(`INSERT INTO public.tenants(name) VALUES ($1) RETURNING id`, [tenantName]);
      tenantId = t[0]!.id;
      const { rows: u } = await setup.query<{ id: string }>(`INSERT INTO auth.users(email) VALUES ($1) RETURNING id`, [`${tenantName}@example.com`]);
      const userId = u[0]!.id;
      const sid = await insertSession(setup, tenantId, userId, 'e');
      const ap = await insertApproval(setup, tenantId, sid, { status: 'approved' });

      const c1 = new Client({ connectionString: url });
      const c2 = new Client({ connectionString: url });
      await Promise.all([c1.connect(), c2.connect()]);
      try {
        await c1.query('BEGIN');
        await c2.query('BEGIN');
        const first = await consume(c1, ap, tenantId, sid);
        // c2 wartet auf die Zeilensperre von c1 und sieht danach den Verbrauch.
        const secondPromise = consume(c2, ap, tenantId, sid);
        await new Promise((r) => setTimeout(r, 150));
        await c1.query('COMMIT');
        const second = await secondPromise;
        await c2.query('COMMIT');
        expect([first, second].sort()).toEqual(['already_used', 'consumed']);
      } finally {
        await Promise.all([c1.end(), c2.end()]);
      }
    } finally {
      if (tenantId) {
        // governance_approvals/-events haben keinen FK auf tenants — explizit aufräumen.
        await setup.query(`DELETE FROM public.governance_approvals WHERE tenant_id = $1`, [tenantId]);
        await setup.query(`DELETE FROM public.governance_events WHERE tenant_id = $1`, [tenantId]);
        await setup.query(`DELETE FROM public.tenants WHERE id = $1`, [tenantId]);
        await setup.query(`DELETE FROM auth.users WHERE email = $1`, [`${tenantName}@example.com`]);
      }
      await setup.end();
    }
  }, 20_000);
});
