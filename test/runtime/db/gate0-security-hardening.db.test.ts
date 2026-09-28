/**
 * Gate 0 — Ergänzung zu #1629 (20260927130000_gate0_security_rls_hardening.sql).
 *
 * Nur die Teile, die #1629 nicht abdeckt — je mit Negativtest (fremder
 * Mandant, anon) und dem legitimen Weg (Mitglied, service_role):
 *
 *   1. scan_results: `tenant_id = (SELECT tenant_id FROM auth.users …)` —
 *      auth.users hat keine Spalte tenant_id, der Name bindet an die äußere
 *      Zeile, die Bedingung ist immer wahr. Heute bricht sie nur ab, weil
 *      authenticated auth.users nicht lesen darf („permission denied") — die
 *      Tabelle war für Mitglieder unlesbar, ein Grant hätte sie geöffnet.
 *   2. SECURITY-DEFINER-Funktionen mit p_tenant_id ohne Mitgliedschaftsprüfung
 *      (mcp_*, llm_quota_*), aber für authenticated ausführbar.
 *   3. api_calls: Leseregel über public.memberships statt nur über das nicht
 *      synchronisierte tenant_memberships.
 *
 * Läuft gegen das voll migrierte Schema (CI-db-Job), mit und ohne #1629. Die
 * Rollen werden echt gewechselt (SET LOCAL ROLE), auth.uid()/auth.role() lesen
 * die JWT-Claims — derselbe Weg wie in Supabase, kein nachgebauter.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { closeDb, createTenantWithMember, openDb, requireDbOrFail, type DbCtx } from './db-helpers';

const d = requireDbOrFail('gate0-security-hardening') ? describe : describe.skip;

type Rolle = 'anon' | 'authenticated' | 'service_role';

/** Aufruf mit echter Rolle und JWT-Claims; Fehler rollen nur den Savepoint zurück. */
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

/** Fehlendes Recht (z. B. EXECUTE für anon): SQLSTATE 42501. */
const VERWEIGERT = { code: '42501' };

interface Welt {
  a: { tenantId: string; userId: string };
  b: { tenantId: string; userId: string };
  apiKeyB: string;
}

async function welt(ctx: DbCtx): Promise<Welt> {
  const a = await createTenantWithMember(ctx);
  const b = await createTenantWithMember(ctx);
  const { rows: k } = await ctx.client.query<{ id: string }>(
    `INSERT INTO public.api_keys (tenant_id, name, key_hash, key_prefix)
     VALUES ($1, 'b-key', md5(random()::text), 'rs_live_b123') RETURNING id`,
    [b.tenantId],
  );
  return { a, b, apiKeyB: k[0]!.id };
}

d('Gate 0 · scan_results', () => {
  let ctx: DbCtx | null = null;
  beforeEach(async () => { ctx = await openDb(); });
  afterEach(async () => { await closeDb(ctx); ctx = null; });

  it('trennt Mandanten: Mitglied sieht nur eigene Ergebnisse, anon nichts, Server alles', async () => {
    const w = await welt(ctx!);
    for (const [tenant, domain] of [[w.a.tenantId, 'a.example'], [w.b.tenantId, 'b.example']] as const) {
      const { rows } = await ctx!.client.query<{ id: string }>(
        `INSERT INTO public.bulk_scan_batches (tenant_id) VALUES ($1) RETURNING id`,
        [tenant],
      );
      // status explizit: Der Spalten-Default 'pending' verletzt den eigenen
      // CHECK (success|timeout|error|not_found) — Befund außerhalb von Gate 0.
      await ctx!.client.query(
        `INSERT INTO public.scan_results (batch_id, tenant_id, domain, status) VALUES ($1, $2, $3, 'success')`,
        [rows[0]!.id, tenant, domain],
      );
    }
    const sel = `SELECT domain FROM public.scan_results WHERE tenant_id = ANY($1::uuid[]) ORDER BY domain`;
    const both = [[w.a.tenantId, w.b.tenantId]];

    // Vor der Korrektur brach diese Abfrage mit „permission denied for table
    // users" ab — auch für den eigenen Mandanten.
    const alsA = await als(ctx!, 'authenticated', w.a.userId, () => ctx!.client.query(sel, both));
    expect(alsA.rows.map((r) => r.domain)).toEqual(['a.example']);
    const alsB = await als(ctx!, 'authenticated', w.b.userId, () => ctx!.client.query(sel, both));
    expect(alsB.rows.map((r) => r.domain)).toEqual(['b.example']);
    const anon = await als(ctx!, 'anon', null, () => ctx!.client.query(sel, both));
    expect(anon.rowCount).toBe(0);
    const srv = await als(ctx!, 'service_role', null, () => ctx!.client.query(sel, both));
    expect(srv.rowCount).toBe(2);
  });
});

