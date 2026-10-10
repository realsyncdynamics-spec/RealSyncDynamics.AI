/**
 * Governed Browser Runtime — Datenbankzusagen
 * (20261010143814_browser_runtime_governed_sessions.sql, baut auf
 * 20260930190000_browser_execution_reservations.sql aus #1728 auf).
 *
 *   - browser_sessions: Mitglieder lesen nur den eigenen Mandanten, niemand
 *     außer service_role schreibt
 *   - Trigger browser_sessions_enforce_open_limit: höchstens 3 offene Sessions
 *     je Mandant — auch bei parallelen Anlagen (Advisory-Lock)
 *   - decide_governance_approval: Entscheidung und gekettete Evidence in EINER
 *     Transaktion; Ablauf nach Datenbankuhr; Zurückziehen einer erteilten
 *     Freigabe nur bis zur Einlösung; Kettenkopf-Konflikt rollt alles zurück
 *   - Einlösung bleibt allein bei reserve_browser_execution (#1728), mit dem
 *     HMAC-Fingerprint 'browser:v2:…' in requested_action
 *   - browser_executor_status und die RPCs: nicht für anon/authenticated
 */
import { createHash, randomUUID } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { Client } from 'pg';
import { closeDb, createTenantWithMember, getDbUrl, openDb, requireDbOrFail, type DbCtx } from './db-helpers';

const d = requireDbOrFail('browser-runtime-sessions') ? describe : describe.skip;
const FP = `browser:v2:${'a'.repeat(64)}`;

type Queryable = Pick<Client, 'query'>;

/** Führt eine Anweisung in einem Savepoint aus — ein erwarteter Fehler bricht die Test-Transaktion nicht ab. */
async function sqlError(c: Client, sql: string, params: unknown[] = []): Promise<{ code: string; detail?: string } | null> {
  const sp = `sp_${Math.random().toString(36).slice(2, 10)}`;
  await c.query(`SAVEPOINT ${sp}`);
  try {
    await c.query(sql, params);
    await c.query(`RELEASE SAVEPOINT ${sp}`);
    return null;
  } catch (e) {
    await c.query(`ROLLBACK TO SAVEPOINT ${sp}`);
    const err = e as { code?: string; detail?: string };
    return { code: err.code ?? 'unknown', ...(err.detail ? { detail: err.detail } : {}) };
  }
}

async function sqlCode(c: Client, sql: string, params: unknown[] = []): Promise<string | null> {
  return (await sqlError(c, sql, params))?.code ?? null;
}

/** Als echte Datenbankrolle (anon/authenticated) ausführen — Fehlercode oder null. */
async function asRole(c: Client, role: 'anon' | 'authenticated', userId: string | null, sql: string, params: unknown[] = []): Promise<string | null> {
  const sp = `sp_${Math.random().toString(36).slice(2, 10)}`;
  await c.query(`SAVEPOINT ${sp}`);
  try {
    await c.query(`SELECT set_config('request.jwt.claims', $1, true)`, [JSON.stringify({ sub: userId, role })]);
    await c.query(`SET LOCAL ROLE ${role}`);
    await c.query(sql, params);
    await c.query(`RELEASE SAVEPOINT ${sp}`);
    await c.query('RESET ROLE');
    return null;
  } catch (e) {
    await c.query(`ROLLBACK TO SAVEPOINT ${sp}`);
    await c.query('RESET ROLE');
    return (e as { code?: string }).code ?? 'unknown';
  }
}

async function insertSession(
  c: Queryable,
  tenantId: string,
  userId: string,
  opts: { status?: string; expiresIn?: string } = {},
): Promise<string> {
  const { rows } = await c.query<{ id: string }>(
    `INSERT INTO public.browser_sessions (tenant_id, user_id, executor_session_id, status, expires_at, closed_at)
     VALUES ($1, $2, $3, $4, now() + $5::interval, CASE WHEN $4 IN ('closed', 'failed') THEN now() END) RETURNING id`,
    [tenantId, userId, `rsx_${randomUUID().replace(/-/g, '')}`, opts.status ?? 'ready', opts.expiresIn ?? '15 minutes'],
  );
  return rows[0]!.id;
}

