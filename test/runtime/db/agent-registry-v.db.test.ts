/**
 * agent_registry_v (M1-a/M1-b Command Center) — Mandantentrennung.
 *
 * Die Sicht ist `security_invoker = on`; die RLS der Basistabellen
 * (autonomous_agents: is_tenant_member) muss also für den Aufrufer greifen.
 * Geprüft wird die WIRKUNG unter echten Rollen:
 *   - Mitglied von A sieht A-Agenten, nicht B-Agenten
 *   - anon hat keinen Zugriff auf die Sicht
 *   - Status wird aus dem letzten Run abgeleitet, sonst 'unknown'
 *
 * Läuft nur mit gesetztem TEST_DB_URL; in CI setzt der db-Job die Variable.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { closeDb, getDbUrl, openDb, type DbCtx } from './db-helpers';

const dbUrl = getDbUrl();

if (!dbUrl && process.env.REQUIRE_DB_TESTS === '1') {
  describe('agent_registry_v RLS', () => {
    it('TEST_DB_URL muss gesetzt sein, wenn REQUIRE_DB_TESTS=1', () => {
      throw new Error('REQUIRE_DB_TESTS=1, aber TEST_DB_URL fehlt.');
    });
  });
}

const d = dbUrl ? describe : describe.skip;

d('agent_registry_v RLS', () => {
  let ctx: DbCtx | null = null;
  const ids = {} as { tA: string; tB: string; uA: string; uB: string; agentA: string; agentB: string };
  const q = <T extends Record<string, unknown> = Record<string, unknown>>(sql: string, p: unknown[] = []) =>
    ctx!.client.query<T>(sql, p);

  async function asRole<T>(role: 'anon' | 'authenticated', sub: string | null, fn: () => Promise<T>): Promise<T> {
    const sp = `sp_${Math.random().toString(36).slice(2, 10)}`;
    await q(`SAVEPOINT ${sp}`);
    try {
      await q(`SELECT set_config('request.jwt.claims', $1, true)`, [JSON.stringify({ sub, role })]);
      await q(`SET LOCAL ROLE ${role}`);
      return await fn();
    } finally {
      await q(`ROLLBACK TO SAVEPOINT ${sp}`);
      await q(`RESET ROLE`);
    }
  }

  const visibleAutonomous = async (sub: string) =>
    asRole('authenticated', sub, async () =>
      (await q<{ registry_id: string; status: string }>(
        `SELECT registry_id, status FROM public.agent_registry_v WHERE source = 'autonomous_agents' ORDER BY registry_id`,
      )).rows);

  beforeEach(async () => {
    ctx = await openDb();
    const tenant = async (n: string) =>
      (await q<{ id: string }>(`INSERT INTO public.tenants(name) VALUES ($1) RETURNING id`, [n])).rows[0]!.id;
    const user = async () =>
      (await q<{ id: string }>(`INSERT INTO auth.users(email) VALUES ($1) RETURNING id`, [
        `reg_${Date.now()}_${Math.random().toString(36).slice(2, 10)}@example.com`,
      ])).rows[0]!.id;
    ids.tA = await tenant(`reg-A-${Date.now()}`);
    ids.tB = await tenant(`reg-B-${Date.now()}`);
    ids.uA = await user();
    ids.uB = await user();
    await q(`INSERT INTO public.memberships(tenant_id, user_id, role) VALUES ($1,$2,'owner'),($3,$4,'owner')`,
      [ids.tA, ids.uA, ids.tB, ids.uB]);
    const agent = async (t: string, name: string) =>
      (await q<{ id: string }>(
        `INSERT INTO public.autonomous_agents(tenant_id, name, type) VALUES ($1,$2,'monitoring') RETURNING id`, [t, name],
      )).rows[0]!.id;
    ids.agentA = await agent(ids.tA, 'Agent A');
    ids.agentB = await agent(ids.tB, 'Agent B');
    await q(`INSERT INTO public.autonomous_agent_runs(agent_id, tenant_id, triggered_by, status) VALUES ($1,$2,'manual','failed')`,
      [ids.agentA, ids.tA]);
  });

  afterEach(async () => {
    await closeDb(ctx);
    ctx = null;
  });

  it('Mitglied A sieht nur Agenten von Mandant A', async () => {
    const rows = await visibleAutonomous(ids.uA);
    expect(rows.map((r) => r.registry_id)).toEqual([`autonomous:${ids.agentA}`]);
  });

  it('Mitglied B sieht Agent A nicht', async () => {
    const rows = await visibleAutonomous(ids.uB);
    expect(rows.map((r) => r.registry_id)).toEqual([`autonomous:${ids.agentB}`]);
  });

  it('Status: fehlgeschlagener Run → error; ohne Run → unknown', async () => {
    expect((await visibleAutonomous(ids.uA))[0]!.status).toBe('error');
    expect((await visibleAutonomous(ids.uB))[0]!.status).toBe('unknown');
  });

  it('anon hat keinen Zugriff auf die Sicht', async () => {
    await expect(
      asRole('anon', null, () => q(`SELECT 1 FROM public.agent_registry_v LIMIT 1`)),
    ).rejects.toThrow(/permission denied/i);
  });
});
