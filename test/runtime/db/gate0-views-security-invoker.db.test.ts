/**
 * Gate 0 — Views über Mandantentabellen (20260927150000_gate0_views_security_invoker.sql).
 *
 * Eine View ohne security_invoker läuft mit den Rechten ihres Eigentümers
 * (postgres) und damit an der RLS der Basistabelle vorbei. Sieben Views in
 * public lasen so Daten aller Mandanten — für anon und authenticated.
 *
 * Geprüft wird:
 *   1. Invariante über das GESAMTE Schema: keine für anon/authenticated
 *      lesbare View über einer RLS-Tabelle mit tenant_id ohne
 *      security_invoker. Eine neue View mit demselben Fehler lässt den Test
 *      fallen, ohne dass jemand ihn pflegt.
 *   2. Wirkung unter echten Rollen: anon und fremder Mandant sehen nichts,
 *      das eigene Mitglied sieht seine Zeilen — auch im Drift-Fall ohne
 *      tenant_memberships-Zeile (tenant_cost_ledger prüfte nur dagegen).
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { closeDb, createTenantWithMember, openDb, requireDbOrFail, type DbCtx } from './db-helpers';

const d = requireDbOrFail('gate0-views-security-invoker') ? describe : describe.skip;

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

/** Views mit Fixture im Test — deckt fünf der sieben ab; alle sieben deckt die Invariante. */
const VIEWS = [
  'ai_token_daily_totals',
  'browser_actions_with_context',
  'compliance_report_ready',
  'vw_distribution_queue_errors',
  'vw_distribution_queue_metrics',
] as const;

d('Gate 0 · Views laufen mit den Rechten des Aufrufers', () => {
  let ctx: DbCtx | null = null;
  beforeEach(async () => { ctx = await openDb(); });
  afterEach(async () => { await closeDb(ctx); ctx = null; });

  it('Invariante: keine lesbare View über einer RLS-Mandantentabelle ohne security_invoker', async () => {
    const { rows } = await ctx!.client.query<{ view: string }>(`
      SELECT DISTINCT v.relname AS view
        FROM pg_class v
        JOIN pg_rewrite r ON r.ev_class = v.oid
        JOIN pg_depend dep ON dep.objid = r.oid AND dep.classid = 'pg_rewrite'::regclass
        JOIN pg_class t ON t.oid = dep.refobjid AND t.relkind IN ('r', 'p') AND t.relrowsecurity
       WHERE v.relkind = 'v'
         AND v.relnamespace = 'public'::regnamespace
         AND t.oid <> v.oid
         AND NOT coalesce(v.reloptions && ARRAY['security_invoker=on', 'security_invoker=true'], false)
         AND (has_table_privilege('anon', v.oid, 'SELECT') OR has_table_privilege('authenticated', v.oid, 'SELECT'))
         AND EXISTS (
           SELECT 1 FROM information_schema.columns c
            WHERE c.table_schema = 'public' AND c.table_name = t.relname AND c.column_name = 'tenant_id'
         )
       ORDER BY 1`);
    expect(rows.map((r) => r.view)).toEqual([]);
  });

  it('anon und fremder Mandant lesen nichts, das eigene Mitglied (nur memberships) seine Zeilen', async () => {
    const a = await createTenantWithMember(ctx!);
    const b = await createTenantWithMember(ctx!);
    // Drift-Fall: Mitglied B steht nur in der kanonischen memberships-Tabelle.
    await ctx!.client.query(`DELETE FROM public.tenant_memberships WHERE user_id = $1`, [b.userId]);

    const q = (sql: string, params: unknown[]) => ctx!.client.query(sql, params);
    // amount_usd ist generiert; is_simulated=false verlangt replay_run_id NULL.
    await q(
      `INSERT INTO public.tenant_cost_ledger (tenant_id, cost_kind, units, unit_price_usd, agent_ref)
       VALUES ($1, 'llm_input', 100, 0.01, 'agent-x')`,
      [b.tenantId],
    );
    await q(
      `INSERT INTO public.browser_actions (tenant_id, session_id, browser_action, status)
       VALUES ($1, 's', 'scan_start', 'started')`,
      [b.tenantId],
    );
    await q(
      `INSERT INTO public.distribution_queue_entries (tenant_id, post_id, channel, body, last_error)
       VALUES ($1, 'p', 'linkedin', 'b', 'timeout')`,
      [b.tenantId],
    );
    await q(
      `INSERT INTO public.audit_reports (tenant_id, title, created_by) VALUES ($1, 'R', $2)`,
      [b.tenantId, b.userId],
    );

    for (const view of VIEWS) {
      const lies = () => q(`SELECT 1 FROM public.${view} WHERE tenant_id = $1`, [b.tenantId]);
      // Vor der Korrektur: je eine Zeile für anon und für den fremden Mandanten.
      const anon = await als(ctx!, 'anon', null, lies);
      expect(anon.rowCount, `${view} · anon`).toBe(0);
      const fremd = await als(ctx!, 'authenticated', a.userId, lies);
      expect(fremd.rowCount, `${view} · fremd`).toBe(0);
      const eigen = await als(ctx!, 'authenticated', b.userId, lies);
      expect(eigen.rowCount, `${view} · Mitglied`).toBeGreaterThan(0);
    }
  });
});
