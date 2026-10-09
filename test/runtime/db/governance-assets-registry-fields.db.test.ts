/**
 * KI-Register-Felder auf governance_assets und Nachweis-Statistik
 * (Migration 20261005130000_governance_assets_ai_registry_fields.sql).
 *
 * - CHECK-Constraints: nur die Werte aus Auftrag §14 / registryFields.ts.
 * - Mitglieder schreiben die Felder nicht direkt (nur governance-resources).
 * - governance_asset_evidence_stats läuft mit security_invoker: jedes Mitglied
 *   sieht nur die Zahlen seines Mandanten, anon gar nichts.
 *
 * Läuft nur mit gesetztem TEST_DB_URL; in CI setzt der db-Job die Variable.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { closeDb, getDbUrl, openDb, type DbCtx } from './db-helpers';

const dbUrl = getDbUrl();

if (!dbUrl && process.env.REQUIRE_DB_TESTS === '1') {
  describe('governance_assets KI-Register-Felder', () => {
    it('TEST_DB_URL muss gesetzt sein, wenn REQUIRE_DB_TESTS=1', () => {
      throw new Error('REQUIRE_DB_TESTS=1, aber TEST_DB_URL fehlt.');
    });
  });
}

const d = dbUrl ? describe : describe.skip;

type Actor = { kind: 'anon' } | { kind: 'user'; userId: string };

d('governance_assets KI-Register-Felder', () => {
  let ctx: DbCtx | null = null;
  const ids = {} as { tA: string; tB: string; editorA: string; ownerB: string; assetA: string; assetB: string };

  async function q<T extends Record<string, unknown> = Record<string, unknown>>(sql: string, params: unknown[] = []) {
    return ctx!.client.query<T>(sql, params);
  }

  /** Führt `sql` als `actor` im Savepoint aus; liefert Zeilen oder den Fehlertext. */
  async function as<T extends Record<string, unknown>>(actor: Actor, sql: string, params: unknown[] = []) {
    const sp = `sp_${Math.random().toString(36).slice(2, 10)}`;
    await q(`SAVEPOINT ${sp}`);
    try {
      if (actor.kind === 'anon') {
        await q(`SELECT set_config('request.jwt.claims', $1, true)`, [JSON.stringify({ role: 'anon' })]);
        await q(`SET LOCAL ROLE anon`);
      } else {
        await q(`SELECT set_config('request.jwt.claims', $1, true)`, [JSON.stringify({ sub: actor.userId, role: 'authenticated' })]);
        await q(`SET LOCAL ROLE authenticated`);
      }
      const res = await q<T>(sql, params);
      return { rows: res.rows, rowCount: res.rowCount ?? 0, error: null as string | null };
    } catch (err) {
      return { rows: [] as T[], rowCount: 0, error: String((err as Error).message) };
    } finally {
      await q(`ROLLBACK TO SAVEPOINT ${sp}`);
      await q(`RESET ROLE`);
    }
  }

  /** Erwartet eine CHECK-Verletzung (23514) für das Update als Superuser. */
  async function rejects(sql: string, params: unknown[]): Promise<boolean> {
    const sp = `sp_${Math.random().toString(36).slice(2, 10)}`;
    await q(`SAVEPOINT ${sp}`);
    try {
      await q(sql, params);
      return false;
    } catch (err) {
      return (err as { code?: string }).code === '23514';
    } finally {
      await q(`ROLLBACK TO SAVEPOINT ${sp}`);
    }
  }

  beforeEach(async () => {
    ctx = await openDb();
    const tenant = async (name: string) =>
      (await q<{ id: string }>(`INSERT INTO public.tenants(name) VALUES ($1) RETURNING id`, [name])).rows[0]!.id;
    const mkUser = async () =>
      (await q<{ id: string }>(
        `INSERT INTO auth.users(email) VALUES ($1) RETURNING id`,
        [`reg_${Date.now()}_${Math.random().toString(36).slice(2, 10)}@example.com`],
      )).rows[0]!.id;

    ids.tA = await tenant(`reg-A-${Date.now()}`);
    ids.tB = await tenant(`reg-B-${Date.now()}`);
    ids.editorA = await mkUser();
    ids.ownerB = await mkUser();
    await q(`INSERT INTO public.memberships(tenant_id, user_id, role) VALUES ($1,$2,'editor'), ($3,$4,'owner')`,
      [ids.tA, ids.editorA, ids.tB, ids.ownerB]);

    const asset = async (tenantId: string, name: string) => (await q<{ id: string }>(
      `INSERT INTO public.governance_assets(tenant_id, asset_type, name, ai_system_type, model_name, deployment_model, data_residency)
       VALUES ($1, 'ai_system', $2, 'local_ai', 'granite4.2:8b', 'local_device', 'eu') RETURNING id`,
      [tenantId, name],
    )).rows[0]!.id;
    ids.assetA = await asset(ids.tA, 'Lokales Modell A');
    ids.assetB = await asset(ids.tB, 'Lokales Modell B');

    const evidence = async (tenantId: string, assetId: string, at: string) => q(
      `INSERT INTO public.governance_evidence(tenant_id, asset_id, evidence_type, title, created_at)
       VALUES ($1, $2, 'json', 'Klassifizierung', $3)`,
      [tenantId, assetId, at],
    );
    await evidence(ids.tA, ids.assetA, '2026-09-01T00:00:00Z');
    await evidence(ids.tA, ids.assetA, '2026-09-20T10:00:00Z');
    await evidence(ids.tB, ids.assetB, '2026-08-01T00:00:00Z');
  });

  afterEach(async () => {
    await closeDb(ctx);
    ctx = null;
  });

  it('CHECK: nur die Wertelisten aus Auftrag §14', async () => {
    const upd = (col: string) => `UPDATE public.governance_assets SET ${col} = $2 WHERE id = $1`;
    expect(await rejects(upd('ai_system_type'), [ids.assetA, 'quantum'])).toBe(true);
    expect(await rejects(upd('deployment_model'), [ids.assetA, 'mars'])).toBe(true);
    expect(await rejects(upd('data_residency'), [ids.assetA, 'eu-ish'])).toBe(true);
    expect(await rejects(upd('model_name'), [ids.assetA, 'x'.repeat(201)])).toBe(true);
    expect(await rejects(upd('model_name'), [ids.assetA, ''])).toBe(true);
    for (const [col, v] of [['ai_system_type', 'browser_agent'], ['deployment_model', 'on_premises'], ['data_residency', 'adequacy']]) {
      expect(await rejects(upd(col!), [ids.assetA, v])).toBe(false);
    }
  });

  it('Mitglieder schreiben die Felder nicht direkt — nur über governance-resources', async () => {
    const r = await as(
      { kind: 'user', userId: ids.editorA },
      `UPDATE public.governance_assets SET data_residency = 'third_country' WHERE id = $1`,
      [ids.assetA],
    );
    expect(r.error === null ? r.rowCount : 0).toBe(0);
    const { rows } = await q<{ data_residency: string }>(`SELECT data_residency FROM public.governance_assets WHERE id = $1`, [ids.assetA]);
    expect(rows[0]!.data_residency).toBe('eu');
  });

  it('Nachweis-Statistik: eigener Mandant mit Anzahl und jüngstem Zeitpunkt, fremder nie', async () => {
    const sql = `SELECT asset_id, evidence_count, latest_evidence_at FROM public.governance_asset_evidence_stats`;
    const a = await as<{ asset_id: string; evidence_count: number; latest_evidence_at: Date }>({ kind: 'user', userId: ids.editorA }, sql);
    expect(a.error).toBeNull();
    expect(a.rows.map((r) => r.asset_id)).toEqual([ids.assetA]);
    expect(a.rows[0]!.evidence_count).toBe(2);
    expect(new Date(a.rows[0]!.latest_evidence_at).toISOString()).toBe('2026-09-20T10:00:00.000Z');

    const b = await as<{ asset_id: string }>({ kind: 'user', userId: ids.ownerB }, sql);
    expect(b.rows.map((r) => r.asset_id)).toEqual([ids.assetB]);
  });

  it('anon liest die Statistik nicht', async () => {
    const r = await as({ kind: 'anon' }, `SELECT 1 FROM public.governance_asset_evidence_stats`);
    expect(r.rows).toHaveLength(0);
  });

  it('die View läuft mit den Rechten des Aufrufers (security_invoker)', async () => {
    const { rows } = await q<{ opts: string[] | null }>(
      `SELECT reloptions AS opts FROM pg_class WHERE oid = 'public.governance_asset_evidence_stats'::regclass`,
    );
    expect(rows[0]!.opts ?? []).toEqual(expect.arrayContaining([expect.stringMatching(/^security_invoker=(on|true)$/)]));
  });
});