async function insertApproval(
  c: Queryable,
  tenantId: string,
  sessionId: string | null,
  opts: { status?: string; expiresIn?: string; fingerprint?: string } = {},
): Promise<{ id: string; eventId: string }> {
  const { rows: ev } = await c.query<{ id: string }>(
    `INSERT INTO public.governance_events (tenant_id, event_type, event_source, title, risk_level, policy_action)
     VALUES ($1, 'browser.action.requested', 'agent_runtime', 'Browser-Aktion wartet auf Freigabe', 'high', 'require_approval')
     RETURNING id`, [tenantId]);
  const { rows } = await c.query<{ id: string }>(
    `INSERT INTO public.governance_approvals (tenant_id, event_id, status, requested_action, browser_session_id, expires_at)
     VALUES ($1, $2, $3, $4, $5, now() + $6::interval) RETURNING id`,
    [tenantId, ev[0]!.id, opts.status ?? 'pending', opts.fingerprint ?? FP, sessionId, opts.expiresIn ?? '15 minutes'],
  );
  return { id: rows[0]!.id, eventId: ev[0]!.id };
}

async function chainHead(c: Queryable, tenantId: string): Promise<string | null> {
  const { rows } = await c.query<{ content_hash: string }>(
    `SELECT content_hash FROM public.governance_evidence
      WHERE tenant_id = $1 AND content_hash IS NOT NULL
      ORDER BY created_at DESC, id DESC LIMIT 1`, [tenantId]);
  return rows[0]?.content_hash ?? null;
}

function evidenceRow(tenantId: string, eventId: string | null, previousHash: string | null): Record<string, unknown> {
  const id = randomUUID();
  return {
    id,
    tenant_id: tenantId,
    event_id: eventId,
    evidence_type: 'approval',
    title: 'Approval decision',
    content_hash: createHash('sha256').update(`${id}:${previousHash ?? ''}`).digest('hex'),
    previous_hash: previousHash,
    metadata: { snapshot: { kind: 'approval.decision', previous_hash: previousHash, evidence_id: id } },
  };
}

interface Decision { outcome: string; evidence_id: string | null; approval_status: string | null }

async function decide(
  c: Queryable,
  approval: { id: string; eventId: string },
  tenantId: string,
  userId: string,
  target: 'approved' | 'rejected' | 'cancelled',
  opts: { expectedHead?: string | null; reason?: string | null } = {},
): Promise<Decision> {
  const head = opts.expectedHead !== undefined ? opts.expectedHead : await chainHead(c, tenantId);
  const { rows } = await c.query<Decision>(
    `SELECT * FROM public.decide_governance_approval($1, $2, $3, $4, $5, now(), $6::jsonb, $7)`,
    [approval.id, tenantId, userId, target, opts.reason ?? null, JSON.stringify(evidenceRow(tenantId, approval.eventId, head)), head],
  );
  return rows[0]!;
}

async function statusOf(c: Queryable, approvalId: string): Promise<string> {
  const { rows } = await c.query<{ status: string }>(`SELECT status FROM public.governance_approvals WHERE id = $1`, [approvalId]);
  return rows[0]!.status;
}

async function evidenceCount(c: Queryable, tenantId: string): Promise<number> {
  const { rows } = await c.query<{ n: number }>(`SELECT count(*)::int AS n FROM public.governance_evidence WHERE tenant_id = $1`, [tenantId]);
  return rows[0]!.n;
}

