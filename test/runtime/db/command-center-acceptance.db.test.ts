/**
 * M9 Abnahme — messbare Kriterien aus dem Master-Plan, gegen echte Rollen (lokale DB).
 *  K1: 0 unautorisierte kritische Aktionen (Matrix Rolle × kritische Aktion)
 *  K2: 0 zirkuläre Delegationsschleifen in Testszenarien
 *  K3: 100 % freigabepflichtige Entscheidungen mit Audit-Eintrag
 *  K4: Fragen haben eindeutige IDs; Entscheidungen sind Fragen zuordenbar; dedupe_key gruppiert
 * Läuft nur mit gesetztem TEST_DB_URL.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { closeDb, getDbUrl, openDb, type DbCtx } from './db-helpers';

const dbUrl = getDbUrl();
if (!dbUrl && process.env.REQUIRE_DB_TESTS === '1') {
  describe('command center acceptance', () => {
    it('TEST_DB_URL muss gesetzt sein, wenn REQUIRE_DB_TESTS=1', () => {
      throw new Error('REQUIRE_DB_TESTS=1, aber TEST_DB_URL fehlt.');
    });
  });
}
const d = dbUrl ? describe : describe.skip;

d('M9 Abnahme Command Center', () => {
  let ctx: DbCtx | null = null;
  const ids = {} as { tA: string; tB: string; owner: string; editor: string; foreign: string; dec: string; cfg: string; task: string };
  const q = <T extends Record<string, unknown> = Record<string, unknown>>(sql: string, p: unknown[] = []) =>
    ctx!.client.query<T>(sql, p);
  async function attempt(role: 'anon' | 'authenticated', sub: string | null, sql: string, p: unknown[] = []): Promise<boolean> {
    const sp = `sp_${Math.random().toString(36).slice(2, 10)}`;
    await q(`SAVEPOINT ${sp}`);
    try {
      await q(`SELECT set_config('request.jwt.claims', $1, true)`, [JSON.stringify({ sub, role })]);
      await q(`SET LOCAL ROLE ${role}`);
      const r = await q(sql, p);
      // UPDATE ohne Treffer (RLS) zählt als abgewiesen
      return !(r.command === 'UPDATE' && r.rowCount === 0);
    } catch { return false; } finally {
      await q(`ROLLBACK TO SAVEPOINT ${sp}`);
      await q(`RESET ROLE`);
    }
  }
  async function asKeep<T>(sub: string, fn: () => Promise<T>): Promise<T> {
    await q(`SELECT set_config('request.jwt.claims', $1, true)`, [JSON.stringify({ sub, role: 'authenticated' })]);
    await q(`SET LOCAL ROLE authenticated`);
    try { return await fn(); } finally { await q(`RESET ROLE`); }
  }
  const newDecision = async (t: string, title = 'Merge PR') => (await q<{ id: string }>(
    `INSERT INTO public.agent_decisions(tenant_id, decision_title, problem, options, recommendation, reason, risk_level, reversibility, status, proposed_by)
     VALUES ($1,$2,'p','[{"label":"A","rationale":"a","recommended":true},{"label":"B","rationale":"b"}]'::jsonb,'A','r','high','irreversible','proposed','grok:x') RETURNING id`, [t, title])).rows[0]!.id;

  beforeEach(async () => {
    ctx = await openDb();
    const tenant = async (n: string) => (await q<{ id: string }>(`INSERT INTO public.tenants(name) VALUES ($1) RETURNING id`, [n])).rows[0]!.id;
    const user = async () => (await q<{ id: string }>(`INSERT INTO auth.users(email) VALUES ($1) RETURNING id`, [
      `m9_${Date.now()}_${Math.random().toString(36).slice(2, 10)}@example.com`])).rows[0]!.id;
    ids.tA = await tenant(`m9-A-${Date.now()}`); ids.tB = await tenant(`m9-B-${Date.now()}`);
    ids.owner = await user(); ids.editor = await user(); ids.foreign = await user();
    await q(`INSERT INTO public.memberships(tenant_id, user_id, role) VALUES ($1,$2,'owner'),($1,$3,'editor'),($4,$5,'owner')`,
      [ids.tA, ids.owner, ids.editor, ids.tB, ids.foreign]);
    ids.dec = await newDecision(ids.tA);
    ids.cfg = (await q<{ id: string }>(`INSERT INTO public.agent_config_versions(tenant_id, agent_ref, section, config) VALUES ($1,'grok:x','computer','{"tools":["shell"]}') RETURNING id`, [ids.tA])).rows[0]!.id;
    ids.task = (await q<{ id: string }>(`INSERT INTO public.agent_tasks(tenant_id, agent, task) VALUES ($1,'a','t') RETURNING id`, [ids.tA])).rows[0]!.id;
    await q(`INSERT INTO public.agent_routines(tenant_id, routine_key, label) VALUES ($1,'daily.check','Check')`, [ids.tA]);
  });
  afterEach(async () => { await closeDb(ctx); ctx = null; });

  it('K1: 0 unautorisierte kritische Aktionen (Rollen × Aktionen)', async () => {
    const actions: Array<[string, string, unknown[]]> = [
      ['Entscheidung freigeben (RPC, bestätigt)', `SELECT public.resolve_agent_decision($1,'approve',0,'L4',true,null)`, [ids.dec]],
      ['Entscheidung direkt auf approved', `UPDATE public.agent_decisions SET status='approved' WHERE id=$1`, [ids.dec]],
      ['Freigabe-Audit fälschen', `INSERT INTO public.agent_decision_approvals(tenant_id, decision_id, action, approval_level, actor) VALUES ($2,$1,'approve','L4',gen_random_uuid())`, [ids.dec, ids.tA]],
      ['Soll-Konfig aktivieren', `SELECT public.activate_agent_config_version($1,true)`, [ids.cfg]],
      ['Aufgabe verschieben/erledigen', `SELECT public.move_agent_task($1,'done','[{"kind":"x"}]'::jsonb)`, [ids.task]],
      ['Aufgabe übernehmen (claim)', `SELECT public.claim_agent_task($1,'evil',60)`, [ids.task]],
      ['Routinenlauf fälschen', `SELECT public.record_routine_run($1,'daily.check','success')`, [ids.tA]],
      ['Plattform-Health lesen', `SELECT * FROM public.cc_platform_health()`, []],
      ['Cron-Logs löschen', `DELETE FROM public.cron_execution_logs`, []],
    ];
    const actors: Array<[string, 'anon' | 'authenticated', string | null]> = [
      ['anon', 'anon', null], ['Editor', 'authenticated', ids.editor], ['fremder Owner', 'authenticated', ids.foreign],
    ];
    const breaches: string[] = [];
    for (const [aName, role, sub] of actors) {
      for (const [label, sql, p] of actions) {
        if (await attempt(role, sub, sql, p)) breaches.push(`${aName}: ${label}`);
      }
    }
    // DELETE auf leerer/gesperrter Tabelle: Erfolg wäre Grant-Lücke → oben als Durchbruch gezählt
    expect(breaches).toEqual([]);
    expect(actions.length * actors.length).toBe(27);
    // Owner ohne Bestätigung ebenfalls abgewiesen
    expect(await attempt('authenticated', ids.owner, `SELECT public.resolve_agent_decision($1,'approve',0,'L4',false,null)`, [ids.dec])).toBe(false);
  });

  it('K2: 0 zirkuläre Delegationsschleifen in Testszenarien', async () => {
    const ins = (agent: string, parent: string | null) => q<{ id: string }>(
      `INSERT INTO public.agent_tasks(tenant_id, agent, task, parent_task_id) VALUES ($1,$2,'t',$3) RETURNING id`, [ids.tA, agent, parent]);
    const tryIns = async (agent: string, parent: string) => {
      await q('SAVEPOINT c'); try { await ins(agent, parent); await q('RELEASE SAVEPOINT c'); return true; }
      catch { await q('ROLLBACK TO SAVEPOINT c'); return false; }
    };
    const a = (await ins('a', null)).rows[0]!.id;
    const b = (await ins('b', a)).rows[0]!.id;
    const c = (await ins('c', b)).rows[0]!.id;
    const scenarios: Array<[string, () => Promise<boolean>]> = [
      ['A→B→A', () => tryIns('a', b)],
      ['A→B→C→A', () => tryIns('a', c)],
      ['A→B→C→B', () => tryIns('b', c)],
      ['Eltern-Zyklus per UPDATE', async () => { await q('SAVEPOINT u'); try { await q(`UPDATE public.agent_tasks SET parent_task_id=$1 WHERE id=$2`, [c, a]); await q('RELEASE SAVEPOINT u'); return true; } catch { await q('ROLLBACK TO SAVEPOINT u'); return false; } }],
    ];
    const created: string[] = [];
    for (const [n, f] of scenarios) if (await f()) created.push(n);
    expect(created).toEqual([]);
    const loops = await q<{ n: string }>(`
      WITH RECURSIVE ch(start_id, id, parent, agents, cyc) AS (
        SELECT id, id, parent_task_id, ARRAY[agent], false FROM public.agent_tasks WHERE tenant_id=$1
        UNION ALL
        SELECT ch.start_id, t.id, t.parent_task_id, ch.agents || t.agent, t.agent = ANY(ch.agents)
          FROM public.agent_tasks t JOIN ch ON t.id = ch.parent WHERE NOT ch.cyc AND cardinality(ch.agents) < 60)
      SELECT count(*)::text n FROM ch WHERE cyc AND cardinality(agents) > 2`, [ids.tA]);
    expect(loops.rows[0]!.n).toBe('0');
  });

  it('K3: 100 % freigabepflichtige Entscheidungen mit Audit-Eintrag', async () => {
    const decs = [ids.dec, await newDecision(ids.tA, 'Deploy'), await newDecision(ids.tA, 'Zahlung'), await newDecision(ids.tA, 'Löschen')];
    const plan: Array<[string, string, number | null, boolean]> = [
      [decs[0]!, 'approve', 0, true], [decs[1]!, 'approve', 1, true], [decs[2]!, 'reject', null, false], [decs[3]!, 'defer', null, false],
    ];
    for (const [id, action, opt, confirm] of plan) {
      await asKeep(ids.owner, () => q(`SELECT public.resolve_agent_decision($1,$2,$3,'L4',$4,null)`, [id, action, opt, confirm]));
    }
    const r = await q<{ resolved: string; audited: string }>(`
      SELECT count(*) FILTER (WHERE d.status <> 'proposed' OR a.n > 0)::text resolved,
             count(*) FILTER (WHERE a.n > 0)::text audited
        FROM public.agent_decisions d
        LEFT JOIN LATERAL (SELECT count(*) n FROM public.agent_decision_approvals x WHERE x.decision_id = d.id) a ON true
       WHERE d.tenant_id = $1`, [ids.tA]);
    expect(r.rows[0]).toEqual({ resolved: '4', audited: '4' });
    const approved = await q<{ n: string }>(`SELECT count(*)::text n FROM public.agent_decisions d WHERE d.tenant_id=$1 AND d.status='approved'
      AND NOT EXISTS (SELECT 1 FROM public.agent_decision_approvals a WHERE a.decision_id=d.id AND a.action='approve')`, [ids.tA]);
    expect(approved.rows[0]!.n).toBe('0');
  });

  it('K4: Fragen-IDs eindeutig, Entscheidung zuordenbar, Dedupe gruppiert', async () => {
    const mk = (key: string) => q<{ id: string }>(`INSERT INTO public.agent_questions(tenant_id, agent_ref, question, priority, dedupe_key, decision_id)
      VALUES ($1,'grok:x','Frage?','P2',$2,$3) RETURNING id`, [ids.tA, key, ids.dec]);
    const a = (await mk('k1')).rows[0]!.id; const b = (await mk('k2')).rows[0]!.id;
    expect(a).not.toBe(b);
    // dedupe_key gruppiert gleiche Fragen (bewusst nicht unique) – jede behält eine eigene ID
    const c = (await mk('k1')).rows[0]!.id;
    expect(new Set([a, b, c]).size).toBe(3);
    const grp = await q<{ n: string }>(`SELECT count(*)::text n FROM public.agent_questions WHERE tenant_id=$1 AND dedupe_key='k1'`, [ids.tA]);
    expect(grp.rows[0]!.n).toBe('2');
    const arch = await q<{ n: string }>(`SELECT count(*)::text n FROM public.agent_decision_archive_v WHERE decision_id=$1 AND question_id IS NOT NULL`, [ids.dec]);
    expect(arch.rows[0]!.n).toBe('1');
  });
});
