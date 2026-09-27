/**
 * Gate 0 — RLS-Härtung (Migration 20260927120000_gate0_rls_hardening.sql).
 *
 * Geprüft wird die WIRKUNG unter echten Rollen (anon, authenticated mit
 * Mandantenrolle, service_role), nicht die Existenz einzelner Policies:
 *
 *   - „Service role“-Policies gelten nicht mehr für Clients.
 *   - Kein direktes Member-Schreiben auf ai_systems, ai_act_assessments,
 *     ai_policies; Lesen bleibt mandantenbezogen erhalten.
 *   - ai_evidence_events: Client-Insert nur für den Industrial-OT-Fall
 *     (event_type='ai_act_classification', ohne ai_system_id/policy_id) und
 *     nur für schreibende Rollen.
 *   - memberships: Admins erzeugen keine Owner und fassen keine Owner-Zeilen an.
 *   - service_role behält die Backend-Rechte.
 *
 * Läuft nur mit gesetztem TEST_DB_URL; in CI setzt der db-Job die Variable.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { closeDb, getDbUrl, openDb, type DbCtx } from './db-helpers';

const dbUrl = getDbUrl();
const mussLaufen = process.env.REQUIRE_DB_TESTS === '1';

if (!dbUrl && mussLaufen) {
  describe('Gate 0 — RLS-Härtung', () => {
    it('TEST_DB_URL muss gesetzt sein, wenn REQUIRE_DB_TESTS=1', () => {
      throw new Error('REQUIRE_DB_TESTS=1, aber TEST_DB_URL fehlt.');
    });
  });
}

const d = dbUrl ? describe : describe.skip;

type Actor =
  | { kind: 'anon' }
  | { kind: 'service' }
  | { kind: 'user'; userId: string };

type Outcome = 'allow' | 'deny';

d('Gate 0 — RLS-Härtung', () => {
  let ctx: DbCtx | null = null;
  const ids = {} as {
    tA: string; tB: string;
    owner: string; admin: string; dpo: string; editor: string; viewer: string;
    ownerB: string; neu: string; neu2: string;
    sysA: string; assessA: string; policyA: string;
  };

  async function q<T extends Record<string, unknown> = Record<string, unknown>>(sql: string, params: unknown[] = []) {
    return ctx!.client.query<T>(sql, params);
  }

  /**
   * Führt `sql` als `actor` aus und bewertet das Ergebnis:
   * Zeilen betroffen/gelesen → allow; RLS-/Rechtefehler oder 0 Zeilen → deny.
   * Jede Prüfung läuft in einem Savepoint und wird zurückgerollt, damit die
   * Fälle einander nicht beeinflussen.
   */
  async function attempt(actor: Actor, sql: string, params: unknown[] = []): Promise<Outcome> {
    const sp = `sp_${Math.random().toString(36).slice(2, 10)}`;
    await q(`SAVEPOINT ${sp}`);
    try {
      if (actor.kind === 'anon') {
        await q(`SELECT set_config('request.jwt.claims', $1, true)`, [JSON.stringify({ role: 'anon' })]);
        await q(`SET LOCAL ROLE anon`);
      } else if (actor.kind === 'service') {
        await q(`SELECT set_config('request.jwt.claims', $1, true)`, [JSON.stringify({ role: 'service_role' })]);
        await q(`SET LOCAL ROLE service_role`);
      } else {
        await q(`SELECT set_config('request.jwt.claims', $1, true)`, [
          JSON.stringify({ sub: actor.userId, role: 'authenticated' }),
        ]);
        await q(`SET LOCAL ROLE authenticated`);
      }
      const res = await q(sql, params);
      return (res.rowCount ?? 0) > 0 ? 'allow' : 'deny';
    } catch (err) {
      const msg = String((err as Error).message);
      if (/row-level security|permission denied/i.test(msg)) return 'deny';
      throw err; // Fixture- oder Schemafehler sollen den Test rot machen, nicht als „deny“ durchgehen.
    } finally {
      await q(`ROLLBACK TO SAVEPOINT ${sp}`);
      await q(`RESET ROLE`);
    }
  }

  const user = (userId: string): Actor => ({ kind: 'user', userId });
  const anon: Actor = { kind: 'anon' };
  const service: Actor = { kind: 'service' };

  beforeEach(async () => {
    ctx = await openDb();
    // Der Hash-Chain-Trigger von ai_evidence_events ruft extensions.digest auf.
    // Supabase gibt den API-Rollen USAGE auf `extensions`; der CI-Bootstrap
    // nicht. Nur für diese (zurückgerollte) Test-Transaktion nachziehen.
    await q(`GRANT USAGE ON SCHEMA extensions TO anon, authenticated, service_role`);

    const tenant = async (name: string) =>
      (await q<{ id: string }>(`INSERT INTO public.tenants(name) VALUES ($1) RETURNING id`, [name])).rows[0]!.id;
    const mkUser = async () =>
      (await q<{ id: string }>(
        `INSERT INTO auth.users(email) VALUES ($1) RETURNING id`,
        [`g0_${Date.now()}_${Math.random().toString(36).slice(2, 10)}@example.com`],
      )).rows[0]!.id;
    const member = async (tenantId: string, userId: string, role: string) => {
      await q(`INSERT INTO public.memberships(tenant_id, user_id, role) VALUES ($1,$2,$3)`, [tenantId, userId, role]);
      await q(
        `INSERT INTO public.tenant_memberships(tenant_id, user_id, role) VALUES ($1,$2,'owner') ON CONFLICT DO NOTHING`,
        [tenantId, userId],
      );
    };

    ids.tA = await tenant(`g0-A-${Date.now()}`);
    ids.tB = await tenant(`g0-B-${Date.now()}`);
    for (const k of ['owner', 'admin', 'dpo', 'editor', 'viewer', 'ownerB', 'neu', 'neu2'] as const) {
      ids[k] = await mkUser();
    }
    await member(ids.tA, ids.owner, 'owner');
    await member(ids.tA, ids.admin, 'admin');
    await member(ids.tA, ids.dpo, 'dpo');
    await member(ids.tA, ids.editor, 'editor');
    await member(ids.tA, ids.viewer, 'viewer_auditor');
    await member(ids.tB, ids.ownerB, 'owner');

    ids.sysA = (await q<{ id: string }>(
      `INSERT INTO public.ai_systems(tenant_id, name) VALUES ($1, 'sys-A') RETURNING id`, [ids.tA],
    )).rows[0]!.id;
    ids.assessA = (await q<{ id: string }>(
      `INSERT INTO public.ai_act_assessments(tenant_id, ai_system_id) VALUES ($1,$2) RETURNING id`, [ids.tA, ids.sysA],
    )).rows[0]!.id;
    ids.policyA = (await q<{ id: string }>(
      `INSERT INTO public.ai_policies(tenant_id, name, rule_type) VALUES ($1, 'pol-A', 'model_usage') RETURNING id`, [ids.tA],
    )).rows[0]!.id;
    await q(`INSERT INTO public.agent_configuration(tenant_id) VALUES ($1)`, [ids.tA]);
    await q(`INSERT INTO public.agent_token_usage(tenant_id, prompt_type, tokens_used) VALUES ($1,'x',10)`, [ids.tA]);
  });

  afterEach(async () => {
    await closeDb(ctx);
    ctx = null;
  });

  describe('„Service role“-Policies gelten nicht mehr für Clients', () => {
    it('agent_configuration: weder anon noch Mitglieder lesen oder schreiben', async () => {
      expect(await attempt(anon, `SELECT 1 FROM public.agent_configuration`)).toBe('deny');
      expect(await attempt(user(ids.ownerB), `SELECT 1 FROM public.agent_configuration`)).toBe('deny');
      expect(await attempt(user(ids.editor),
        `INSERT INTO public.agent_configuration(tenant_id) VALUES ($1)`, [ids.tB])).toBe('deny');
      expect(await attempt(service,
        `INSERT INTO public.agent_configuration(tenant_id) VALUES ($1)`, [ids.tB])).toBe('allow');
    });

    it('agent_token_usage: nur eigener Mandant lesbar, Schreiben nur service_role', async () => {
      expect(await attempt(anon, `SELECT 1 FROM public.agent_token_usage`)).toBe('deny');
      expect(await attempt(user(ids.ownerB), `SELECT 1 FROM public.agent_token_usage`)).toBe('deny');
      expect(await attempt(user(ids.owner), `SELECT 1 FROM public.agent_token_usage`)).toBe('allow');
      const ins = `INSERT INTO public.agent_token_usage(tenant_id, prompt_type) VALUES ($1,'x')`;
      expect(await attempt(anon, ins, [ids.tA])).toBe('deny');
      expect(await attempt(user(ids.editor), ins, [ids.tA])).toBe('deny');
      expect(await attempt(service, ins, [ids.tA])).toBe('allow');
    });

    it('governance_audit_log: Prüfpfad ist clientseitig nicht beschreibbar', async () => {
      const ins = `INSERT INTO public.governance_audit_log(tenant_id, action, resource_type, resource_id, user_id)
                   VALUES ($1,'forged','x','x',$2)`;
      expect(await attempt(anon, ins, [ids.tA, ids.editor])).toBe('deny');
      expect(await attempt(user(ids.editor), ins, [ids.tA, ids.editor])).toBe('deny');
      expect(await attempt(service, ins, [ids.tA, ids.editor])).toBe('allow');
    });

    it.each([
      ['email_notifications', `INSERT INTO public.email_notifications(tenant_id, recipient_email, event_type, subject, body) VALUES ($1,'a@b.c','x','s','b')`],
      ['dashboard_notifications', `INSERT INTO public.dashboard_notifications(tenant_id, user_id, type, title, body) VALUES ($1,$2,'x','t','b')`],
      ['deployment_logs', `INSERT INTO public.deployment_logs(project_id, tenant_id, event_type, title) VALUES (gen_random_uuid(),$1,'x','t')`],
      ['website_compliance_reports', `INSERT INTO public.website_compliance_reports(project_id, tenant_id, overall_score) VALUES (gen_random_uuid(),$1,1)`],
      ['api_calls', `INSERT INTO public.api_calls(tenant_id, api_key_id, endpoint, method, request_path) VALUES ($1,gen_random_uuid(),'e','GET','/')`],
    ])('%s: kein Client-Insert', async (_t, sql) => {
      const params = sql.includes('$2') ? [ids.tA, ids.editor] : [ids.tA];
      expect(await attempt(anon, sql, params)).toBe('deny');
      expect(await attempt(user(ids.editor), sql, params)).toBe('deny');
    });
  });

  describe('Keine direkten Member-Mutationen auf KI-Governance-Tabellen', () => {
    it('Viewer, Editor und Owner können AI-Systeme nicht direkt anlegen, ändern oder löschen', async () => {
      for (const who of [ids.viewer, ids.editor, ids.owner]) {
        expect(await attempt(user(who),
          `INSERT INTO public.ai_systems(tenant_id, name) VALUES ($1,'neu')`, [ids.tA])).toBe('deny');
        expect(await attempt(user(who),
          `UPDATE public.ai_systems SET name='x' WHERE id=$1`, [ids.sysA])).toBe('deny');
        expect(await attempt(user(who),
          `DELETE FROM public.ai_systems WHERE id=$1`, [ids.sysA])).toBe('deny');
      }
    });

    it('Lesen bleibt mandantenbezogen erhalten', async () => {
      expect(await attempt(user(ids.viewer), `SELECT 1 FROM public.ai_systems WHERE id=$1`, [ids.sysA])).toBe('allow');
      expect(await attempt(user(ids.ownerB), `SELECT 1 FROM public.ai_systems WHERE id=$1`, [ids.sysA])).toBe('deny');
      expect(await attempt(user(ids.viewer), `SELECT 1 FROM public.ai_policies WHERE id=$1`, [ids.policyA])).toBe('allow');
      expect(await attempt(user(ids.viewer), `SELECT 1 FROM public.ai_act_assessments WHERE id=$1`, [ids.assessA])).toBe('allow');
    });

    it('Mitglieder können eine Klassifizierung nicht direkt überschreiben', async () => {
      const upd = `UPDATE public.ai_act_assessments SET classification='minimal_risk' WHERE id=$1`;
      expect(await attempt(user(ids.editor), upd, [ids.assessA])).toBe('deny');
      expect(await attempt(user(ids.owner), upd, [ids.assessA])).toBe('deny');
      expect(await attempt(user(ids.ownerB), upd, [ids.assessA])).toBe('deny');
    });

    it('Mitglieder können Policies nicht direkt manipulieren', async () => {
      for (const who of [ids.editor, ids.owner]) {
        expect(await attempt(user(who),
          `INSERT INTO public.ai_policies(tenant_id, name, rule_type) VALUES ($1,'p','model_usage')`, [ids.tA])).toBe('deny');
        expect(await attempt(user(who), `UPDATE public.ai_policies SET name='x' WHERE id=$1`, [ids.policyA])).toBe('deny');
        expect(await attempt(user(who), `DELETE FROM public.ai_policies WHERE id=$1`, [ids.policyA])).toBe('deny');
      }
    });

    it('service_role behält die Backend-Rechte', async () => {
      expect(await attempt(service,
        `INSERT INTO public.ai_systems(tenant_id, name) VALUES ($1,'neu')`, [ids.tA])).toBe('allow');
      expect(await attempt(service, `UPDATE public.ai_systems SET name='x' WHERE id=$1`, [ids.sysA])).toBe('allow');
      expect(await attempt(service,
        `UPDATE public.ai_act_assessments SET classification='minimal_risk' WHERE id=$1`, [ids.assessA])).toBe('allow');
      expect(await attempt(service, `UPDATE public.ai_policies SET name='x' WHERE id=$1`, [ids.policyA])).toBe('allow');
      expect(await attempt(service, `DELETE FROM public.ai_policies WHERE id=$1`, [ids.policyA])).toBe('allow');
    });
  });

  describe('ai_evidence_events: keine beliebige Evidence durch Mitglieder', () => {
    const otInsert = `INSERT INTO public.ai_evidence_events(tenant_id, event_type, event_summary, risk_level, evidence)
                      VALUES ($1,'ai_act_classification','Industrial OT Vorprüfung','info','{}'::jsonb)`;

    it('Industrial-OT-Fall bleibt für schreibende Rollen erlaubt', async () => {
      for (const who of [ids.owner, ids.admin, ids.dpo, ids.editor]) {
        expect(await attempt(user(who), otInsert, [ids.tA])).toBe('allow');
      }
    });

    it('Viewer, anon und fremde Mandanten schreiben keine Evidence', async () => {
      expect(await attempt(user(ids.viewer), otInsert, [ids.tA])).toBe('deny');
      expect(await attempt(anon, otInsert, [ids.tA])).toBe('deny');
      expect(await attempt(user(ids.ownerB), otInsert, [ids.tA])).toBe('deny');
    });

    it('Andere Evidence-Typen und Verknüpfungen sind clientseitig gesperrt', async () => {
      expect(await attempt(user(ids.editor),
        `INSERT INTO public.ai_evidence_events(tenant_id, event_type, event_summary, risk_level, evidence)
         VALUES ($1,'policy_decision','x','info','{}'::jsonb)`, [ids.tA])).toBe('deny');
      expect(await attempt(user(ids.editor),
        `INSERT INTO public.ai_evidence_events(tenant_id, event_type, event_summary, risk_level, evidence, policy_id)
         VALUES ($1,'ai_act_classification','x','info','{}'::jsonb,$2)`, [ids.tA, ids.policyA])).toBe('deny');
      expect(await attempt(user(ids.editor),
        `INSERT INTO public.ai_evidence_events(tenant_id, event_type, event_summary, risk_level, evidence, ai_system_id)
         VALUES ($1,'ai_act_classification','x','info','{}'::jsonb,$2)`, [ids.tA, ids.sysA])).toBe('deny');
    });

    it('service_role schreibt weiterhin jede Evidence', async () => {
      expect(await attempt(service,
        `INSERT INTO public.ai_evidence_events(tenant_id, event_type, event_summary, risk_level, evidence)
         VALUES ($1,'policy_decision','x','info','{}'::jsonb)`, [ids.tA])).toBe('allow');
    });
  });

  describe('memberships: keine Owner-Erzeugung durch Admins', () => {
    const ins = `INSERT INTO public.memberships(tenant_id, user_id, role) VALUES ($1,$2,$3)`;
    const setRole = `UPDATE public.memberships SET role=$3 WHERE tenant_id=$1 AND user_id=$2`;

    it('Admin kann keinen Owner erzeugen', async () => {
      expect(await attempt(user(ids.admin), ins, [ids.tA, ids.neu, 'owner'])).toBe('deny');
      expect(await attempt(user(ids.admin), setRole, [ids.tA, ids.admin, 'owner'])).toBe('deny');
      expect(await attempt(user(ids.admin), setRole, [ids.tA, ids.editor, 'owner'])).toBe('deny');
    });

    it('Admin kann Owner-Zeilen weder ändern noch löschen', async () => {
      expect(await attempt(user(ids.admin), setRole, [ids.tA, ids.owner, 'editor'])).toBe('deny');
      expect(await attempt(user(ids.admin),
        `DELETE FROM public.memberships WHERE tenant_id=$1 AND user_id=$2`, [ids.tA, ids.owner])).toBe('deny');
    });

    it('Legitime Admin- und Owner-Flows bleiben funktionsfähig', async () => {
      expect(await attempt(user(ids.admin), ins, [ids.tA, ids.neu, 'editor'])).toBe('allow');
      expect(await attempt(user(ids.admin), setRole, [ids.tA, ids.editor, 'dpo'])).toBe('allow');
      expect(await attempt(user(ids.owner), ins, [ids.tA, ids.neu2, 'owner'])).toBe('allow');
      expect(await attempt(user(ids.owner), setRole, [ids.tA, ids.editor, 'admin'])).toBe('allow');
    });

    it('Nicht-Admins, anon und fremde Mandanten ändern keine Mitgliedschaften', async () => {
      expect(await attempt(user(ids.editor), setRole, [ids.tA, ids.editor, 'admin'])).toBe('deny');
      expect(await attempt(user(ids.viewer), ins, [ids.tA, ids.neu, 'viewer_auditor'])).toBe('deny');
      expect(await attempt(user(ids.ownerB), setRole, [ids.tA, ids.editor, 'viewer_auditor'])).toBe('deny');
      expect(await attempt(anon, ins, [ids.tA, ids.neu, 'owner'])).toBe('deny');
    });

    it('Mitglieder lesen weiterhin die Mitgliedschaften ihres Mandanten', async () => {
      expect(await attempt(user(ids.viewer),
        `SELECT 1 FROM public.memberships WHERE tenant_id=$1`, [ids.tA])).toBe('allow');
      expect(await attempt(user(ids.ownerB),
        `SELECT 1 FROM public.memberships WHERE tenant_id=$1`, [ids.tA])).toBe('deny');
    });
  });
});