d('Browser-Runtime · Sessions', () => {
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

  it('authenticated kann Sessions weder anlegen noch ändern noch löschen; anon sieht nichts', async () => {
    const a = await createTenantWithMember(ctx!);
    const sid = await insertSession(ctx!.client, a.tenantId, a.userId);
    const c = ctx!.client;
    expect(await asRole(c, 'authenticated', a.userId,
      `INSERT INTO public.browser_sessions (tenant_id, user_id, executor_session_id, expires_at)
       VALUES ($1, $2, 'rsx_bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb', now())`, [a.tenantId, a.userId])).toBe('42501');
    expect(await asRole(c, 'authenticated', a.userId, `UPDATE public.browser_sessions SET status = 'closed' WHERE id = $1`, [sid])).toBe('42501');
    expect(await asRole(c, 'authenticated', a.userId, `DELETE FROM public.browser_sessions WHERE id = $1`, [sid])).toBe('42501');
    expect(await asRole(c, 'anon', null, `SELECT * FROM public.browser_sessions`)).toBe('42501');
  });

  it('Executor-Status ist für anon und authenticated unsichtbar', async () => {
    const a = await createTenantWithMember(ctx!);
    const c = ctx!.client;
    expect(await asRole(c, 'authenticated', a.userId, `SELECT * FROM public.browser_executor_status`)).toBe('42501');
    expect(await asRole(c, 'anon', null, `SELECT * FROM public.browser_executor_status`)).toBe('42501');
  });

  it('höchstens 3 offene Sessions je Mandant; geschlossene, fehlgeschlagene und abgelaufene zählen nicht', async () => {
    const a = await createTenantWithMember(ctx!);
    const b = await createTenantWithMember(ctx!);
    const c = ctx!.client;
    await insertSession(c, a.tenantId, a.userId, { status: 'closed' });
    await insertSession(c, a.tenantId, a.userId, { status: 'failed' });
    await insertSession(c, a.tenantId, a.userId, { expiresIn: '-1 minute' });
    for (let i = 0; i < 3; i += 1) await insertSession(c, a.tenantId, a.userId);
    const blocked = await sqlError(c,
      `INSERT INTO public.browser_sessions (tenant_id, user_id, executor_session_id, status, expires_at)
       VALUES ($1, $2, $3, 'ready', now() + interval '15 minutes')`, [a.tenantId, a.userId, `rsx_${'z'.repeat(32)}`]);
    expect(blocked).toEqual({ code: 'P0001', detail: 'BROWSER_SESSION_LIMIT_REACHED' });
    // Anderer Mandant unberührt.
    await expect(insertSession(c, b.tenantId, b.userId)).resolves.toBeTruthy();
  });

  it('Trigger-Funktion ist nicht direkt aufrufbar', async () => {
    const a = await createTenantWithMember(ctx!);
    expect(await asRole(ctx!.client, 'authenticated', a.userId, `SELECT public.browser_sessions_enforce_open_limit()`)).not.toBeNull();
  });
});

