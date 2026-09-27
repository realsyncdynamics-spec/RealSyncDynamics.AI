/**
 * Gate 0 — Security Hardening (20260927120000_gate0_security_rls_hardening.sql).
 *
 * Drei Zugriffsklassen, je mit Negativtest (fremder Mandant, anon) und dem
 * legitimen Server-Weg (service_role), damit die Härtung nichts bricht:
 *
 *   1. „Service role …“-Policies, die ohne `TO service_role` für PUBLIC
 *      galten → Browser konnte Prüfpfad, Berichte, Benachrichtigungen,
 *      Zähler und Agent-Budgets fremder Mandanten schreiben/lesen.
 *   2. scan_results: `tenant_id = (SELECT tenant_id FROM auth.users …)` —
 *      auth.users hat keine Spalte tenant_id, der Name bindet an die äußere
 *      Zeile, die Bedingung ist immer wahr. Heute bricht sie nur ab, weil
 *      authenticated auth.users nicht lesen darf („permission denied") — die
 *      Tabelle war für Mitglieder unlesbar, ein Grant hätte sie geöffnet.
 *   3. SECURITY-DEFINER-Funktionen mit p_tenant_id ohne Mitgliedschaftsprüfung
 *      (mcp_*, llm_quota_*), aber für authenticated ausführbar.
 *
 * Läuft gegen das voll migrierte Schema (CI-db-Job). Die Rollen werden echt
 * gewechselt (SET LOCAL ROLE), auth.uid()/auth.role() lesen die JWT-Claims —
 * derselbe Weg wie in Supabase, kein nachgebauter.
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

/** RLS-Verstoß (WITH CHECK) oder fehlendes Recht: beides SQLSTATE 42501. */
const VERWEIGERT = { code: '42501' };

interface Welt {
  a: { tenantId: string; userId: string };
  b: { tenantId: string; userId: string };
  projektB: string;
  apiKeyB: string;
}

async function welt(ctx: DbCtx): Promise<Welt> {
  const a = await createTenantWithMember(ctx);
  const b = await createTenantWithMember(ctx);
  const { rows: p } = await ctx.client.query<{ id: string }>(
    `INSERT INTO public.website_projects (tenant_id, name, industry) VALUES ($1, 'b-site', 'test') RETURNING id`,
    [b.tenantId],
  );
  const { rows: k } = await ctx.client.query<{ id: string }>(
    `INSERT INTO public.api_keys (tenant_id, name, key_hash, key_prefix)
     VALUES ($1, 'b-key', md5(random()::text), 'rs_live_b123') RETURNING id`,
    [b.tenantId],
  );
  return { a, b, projektB: p[0]!.id, apiKeyB: k[0]!.id };
}

/**
 * Je Tabelle ein vollständiger, constraint-gültiger Insert für Mandant B —
 * scheitert er, dann an der Policy, nicht an Pflichtfeldern oder FKs.
 */
function inserts(w: Welt): Array<{ tabelle: string; sql: string; params: unknown[] }> {
  const t = w.b.tenantId;
  return [
    {
      tabelle: 'governance_audit_log',
      sql: `INSERT INTO public.governance_audit_log (tenant_id, action, resource_type, resource_id, user_id)
            VALUES ($1, 'policy.delete', 'policy', 'x', $2)`,
      params: [t, w.b.userId],
    },
    {
      tabelle: 'dashboard_notifications',
      sql: `INSERT INTO public.dashboard_notifications (tenant_id, user_id, type, title, body)
            VALUES ($1, $2, 'alert', 'phish', 'klick hier')`,
      params: [t, w.b.userId],
    },
    {
      tabelle: 'email_notifications',
      sql: `INSERT INTO public.email_notifications (tenant_id, recipient_email, event_type, subject, body)
            VALUES ($1, 'x@example.com', 'quota_warning', 's', 'b')`,
      params: [t],
    },
    {
      tabelle: 'agent_token_usage',
      sql: `INSERT INTO public.agent_token_usage (tenant_id, tokens_used, prompt_type) VALUES ($1, 999999, 'x')`,
      params: [t],
    },
    {
      tabelle: 'api_calls',
      sql: `INSERT INTO public.api_calls (tenant_id, api_key_id, endpoint, method, request_path)
            VALUES ($1, $2, '/x', 'GET', '/x')`,
      params: [t, w.apiKeyB],
    },
    {
      tabelle: 'deployment_logs',
      sql: `INSERT INTO public.deployment_logs (project_id, tenant_id, event_type, title)
            VALUES ($1, $2, 'deploy', 'gefälscht')`,
      params: [w.projektB, t],
    },
    {
      tabelle: 'website_compliance_reports',
      sql: `INSERT INTO public.website_compliance_reports (project_id, tenant_id, overall_score)
            VALUES ($1, $2, 100)`,
      params: [w.projektB, t],
    },
  ];
}