d('Gate 0 · SECURITY-DEFINER-Funktionen (mcp_*, llm_quota_*)', () => {
  let ctx: DbCtx | null = null;
  beforeEach(async () => { ctx = await openDb(); });
  afterEach(async () => { await closeDb(ctx); ctx = null; });

  async function seed(): Promise<Welt> {
    const w = await welt(ctx!);
    // Ein Trigger auf tenants legt bereits ein Free-Abo an; hier Plan setzen.
    await ctx!.client.query(
      `INSERT INTO public.subscriptions (tenant_id, plan_key, status) VALUES ($1, 'growth', 'active')
       ON CONFLICT (tenant_id) DO UPDATE SET plan_key = 'growth', status = 'active', updated_at = now()`,
      [w.a.tenantId],
    );
    await ctx!.client.query(
      `INSERT INTO public.mcp_api_keys (tenant_id, key_prefix, key_hash) VALUES ($1, 'rs_a', md5(random()::text))`,
      [w.a.tenantId],
    );
    await ctx!.client.query(
      `INSERT INTO public.llm_query_history (tenant_id, op, provider, model, query_text)
       VALUES ($1, 'chat', 'anthropic', 'm', 'q')`,
      [w.a.tenantId],
    );
    return w;
  }

  async function lese(tenantId: string) {
    const q = (sql: string) => ctx!.client.query(sql, [tenantId]);
    const limits = await q(`SELECT * FROM public.mcp_plan_limits($1)`);
    const quota = await q(`SELECT * FROM public.mcp_quota_state($1)`);
    const keys = await q(`SELECT public.mcp_active_key_count($1) AS n`);
    const cap = await q(`SELECT public.llm_quota_for_tenant($1) AS n`);
    const used = await q(`SELECT public.llm_quota_used_for_tenant($1) AS n`);
    return {
      limits: limits.rows as Array<{ plan_key: string }>,
      quota: quota.rows as Array<{ plan_key: string }>,
      keys: keys.rows[0]!.n as number | null,
      cap: cap.rows[0]!.n as number | null,
      used: used.rows[0]!.n as number | null,
    };
  }

  it('Mitglied sieht die Werte des eigenen Mandanten', async () => {
    const w = await seed();
    const r = await als(ctx!, 'authenticated', w.a.userId, () => lese(w.a.tenantId));
    expect(r.limits.map((x) => x.plan_key)).toEqual(['growth']);
    expect(r.quota).toHaveLength(1);
    expect(r.keys).toBe(1);
    expect(r.cap).not.toBeNull();
    expect(r.used).toBe(1);
  });

  it('Server (service_role, ohne sub) sieht dieselben Werte — Edge Functions bleiben funktionsfähig', async () => {
    const w = await seed();
    const r = await als(ctx!, 'service_role', null, () => lese(w.a.tenantId));
    expect(r.limits.map((x) => x.plan_key)).toEqual(['growth']);
    expect(r.quota).toHaveLength(1);
    expect(r.keys).toBe(1);
    expect(r.cap).not.toBeNull();
    expect(r.used).toBe(1);
  });

  it('fremder eingeloggter Nutzer sieht nichts', async () => {
    const w = await seed();
    const r = await als(ctx!, 'authenticated', w.b.userId, () => lese(w.a.tenantId));
    expect(r).toEqual({ limits: [], quota: [], keys: null, cap: null, used: null });
  });

  it('anon kann die Funktionen nicht ausführen', async () => {
    const w = await seed();
    await expect(
      als(ctx!, 'anon', null, () => ctx!.client.query(`SELECT * FROM public.mcp_plan_limits($1)`, [w.a.tenantId])),
    ).rejects.toMatchObject(VERWEIGERT);
    await expect(
      als(ctx!, 'anon', null, () => ctx!.client.query(`SELECT public.llm_quota_used_for_tenant($1)`, [w.a.tenantId])),
    ).rejects.toMatchObject(VERWEIGERT);
  });
});

d('Gate 0 · api_calls — Leseregel über die kanonische Mitgliedschaft', () => {
  let ctx: DbCtx | null = null;
  beforeEach(async () => { ctx = await openDb(); });
  afterEach(async () => { await closeDb(ctx); ctx = null; });

  it('Mitglied ohne tenant_memberships-Zeile liest die eigene API-Nutzung, Fremde und anon nicht', async () => {
    const w = await welt(ctx!);
    // Drift-Fall: Das Mitglied steht nur in der kanonischen memberships-
    // Tabelle. Die alte Leseregel prüft allein gegen tenant_memberships.
    await ctx!.client.query(`DELETE FROM public.tenant_memberships WHERE user_id = $1`, [w.b.userId]);
    await ctx!.client.query(
      `INSERT INTO public.api_calls (tenant_id, api_key_id, endpoint, method, request_path)
       VALUES ($1, $2, '/x', 'GET', '/x')`,
      [w.b.tenantId, w.apiKeyB],
    );
    // Direkt auf der Tabelle — und über die View, die ApiUsageStats liest.
    // Die View läuft mit #1629 als security_invoker und greift dann genau
    // auf diese Leseregel zurück.
    for (const quelle of ['api_calls', 'api_monthly_usage']) {
      const lies = () => ctx!.client.query(`SELECT 1 FROM public.${quelle} WHERE tenant_id = $1`, [w.b.tenantId]);
      const mitglied = await als(ctx!, 'authenticated', w.b.userId, lies);
      expect(mitglied.rowCount, `${quelle} · Mitglied`).toBe(1);
    }
    const lies = () => ctx!.client.query(`SELECT 1 FROM public.api_calls WHERE tenant_id = $1`, [w.b.tenantId]);
    const fremd = await als(ctx!, 'authenticated', w.a.userId, lies);
    expect(fremd.rowCount, 'fremd').toBe(0);
    const anon = await als(ctx!, 'anon', null, lies);
    expect(anon.rowCount, 'anon').toBe(0);
  });
});