d('Browser-Runtime · Freigabe-Entscheidung (decide_governance_approval)', () => {
  let ctx: DbCtx | null = null;
  beforeEach(async () => { ctx = await openDb(); });
  afterEach(async () => { await closeDb(ctx); ctx = null; });

  it('entscheidet und schreibt die gekettete Evidence in derselben Transaktion', async () => {
    const a = await createTenantWithMember(ctx!);
    const c = ctx!.client;
    const sid = await insertSession(c, a.tenantId, a.userId);
    const ap = await insertApproval(c, a.tenantId, sid);
    const out = await decide(c, ap, a.tenantId, a.userId, 'approved', { reason: 'passt' });
    expect(out.outcome).toBe('decided');
    expect(out.approval_status).toBe('approved');
    const { rows } = await c.query(
      `SELECT status, resolved_by, resolution_reason, resolved_at IS NOT NULL AS resolved FROM public.governance_approvals WHERE id = $1`, [ap.id]);
    expect(rows[0]).toEqual({ status: 'approved', resolved_by: a.userId, resolution_reason: 'passt', resolved: true });
    const ev = await c.query(`SELECT event_id, evidence_type FROM public.governance_evidence WHERE id = $1`, [out.evidence_id]);
    expect(ev.rows[0]).toEqual({ event_id: ap.eventId, evidence_type: 'approval' });
  });

  it('bereits entschieden: keine zweite Entscheidung, keine zweite Evidence', async () => {
    const a = await createTenantWithMember(ctx!);
    const c = ctx!.client;
    const ap = await insertApproval(c, a.tenantId, null);
    expect((await decide(c, ap, a.tenantId, a.userId, 'rejected', { reason: 'nein' })).outcome).toBe('decided');
    const before = await evidenceCount(c, a.tenantId);
    expect(await decide(c, ap, a.tenantId, a.userId, 'approved')).toEqual({ outcome: 'already_resolved', evidence_id: null, approval_status: 'rejected' });
    expect(await evidenceCount(c, a.tenantId)).toBe(before);
  });

  it('Ablauf nach Datenbankuhr: Status expired, keine Evidence, keine Entscheidung', async () => {
    const a = await createTenantWithMember(ctx!);
    const c = ctx!.client;
    const ap = await insertApproval(c, a.tenantId, null, { expiresIn: '-1 second' });
    expect(await decide(c, ap, a.tenantId, a.userId, 'approved')).toEqual({ outcome: 'expired', evidence_id: null, approval_status: 'expired' });
    expect(await statusOf(c, ap.id)).toBe('expired');
    expect(await evidenceCount(c, a.tenantId)).toBe(0);
  });

  it('Zurückziehen einer erteilten Freigabe geht nur bis zur Einlösung', async () => {
    const a = await createTenantWithMember(ctx!);
    const c = ctx!.client;
    const unused = await insertApproval(c, a.tenantId, null, { status: 'approved' });
    expect((await decide(c, unused, a.tenantId, a.userId, 'cancelled', { reason: 'withdrawn by requester' })).outcome).toBe('decided');
    expect(await statusOf(c, unused.id)).toBe('cancelled');

    const used = await insertApproval(c, a.tenantId, null, { status: 'approved' });
    const { rows } = await c.query<{ outcome: string }>(`SELECT * FROM public.reserve_browser_execution($1, $2, $3)`, [a.tenantId, used.id, FP]);
    expect(rows[0]!.outcome).toBe('reserved');
    expect(await decide(c, used, a.tenantId, a.userId, 'cancelled')).toMatchObject({ outcome: 'already_resolved', approval_status: 'approved' });
    expect(await statusOf(c, used.id)).toBe('approved');
    // Freigeben/Ablehnen einer erteilten Freigabe gibt es nicht.
    const other = await insertApproval(c, a.tenantId, null, { status: 'approved' });
    expect((await decide(c, other, a.tenantId, a.userId, 'rejected', { reason: 'x' })).outcome).toBe('already_resolved');
  });

  it('Kettenkopf bewegt: alles zurückgerollt (40001), Freigabe bleibt offen', async () => {
    const a = await createTenantWithMember(ctx!);
    const c = ctx!.client;
    const first = await insertApproval(c, a.tenantId, null);
    expect((await decide(c, first, a.tenantId, a.userId, 'approved')).outcome).toBe('decided');
    const ap = await insertApproval(c, a.tenantId, null);
    const stale = null; // Kopf ist inzwischen der Hash der ersten Entscheidung
    const err = await sqlError(c,
      `SELECT * FROM public.decide_governance_approval($1, $2, $3, 'approved', NULL, now(), $4::jsonb, $5)`,
      [ap.id, a.tenantId, a.userId, JSON.stringify(evidenceRow(a.tenantId, ap.eventId, stale)), stale]);
    expect(err?.code).toBe('40001');
    expect(await statusOf(c, ap.id)).toBe('pending');
    expect(await evidenceCount(c, a.tenantId)).toBe(1);
  });

  it('fremder Mandant, fremde Evidence und ungültiges Ziel', async () => {
    const a = await createTenantWithMember(ctx!);
    const b = await createTenantWithMember(ctx!);
    const c = ctx!.client;
    const ap = await insertApproval(c, a.tenantId, null);
    expect(await decide(c, ap, b.tenantId, b.userId, 'approved')).toEqual({ outcome: 'not_found', evidence_id: null, approval_status: null });
    expect(await sqlCode(c,
      `SELECT * FROM public.decide_governance_approval($1, $2, $3, 'approved', NULL, now(), $4::jsonb, NULL)`,
      [ap.id, a.tenantId, a.userId, JSON.stringify(evidenceRow(b.tenantId, null, null))])).toBe('22023');
    expect(await sqlCode(c,
      `SELECT * FROM public.decide_governance_approval($1, $2, $3, 'expired', NULL, now(), $4::jsonb, NULL)`,
      [ap.id, a.tenantId, a.userId, JSON.stringify(evidenceRow(a.tenantId, null, null))])).toBe('22023');
    expect(await statusOf(c, ap.id)).toBe('pending');
  });

  it('anon und authenticated haben kein EXECUTE auf Entscheidung, Einlösung und Abschluss', async () => {
    const a = await createTenantWithMember(ctx!);
    const c = ctx!.client;
    const calls = [
      [`SELECT * FROM public.decide_governance_approval(gen_random_uuid(), $1, $2, 'approved', NULL, now(), '{}'::jsonb, NULL)`, [a.tenantId, a.userId]],
      [`SELECT * FROM public.reserve_browser_execution($1, gen_random_uuid(), $2)`, [a.tenantId, FP]],
      [`SELECT public.finish_browser_execution(gen_random_uuid(), 'executed', NULL)`, []],
    ] as const;
    for (const role of ['anon', 'authenticated'] as const) {
      for (const [sql, params] of calls) {
        expect(await asRole(c, role, role === 'anon' ? null : a.userId, sql, [...params]), `${role}: ${sql.slice(0, 50)}`).toBe('42501');
      }
    }
  });

  it('Einlösung mit HMAC-Fingerprint: passender wird reserviert, anderer abgewiesen', async () => {
    const a = await createTenantWithMember(ctx!);
    const c = ctx!.client;
    const sid = await insertSession(c, a.tenantId, a.userId);
    const ap = await insertApproval(c, a.tenantId, sid, { fingerprint: FP });
    expect((await decide(c, ap, a.tenantId, a.userId, 'approved')).outcome).toBe('decided');
    const wrong = await c.query<{ outcome: string }>(`SELECT * FROM public.reserve_browser_execution($1, $2, $3)`, [a.tenantId, ap.id, `browser:v2:${'b'.repeat(64)}`]);
    expect(wrong.rows[0]!.outcome).toBe('mismatch');
    const right = await c.query<{ outcome: string; execution_id: string }>(`SELECT * FROM public.reserve_browser_execution($1, $2, $3)`, [a.tenantId, ap.id, FP]);
    expect(right.rows[0]!.outcome).toBe('reserved');
    // Aktions-Log darf auf die Einlösung zeigen.
    expect(await sqlCode(c,
      `INSERT INTO public.browser_actions (tenant_id, session_id, browser_session_id, approval_id, browser_execution_id, browser_action, status, policy_decision, risk_level, verification)
       VALUES ($1, $2::text, $2::uuid, $3, $4, 'click', 'completed', 'require_approval', 'high', 'passed')`,
      [a.tenantId, sid, ap.id, right.rows[0]!.execution_id])).toBeNull();
  });

  it('Status-/Aktionswerte: erweiterte angenommen, fremde und alte Verbrauchsstatus abgewiesen', async () => {
    const a = await createTenantWithMember(ctx!);
    const c = ctx!.client;
    const sid = await insertSession(c, a.tenantId, a.userId);
    const ap = await insertApproval(c, a.tenantId, sid);
    expect(await sqlCode(c, `UPDATE public.governance_approvals SET status = 'cancelled' WHERE id = $1`, [ap.id])).toBeNull();
    for (const bogus of ['executed', 'failed', 'bogus']) {
      expect(await sqlCode(c, `UPDATE public.governance_approvals SET status = $2 WHERE id = $1`, [ap.id, bogus]), bogus).toBe('23514');
    }
    expect(await sqlCode(c, `UPDATE public.browser_sessions SET status = 'teleporting' WHERE id = $1`, [sid])).toBe('23514');
    expect(await sqlCode(c, `UPDATE public.browser_sessions SET last_error_code = 'free text with input 4711' WHERE id = $1`, [sid])).toBe('23514');
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

d('Browser-Runtime · Parallelität (zwei Verbindungen)', () => {
  async function withTenant(fn: (setup: Client, tenantId: string, userId: string, url: string) => Promise<void>): Promise<void> {
    const url = getDbUrl()!;
    const setup = new Client({ connectionString: url });
    await setup.connect();
    const tenantName = `bt_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    let tenantId = '';
    try {
      const { rows: t } = await setup.query<{ id: string }>(`INSERT INTO public.tenants(name) VALUES ($1) RETURNING id`, [tenantName]);
      tenantId = t[0]!.id;
      const { rows: u } = await setup.query<{ id: string }>(`INSERT INTO auth.users(email) VALUES ($1) RETURNING id`, [`${tenantName}@example.com`]);
      await fn(setup, tenantId, u[0]!.id, url);
    } finally {
      if (tenantId) {
        // governance_approvals/-events/-evidence haben keinen FK auf tenants — explizit aufräumen.
        await setup.query(`DELETE FROM public.browser_executions WHERE tenant_id = $1`, [tenantId]);
        await setup.query(`DELETE FROM public.governance_approvals WHERE tenant_id = $1`, [tenantId]);
        await setup.query(`DELETE FROM public.governance_evidence WHERE tenant_id = $1`, [tenantId]);
        await setup.query(`DELETE FROM public.governance_events WHERE tenant_id = $1`, [tenantId]);
        await setup.query(`DELETE FROM public.tenants WHERE id = $1`, [tenantId]);
        await setup.query(`DELETE FROM auth.users WHERE email = $1`, [`${tenantName}@example.com`]);
      }
      await setup.end();
    }
  }

  it('Session-Limit: zwei gleichzeitige Anlagen am Limit → genau eine gelingt', async () => {
    await withTenant(async (setup, tenantId, userId, url) => {
      await insertSession(setup, tenantId, userId);
      await insertSession(setup, tenantId, userId);
      const c1 = new Client({ connectionString: url });
      const c2 = new Client({ connectionString: url });
      await Promise.all([c1.connect(), c2.connect()]);
      try {
        await c1.query('BEGIN');
        await c2.query('BEGIN');
        await insertSession(c1, tenantId, userId); // hält den Advisory-Lock bis COMMIT
        const second = insertSession(c2, tenantId, userId).then(() => 'ok', (e: { code?: string; detail?: string }) => `${e.code}:${e.detail}`);
        await new Promise((r) => setTimeout(r, 150));
        await c1.query('COMMIT');
        expect(await second).toBe('P0001:BROWSER_SESSION_LIMIT_REACHED');
        await c2.query('ROLLBACK');
        const { rows } = await setup.query<{ n: number }>(`SELECT count(*)::int AS n FROM public.browser_sessions WHERE tenant_id = $1`, [tenantId]);
        expect(rows[0]!.n).toBe(3);
      } finally {
        await Promise.all([c1.end(), c2.end()]);
      }
    });
  }, 20_000);

  it('Zurückziehen und Einlösen gleichzeitig: genau eines gewinnt', async () => {
    await withTenant(async (setup, tenantId, userId, url) => {
      const ap = await insertApproval(setup, tenantId, null, { status: 'approved' });
      const c1 = new Client({ connectionString: url });
      const c2 = new Client({ connectionString: url });
      await Promise.all([c1.connect(), c2.connect()]);
      try {
        await c1.query('BEGIN');
        await c2.query('BEGIN');
        const reserved = await c1.query<{ outcome: string }>(`SELECT * FROM public.reserve_browser_execution($1, $2, $3)`, [tenantId, ap.id, FP]);
        // c2 wartet auf die Zeilensperre der Einlösung und sieht danach die Ausführung.
        const cancel = decide(c2, ap, tenantId, userId, 'cancelled');
        await new Promise((r) => setTimeout(r, 150));
        await c1.query('COMMIT');
        const out = await cancel;
        await c2.query('COMMIT');
        expect(reserved.rows[0]!.outcome).toBe('reserved');
        expect(out).toMatchObject({ outcome: 'already_resolved', approval_status: 'approved' });
        expect(await statusOf(setup, ap.id)).toBe('approved');
      } finally {
        await Promise.all([c1.end(), c2.end()]);
      }
    });
  }, 20_000);
});
