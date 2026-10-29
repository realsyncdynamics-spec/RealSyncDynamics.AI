/**
 * AI-OS — `ai_os_action_log` (20261029092000_ai_os_action_log.sql).
 *
 * Belegt gegen echtes Postgres:
 *  - Clients dürfen nicht schreiben; nur service_role fügt ein.
 *  - Lesen nur für aktive Plattform-Operatoren (is_platform_operator()).
 *  - Append-only: UPDATE/DELETE scheitern für jede Rolle.
 *  - `critical` ist als Aktionsklasse ausgeschlossen.
 *
 * Ohne TEST_DB_URL wird übersprungen (Muster der übrigen *.db.test.ts).
 */
import { randomUUID } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { closeDb, createTenantWithMember, getDbUrl, openDb, type DbCtx } from './db-helpers';

const d = getDbUrl() ? describe : describe.skip;

d('ai_os_action_log — Plattform-Protokoll des AI-OS', () => {
  let ctx: DbCtx | null = null;
  beforeEach(async () => { ctx = await openDb(); });
  afterEach(async () => { await closeDb(ctx); ctx = null; });

  async function seedNutzer(): Promise<string> {
    const u = await createTenantWithMember(ctx!);
    await ctx!.client.query(
      `INSERT INTO public.profiles (id, full_name) VALUES ($1, 'Test') ON CONFLICT (id) DO NOTHING`,
      [u.userId],
    );
    return u.userId;
  }

  async function eintrag(actor: string, actionClass = 'write'): Promise<void> {
    await ctx!.client.query(
      `INSERT INTO public.ai_os_action_log (request_id, actor_user_id, action_id, agent_id, action_class, phase, target)
       VALUES ($1, $2, 'github.workflow.dispatch', 'development', $3, 'requested', 'ai-os-github-status.yml')`,
      [randomUUID(), actor, actionClass],
    );
  }

  it('anon und authenticated dürfen nicht schreiben, authenticated nur lesen', async () => {
    for (const recht of ['INSERT', 'UPDATE', 'DELETE']) {
      for (const rolle of ['anon', 'authenticated']) {
        const { rows } = await ctx!.client.query<{ v: boolean }>(
          `SELECT has_table_privilege($1, 'public.ai_os_action_log', $2) AS v`, [rolle, recht],
        );
        expect(rows[0]!.v, `${rolle} darf ${recht} nicht`).toBe(false);
      }
    }
    const { rows } = await ctx!.client.query<{ v: boolean }>(
      `SELECT has_table_privilege('service_role', 'public.ai_os_action_log', 'INSERT') AS v`,
    );
    expect(rows[0]!.v).toBe(true);
  });

  it('nur aktive Operatoren sehen Einträge', async () => {
    const operator = await seedNutzer();
    const normal = await seedNutzer();
    await ctx!.client.query(`INSERT INTO public.platform_operators (user_id) VALUES ($1)`, [operator]);
    await eintrag(operator);

    const sicht = (sub: string) => ctx!.withClaims({ sub }, async () => {
      const { rows } = await ctx!.client.query<{ n: string }>(`SELECT count(*)::text AS n FROM public.ai_os_action_log`);
      return Number(rows[0]!.n);
    });
    expect(await sicht(operator)).toBeGreaterThan(0);
    expect(await sicht(normal)).toBe(0);
  });

  it('ist append-only — UPDATE und DELETE scheitern', async () => {
    const actor = await seedNutzer();
    await eintrag(actor);
    await expect(ctx!.client.query(`SAVEPOINT u; UPDATE public.ai_os_action_log SET phase = 'succeeded'`))
      .rejects.toThrow(/append-only/);
    await ctx!.client.query('ROLLBACK TO SAVEPOINT u');
    await expect(ctx!.client.query(`SAVEPOINT x; DELETE FROM public.ai_os_action_log`))
      .rejects.toThrow(/append-only/);
    await ctx!.client.query('ROLLBACK TO SAVEPOINT x');
  });

  it('kritische Aktionen sind als Klasse ausgeschlossen', async () => {
    const actor = await seedNutzer();
    await ctx!.client.query('SAVEPOINT c');
    await expect(eintrag(actor, 'critical')).rejects.toThrow(/check constraint/i);
    await ctx!.client.query('ROLLBACK TO SAVEPOINT c');
  });
});
