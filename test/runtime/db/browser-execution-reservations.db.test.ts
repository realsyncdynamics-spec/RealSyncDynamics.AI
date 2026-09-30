/**
 * Browser-Runtime · Freigaben genau einmal ausführen
 * (20260930190000_browser_execution_reservations.sql, PR #1728).
 *
 * Befund: browser-execute erkannte eine verbrauchte Freigabe erst an der
 * Evidence-Zeile NACH dem Executor. Parallele Requests und Retries nach einer
 * gescheiterten Persistenz konnten dieselbe Mutation erneut ausführen, und
 * expires_at wurde nie geprüft. Geprüft wird hier die Datenbankseite:
 *   - zwei gleichzeitige Reservierungen derselben Freigabe → genau eine gewinnt
 *   - abgelaufene Freigabe (expires_at in der DB) → keine Reservierung
 *   - nach executed / executed_unrecorded / executor_failed / reserved bleibt
 *     jeder weitere Versuch blockiert
 *   - Statuswechsel nur aus 'reserved', nie zurück
 *   - Mandant, Status und Fingerprint werden geprüft
 *   - anon und authenticated haben weder EXECUTE noch Tabellenzugriff
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { Client } from 'pg';
import { closeDb, createTenantWithMember, getDbUrl, openDb, requireDbOrFail, type DbCtx } from './db-helpers';

const d = requireDbOrFail('browser-execution-reservations') ? describe : describe.skip;

const FP = 'browser:v1:test-fingerprint';

interface Reservation {
  outcome: string;
  execution_id: string | null;
  execution_status: string | null;
  approval_status: string | null;
}

type Queryable = Pick<Client, 'query'>;

async function approval(
  db: Queryable,
  tenantId: string,
  opts: { status?: string; expiresSql?: string; fingerprint?: string } = {},
): Promise<string> {
  const ev = await db.query<{ id: string }>(
    `INSERT INTO public.governance_events (tenant_id, event_type, event_source, title, risk_level)
     VALUES ($1, 'browser.action.requested', 'agent_runtime', 'test', 'high') RETURNING id`,
    [tenantId],
  );
  const ap = await db.query<{ id: string }>(
    `INSERT INTO public.governance_approvals (tenant_id, event_id, status, requested_action, expires_at)
     VALUES ($1, $2, $3, $4, ${opts.expiresSql ?? `now() + interval '1 day'`}) RETURNING id`,
    [tenantId, ev.rows[0]!.id, opts.status ?? 'approved', opts.fingerprint ?? FP],
  );
  return ap.rows[0]!.id;
}

async function reserve(db: Queryable, tenantId: string, approvalId: string, fp = FP): Promise<Reservation> {
  const { rows } = await db.query<Reservation>(
    `SELECT * FROM public.reserve_browser_execution($1, $2, $3)`, [tenantId, approvalId, fp]);
  return rows[0]!;
}

async function finish(db: Queryable, executionId: string, status: string): Promise<boolean> {
  const { rows } = await db.query<{ ok: boolean }>(
    `SELECT public.finish_browser_execution($1, $2, 'test') AS ok`, [executionId, status]);
  return rows[0]!.ok;
}

async function pgCode(p: Promise<unknown>): Promise<string | null> {
  try { await p; return null; } catch (e) { return (e as { code?: string }).code ?? 'unknown'; }
}

d('browser_executions · reserve_browser_execution', () => {
  let ctx: DbCtx | null = null;
  beforeEach(async () => { ctx = await openDb(); });
  afterEach(async () => { await closeDb(ctx); ctx = null; });

  it('reserviert eine gültige Freigabe genau einmal', async () => {
    const t = await createTenantWithMember(ctx!);
    const id = await approval(ctx!.client, t.tenantId);

    const first = await reserve(ctx!.client, t.tenantId, id);
    expect(first.outcome).toBe('reserved');
    expect(first.execution_id).not.toBeNull();

    const second = await reserve(ctx!.client, t.tenantId, id);
    expect(second).toMatchObject({ outcome: 'already_used', execution_status: 'reserved' });
  });

  it('abgelaufene Freigabe (expires_at in der Vergangenheit) → keine Reservierung', async () => {
    const t = await createTenantWithMember(ctx!);
    const id = await approval(ctx!.client, t.tenantId, { expiresSql: `now() - interval '1 minute'` });

    expect((await reserve(ctx!.client, t.tenantId, id)).outcome).toBe('expired');
    const { rows } = await ctx!.client.query(
      `SELECT 1 FROM public.browser_executions WHERE approval_id = $1`, [id]);
    expect(rows).toHaveLength(0);
  });

  it.each(['executed', 'executed_unrecorded', 'executor_failed'])(
    'nach %s bleibt jeder weitere Versuch blockiert',
    async (endStatus) => {
      const t = await createTenantWithMember(ctx!);
      const id = await approval(ctx!.client, t.tenantId);
      const r = await reserve(ctx!.client, t.tenantId, id);
      expect(await finish(ctx!.client, r.execution_id!, endStatus)).toBe(true);

      expect(await reserve(ctx!.client, t.tenantId, id))
        .toMatchObject({ outcome: 'already_used', execution_status: endStatus });
    },
  );

  it('Statuswechsel nur aus reserved — kein Endstatus wird überschrieben oder zurückgesetzt', async () => {
    const t = await createTenantWithMember(ctx!);
    const id = await approval(ctx!.client, t.tenantId);
    const r = await reserve(ctx!.client, t.tenantId, id);

    expect(await finish(ctx!.client, r.execution_id!, 'executed_unrecorded')).toBe(true);
    expect(await finish(ctx!.client, r.execution_id!, 'executed')).toBe(false);
    expect(await pgCode(finish(ctx!.client, r.execution_id!, 'reserved'))).toBe('22023');

    const { rows } = await ctx!.client.query<{ status: string }>(
      `SELECT status FROM public.browser_executions WHERE id = $1`, [r.execution_id]);
    expect(rows[0]!.status).toBe('executed_unrecorded');
  });

  it('prüft Mandant, Status und Fingerprint', async () => {
    const a = await createTenantWithMember(ctx!);
    const b = await createTenantWithMember(ctx!);

    const fremd = await approval(ctx!.client, a.tenantId);
    expect((await reserve(ctx!.client, b.tenantId, fremd)).outcome).toBe('not_found');

    const offen = await approval(ctx!.client, a.tenantId, { status: 'pending' });
    expect(await reserve(ctx!.client, a.tenantId, offen))
      .toMatchObject({ outcome: 'not_approved', approval_status: 'pending' });

    const andere = await approval(ctx!.client, a.tenantId);
    expect((await reserve(ctx!.client, a.tenantId, andere, 'browser:v1:other')).outcome).toBe('mismatch');

    const { rows } = await ctx!.client.query(
      `SELECT 1 FROM public.browser_executions WHERE tenant_id IN ($1, $2)`, [a.tenantId, b.tenantId]);
    expect(rows).toHaveLength(0);
  });

  it('anon und authenticated haben kein EXECUTE und keinen Tabellenzugriff', async () => {
    const t = await createTenantWithMember(ctx!);
    const id = await approval(ctx!.client, t.tenantId);
    for (const rolle of ['anon', 'authenticated'] as const) {
      await ctx!.client.query(`SAVEPOINT sp_${rolle}`);
      await ctx!.client.query(`SELECT set_config('request.jwt.claims', $1, true)`, [
        JSON.stringify({ sub: rolle === 'anon' ? null : t.userId, role: rolle }),
      ]);
      await ctx!.client.query(`SET LOCAL ROLE ${rolle}`);
      const rpc = await pgCode(reserve(ctx!.client, t.tenantId, id));
      await ctx!.client.query(`ROLLBACK TO SAVEPOINT sp_${rolle}`);
      await ctx!.client.query(`SET LOCAL ROLE ${rolle}`);
      const tabelle = await pgCode(ctx!.client.query(`SELECT 1 FROM public.browser_executions`));
      await ctx!.client.query(`ROLLBACK TO SAVEPOINT sp_${rolle}`);
      await ctx!.client.query(`RESET ROLE`);
      expect(rpc).toBe('42501');
      expect(tabelle).toBe('42501');
    }
  });
});

d('browser_executions · zwei gleichzeitige Reservierungen', () => {
  /**
   * Braucht zwei echte Verbindungen und festgeschriebene Fixtures — die
   * Zeilensperre wirkt zwischen Transaktionen, nicht innerhalb einer. Die
   * Fixtures werden im finally wieder entfernt.
   */
  it('A hält die Sperre, B wartet → genau eine Reservierung gewinnt', async () => {
    const url = getDbUrl()!;
    const admin = new Client({ connectionString: url });
    const a = new Client({ connectionString: url });
    const b = new Client({ connectionString: url });
    await Promise.all([admin.connect(), a.connect(), b.connect()]);

    const suffix = Math.random().toString(36).slice(2, 8);
    let tenantId: string | null = null;
    let userId: string | null = null;
    try {
      const t = await admin.query<{ id: string }>(`INSERT INTO public.tenants (name) VALUES ($1) RETURNING id`, [`race_${suffix}`]);
      const tid: string = t.rows[0]!.id;
      tenantId = tid;
      const u = await admin.query<{ id: string }>(`INSERT INTO auth.users (email) VALUES ($1) RETURNING id`, [`race_${suffix}@example.com`]);
      userId = u.rows[0]!.id;
      const approvalId = await approval(admin, tid);

      await a.query('BEGIN');
      const ra = await reserve(a, tid, approvalId);
      expect(ra.outcome).toBe('reserved');

      const bVersuch = reserve(b, tid, approvalId);
      await new Promise((r) => setTimeout(r, 300));
      await a.query('COMMIT');

      expect(await bVersuch).toMatchObject({ outcome: 'already_used', execution_status: 'reserved' });
      const { rows } = await admin.query<{ n: string }>(
        `SELECT count(*)::text AS n FROM public.browser_executions WHERE approval_id = $1`, [approvalId]);
      expect(Number(rows[0]!.n)).toBe(1);
    } finally {
      try { await a.query('ROLLBACK'); } catch { /* bereits beendet */ }
      if (tenantId) {
        await admin.query(`DELETE FROM public.browser_executions WHERE tenant_id = $1`, [tenantId]);
        await admin.query(`DELETE FROM public.governance_approvals WHERE tenant_id = $1`, [tenantId]);
        await admin.query(`DELETE FROM public.governance_events WHERE tenant_id = $1`, [tenantId]);
        await admin.query(`DELETE FROM public.tenants WHERE id = $1`, [tenantId]);
      }
      if (userId) await admin.query(`DELETE FROM auth.users WHERE id = $1`, [userId]);
      await Promise.all([admin.end(), a.end(), b.end()]);
    }
  });
});