d('Gate 0 · Klasse 1 — Service-Role-Policies', () => {
  let ctx: DbCtx | null = null;
  beforeEach(async () => { ctx = await openDb(); });
  afterEach(async () => { await closeDb(ctx); ctx = null; });

  it('Invariante: keine `true`-Policy für anon/authenticated/PUBLIC auf Mandantendaten', async () => {
    // Über das GESAMTE Schema formuliert: Eine neue Tabelle mit tenant_id und
    // demselben Fehler lässt diesen Test fallen, ohne dass jemand ihn pflegt.
    const { rows } = await ctx!.client.query<{ tabelle: string; policy: string; cmd: string }>(`
      SELECT p.tablename AS tabelle, p.policyname AS policy, p.cmd
        FROM pg_policies p
       WHERE p.schemaname = 'public'
         AND (coalesce(p.qual, '') = 'true' OR coalesce(p.with_check, '') = 'true')
         AND NOT (p.roles <@ ARRAY['service_role']::name[])
         AND EXISTS (
           SELECT 1 FROM information_schema.columns c
            WHERE c.table_schema = 'public' AND c.table_name = p.tablename AND c.column_name = 'tenant_id'
         )
       ORDER BY 1, 2`);
    // Einzige bewusste Ausnahme: öffentliche Anmeldung für Art.-28-Hinweise
    // (20260507140000). Restrisiko im PR dokumentiert.
    const erlaubt = new Set(['sub_processor_subscriptions/sp_sub_anon_insert']);
    const offen = rows.filter((r) => !erlaubt.has(`${r.tabelle}/${r.policy}`));
    expect(offen, JSON.stringify(offen)).toEqual([]);
  });

  it('bindet alle zehn gehärteten Policies ausschliesslich an service_role', async () => {
    const { rows } = await ctx!.client.query<{ tablename: string; policyname: string; roles: string }>(`
      SELECT tablename, policyname, roles::text AS roles FROM pg_policies
       WHERE schemaname = 'public' AND (tablename, policyname) IN (
         ('governance_audit_log','Service role can insert audit entries'),
         ('website_compliance_reports','Service role can insert/update reports'),
         ('website_compliance_reports','Service role can update reports'),
         ('deployment_logs','Service role can insert logs'),
         ('dashboard_notifications','Service role can create notifications'),
         ('api_calls','api_calls service_role_insert'),
         ('email_notifications','email_notifications service_role_insert'),
         ('agent_token_usage','Service role can insert token usage'),
         ('agent_token_usage','Service role can view token usage'),
         ('agent_configuration','Service role can manage agent config'))`);
    expect(rows).toHaveLength(10);
    for (const r of rows) expect(r.roles, `${r.tablename}/${r.policyname}`).toBe('{service_role}');
  });

  it('verweigert authenticated (auch als Mitglied) und anon jeden direkten Insert', async () => {
    const w = await welt(ctx!);
    for (const ins of inserts(w)) {
      // Mitglied des Zielmandanten — der Prüfpfad darf auch vom eigenen Nutzer
      // nicht direkt beschrieben werden.
      await expect(
        als(ctx!, 'authenticated', w.b.userId, () => ctx!.client.query(ins.sql, ins.params)),
        `${ins.tabelle} · Mitglied`,
      ).rejects.toMatchObject(VERWEIGERT);
      // Fremder Mandant.
      await expect(
        als(ctx!, 'authenticated', w.a.userId, () => ctx!.client.query(ins.sql, ins.params)),
        `${ins.tabelle} · fremd`,
      ).rejects.toMatchObject(VERWEIGERT);
      await expect(
        als(ctx!, 'anon', null, () => ctx!.client.query(ins.sql, ins.params)),
        `${ins.tabelle} · anon`,
      ).rejects.toMatchObject(VERWEIGERT);
    }
  });

  it('erhält den legitimen Server-Schreibweg (service_role) für alle Tabellen', async () => {
    const w = await welt(ctx!);
    for (const ins of inserts(w)) {
      const res = await als(ctx!, 'service_role', null, () => ctx!.client.query(ins.sql, ins.params));
      expect(res.rowCount, ins.tabelle).toBe(1);
    }
  });

  it('website_compliance_reports: authenticated kann Berichte nicht überschreiben, service_role schon', async () => {
    const w = await welt(ctx!);
    const { rows } = await ctx!.client.query<{ id: string }>(
      `INSERT INTO public.website_compliance_reports (project_id, tenant_id, overall_score)
       VALUES ($1, $2, 20) RETURNING id`,
      [w.projektB, w.b.tenantId],
    );
    const id = rows[0]!.id;
    const upd = `UPDATE public.website_compliance_reports SET overall_score = 100 WHERE id = $1`;
    for (const user of [w.b.userId, w.a.userId]) {
      const r = await als(ctx!, 'authenticated', user, () => ctx!.client.query(upd, [id]));
      expect(r.rowCount).toBe(0);
    }
    const srv = await als(ctx!, 'service_role', null, () => ctx!.client.query(upd, [id]));
    expect(srv.rowCount).toBe(1);
  });

  it('agent_configuration: kein Browser-Zugriff, Server liest und schreibt', async () => {
    const w = await welt(ctx!);
    await ctx!.client.query(
      `INSERT INTO public.agent_configuration (tenant_id) VALUES ($1) ON CONFLICT (tenant_id) DO NOTHING`,
      [w.b.tenantId],
    );
    const upd = `UPDATE public.agent_configuration SET monthly_token_budget = 999999999 WHERE tenant_id = $1`;
    const fremd = await als(ctx!, 'authenticated', w.a.userId, () => ctx!.client.query(upd, [w.b.tenantId]));
    expect(fremd.rowCount).toBe(0);
    const lesen = await als(ctx!, 'authenticated', w.a.userId, () =>
      ctx!.client.query(`SELECT 1 FROM public.agent_configuration WHERE tenant_id = $1`, [w.b.tenantId]));
    expect(lesen.rowCount).toBe(0);
    const srv = await als(ctx!, 'service_role', null, () => ctx!.client.query(upd, [w.b.tenantId]));
    expect(srv.rowCount).toBe(1);
  });

  it('agent_token_usage: Mitglied liest nur den eigenen Mandanten', async () => {
    const w = await welt(ctx!);
    await ctx!.client.query(
      `INSERT INTO public.agent_token_usage (tenant_id, tokens_used, prompt_type) VALUES ($1, 10, 'a'), ($2, 20, 'b')`,
      [w.a.tenantId, w.b.tenantId],
    );
    const sel = `SELECT tenant_id FROM public.agent_token_usage WHERE tenant_id = ANY($1::uuid[])`;
    const both = [[w.a.tenantId, w.b.tenantId]];
    const alsA = await als(ctx!, 'authenticated', w.a.userId, () => ctx!.client.query(sel, both));
    expect(alsA.rows.map((r) => r.tenant_id)).toEqual([w.a.tenantId]);
    const anon = await als(ctx!, 'anon', null, () => ctx!.client.query(sel, both));
    expect(anon.rowCount).toBe(0);
    const srv = await als(ctx!, 'service_role', null, () => ctx!.client.query(sel, both));
    expect(srv.rowCount).toBe(2);
  });
});

d('Gate 0 · Klasse 2 — scan_results', () => {
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

d('Gate 0 · Klasse 3 — SECURITY-DEFINER-Funktionen (mcp_*, llm_quota_*)', () => {
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
