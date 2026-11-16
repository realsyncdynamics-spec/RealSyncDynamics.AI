/**
 * workspace_events / workspace_approvals — echtes Postgres (TEST_DB_URL).
 * Prüft Idempotenz, Quellenbindung des Schlüssels, Mandantentrennung (RLS),
 * Admin-Entscheidung und die einmalige, an payload_hash gebundene Einlösung.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { closeDb, openDb, requireDbOrFail, type DbCtx } from './db-helpers';

const d = requireDbOrFail('workspace-events') ? describe : describe.skip;
const HASH = 'a'.repeat(64);
const OTHER_HASH = 'b'.repeat(64);

d('workspace_events · Eingang, RLS, Freigaben', () => {
  let ctx: DbCtx | null = null;
  const ids = {} as { tA: string; tB: string; uA: string; uB: string; uViewer: string; kA: string; kSdk: string };
  const q = <T extends Record<string, unknown> = Record<string, unknown>>(sql: string, p: unknown[] = []) =>
    ctx!.client.query<T>(sql, p);

  async function as<T>(sub: string, fn: () => Promise<T>): Promise<T> {
    const sp = `sp_${Math.random().toString(36).slice(2, 10)}`;
    await q(`SAVEPOINT ${sp}`);
    try {
      await q(`SELECT set_config('request.jwt.claims', $1, true)`, [JSON.stringify({ sub, role: 'authenticated' })]);
      await q(`SET LOCAL ROLE authenticated`);
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
  const ingest = (eventId: string, action: string, decision: string, key = ids.kA, tenant = ids.tA, hash = HASH) =>
    q<{ event_row_id: string; duplicate: boolean; approval_id: string | null; approval_status: string | null }>(
      `SELECT * FROM public.ingest_workspace_event($1,$2,$3,'RSD-01','gmail.message.received','msg-1',$4,$5,$6,'{}'::jsonb)`,
      [tenant, key, eventId, action, decision, hash],
    );

  beforeEach(async () => {
    ctx = await openDb();
    const tenant = async (n: string) =>
      (await q<{ id: string }>(`INSERT INTO public.tenants(name) VALUES ($1) RETURNING id`, [n])).rows[0]!.id;
    const user = async () =>
      (await q<{ id: string }>(`INSERT INTO auth.users(email) VALUES ($1) RETURNING id`, [
        `ws_${Date.now()}_${Math.random().toString(36).slice(2, 10)}@example.com`,
      ])).rows[0]!.id;
    const key = async (t: string, sources: string[]) =>
      (await q<{ id: string }>(
        `INSERT INTO public.governance_ingest_keys(tenant_id, name, key_hash, key_prefix, allowed_sources)
         VALUES ($1, 'ws', $2, 'rsd_gov_', $3) RETURNING id`,
        [t, Math.random().toString(16).slice(2).padEnd(64, '0'), sources],
      )).rows[0]!.id;
    ids.tA = await tenant(`ws-A-${Date.now()}`);
    ids.tB = await tenant(`ws-B-${Date.now()}`);
    ids.uA = await user();
    ids.uB = await user();
    ids.uViewer = await user();
    await q(
      `INSERT INTO public.memberships(tenant_id, user_id, role) VALUES ($1,$2,'owner'),($3,$4,'owner'),($1,$5,'viewer_auditor')`,
      [ids.tA, ids.uA, ids.tB, ids.uB, ids.uViewer],
    );
    ids.kA = await key(ids.tA, ['google_workspace']);
    ids.kSdk = await key(ids.tA, []);
  });

  afterEach(async () => {
    await closeDb(ctx);
    ctx = null;
  });

  it('ist idempotent pro (tenant_id, event_id)', async () => {
    const first = (await ingest('evt-1', 'draft_reply', 'allow')).rows[0]!;
    const again = (await ingest('evt-1', 'draft_reply', 'allow')).rows[0]!;
    expect(first.duplicate).toBe(false);
    expect(again.duplicate).toBe(true);
    expect(again.event_row_id).toBe(first.event_row_id);
    const n = await q<{ n: string }>(`SELECT count(*)::text n FROM public.workspace_events WHERE tenant_id=$1`, [ids.tA]);
    expect(n.rows[0]!.n).toBe('1');
  });

  it('lehnt Schlüssel ohne Quelle google_workspace oder eines anderen Mandanten ab', async () => {
    // Jede erwartete Ausnahme in einem eigenen Savepoint: nach einem Fehler ist die
    // Transaktion sonst abgebrochen, und die zweite Prüfung sähe nur noch
    // „current transaction is aborted“ statt des eigentlichen Fehlers.
    const rejected = async (run: () => Promise<unknown>) => {
      await q(`SAVEPOINT sp_key`);
      await expect(run()).rejects.toThrow(/workspace_key_invalid/);
      await q(`ROLLBACK TO SAVEPOINT sp_key`);
    };
    await rejected(() => ingest('evt-2', 'draft_reply', 'allow', ids.kSdk));
    await rejected(() => ingest('evt-3', 'draft_reply', 'allow', ids.kA, ids.tB));
  });

  it('legt für Außenwirkung eine PENDING-Freigabe an, für Internes nicht', async () => {
    const internal = (await ingest('evt-4', 'draft_reply', 'allow')).rows[0]!;
    expect(internal.approval_id).toBeNull();
    const ext = (await ingest('evt-5', 'send_email', 'require_approval')).rows[0]!;
    expect(ext.approval_status).toBe('PENDING');
  });

  it('trennt Mandanten: fremde Ereignisse und Freigaben sind unsichtbar, Schreiben ist gesperrt', async () => {
    await ingest('evt-6', 'send_email', 'require_approval');
    const seenB = await as(ids.uB, () => q(`SELECT id FROM public.workspace_events`));
    expect(seenB.rows).toHaveLength(0);
    const seenA = await as(ids.uA, () => q(`SELECT id FROM public.workspace_approvals`));
    expect(seenA.rows).toHaveLength(1);
    await expect(as(ids.uA, () =>
      q(`UPDATE public.workspace_approvals SET status='APPROVED'`),
    )).rejects.toThrow(/permission denied|row-level security/i);
    await expect(as(ids.uA, () => ingest('evt-7', 'draft_reply', 'allow'))).rejects.toThrow(/permission denied/i);
  });

  it('nur Admins des eigenen Mandanten entscheiden; Einlösung genau einmal mit passendem Hash', async () => {
    const appr = (await ingest('evt-8', 'send_email', 'require_approval')).rows[0]!.approval_id!;
    await expect(as(ids.uB, () => q(`SELECT public.decide_workspace_approval($1, true)`, [appr])))
      .rejects.toThrow(/workspace_approval_not_found/);
    await expect(as(ids.uViewer, () => q(`SELECT public.decide_workspace_approval($1, true)`, [appr])))
      .rejects.toThrow(/workspace_approval_not_found/);
    const decided = await asKeep(ids.uA, () =>
      q<{ s: string }>(`SELECT public.decide_workspace_approval($1, true) AS s`, [appr]));
    expect(decided.rows[0]!.s).toBe('APPROVED');

    const consume = (tenant: string, hash: string, exec: string) =>
      q<{ ok: boolean }>(`SELECT public.consume_workspace_approval($1,$2,$3,$4) AS ok`, [tenant, appr, hash, exec]);
    expect((await consume(ids.tA, OTHER_HASH, 'x1')).rows[0]!.ok).toBe(false);
    expect((await consume(ids.tB, HASH, 'x2')).rows[0]!.ok).toBe(false);
    expect((await consume(ids.tA, HASH, 'x3')).rows[0]!.ok).toBe(true);
    expect((await consume(ids.tA, HASH, 'x4')).rows[0]!.ok).toBe(false);
  });

  it('abgelaufene Freigaben lassen sich weder genehmigen noch einlösen', async () => {
    const appr = (await ingest('evt-9', 'send_email', 'require_approval')).rows[0]!.approval_id!;
    await q(`UPDATE public.workspace_approvals SET requested_at = now() - interval '2 days', expires_at = now() - interval '1 day' WHERE id=$1`, [appr]);
    const s = await asKeep(ids.uA, () => q<{ s: string }>(`SELECT public.decide_workspace_approval($1, true) AS s`, [appr]));
    expect(s.rows[0]!.s).toBe('EXPIRED');
    const ok = await q<{ ok: boolean }>(`SELECT public.consume_workspace_approval($1,$2,$3,'x') AS ok`, [ids.tA, appr, HASH]);
    expect(ok.rows[0]!.ok).toBe(false);
  });
});
