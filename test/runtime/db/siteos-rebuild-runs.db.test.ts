/**
 * SiteOS Rebuild-Läufe — RLS- und Schema-Invarianten (DB).
 *
 * Migration `20261010120000_siteos_rebuild_runs.sql` (Ersatz-Schnitt 1 aus
 * #1727). Der Ursprungs-PR prüfte die Tabelle nur über den Handler-Quelltext,
 * nicht an der Datenbank. Hier steht, was die Migration zusichert:
 *   - RLS an
 *   - SELECT nur für Mitglieder des Mandanten (is_tenant_member)
 *   - anon liest nichts, authenticated schreibt nichts, nur service_role schreibt
 *   - snapshot_sha256 und siteos_publish_evaluations.backend_sha256 nur als
 *     64-stelliges Hex
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  closeDb,
  createTenantWithMember,
  openDb,
  requireDbOrFail,
  type DbCtx,
} from './db-helpers';

const d = requireDbOrFail('siteos-rebuild-runs') ? describe : describe.skip;

const HASH = 'a'.repeat(64);

async function als<T>(
  ctx: DbCtx,
  rolle: 'anon' | 'authenticated' | 'service_role',
  sub: string | null,
  fn: () => Promise<T>,
): Promise<T> {
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
    // Erst zurückrollen: nach einem Fehler ist die Transaktion abgebrochen
    // (25P02), auch RESET ROLE scheitert bis dahin. Reihenfolge wie
    // withClaims in db-helpers.ts.
    await ctx.client.query(`ROLLBACK TO SAVEPOINT ${sp}`);
    await ctx.client.query(`RESET ROLE`);
    throw err;
  }
}

function lauf(tenantId: string, sha = HASH): { text: string; values: unknown[] } {
  return {
    text:
    `INSERT INTO public.siteos_rebuild_runs
       (tenant_id, source_url, resolved_url, host, engine_version,
        snapshot, snapshot_sha256, positioning, assessment, directions)
     VALUES ($1, 'https://beispiel.de', 'https://beispiel.de/', 'beispiel.de', 'test',
             '{}'::jsonb, $2, '{}'::jsonb, '{}'::jsonb, '[]'::jsonb)
     RETURNING id`,
    values: [tenantId, sha],
  };
}

d('siteos_rebuild_runs / schema + RLS', () => {
  let ctx: DbCtx | null = null;
  beforeEach(async () => { ctx = await openDb(); });
  afterEach(async () => { await closeDb(ctx); ctx = null; });

  it('RLS ist eingeschaltet', async () => {
    const { rows } = await ctx!.client.query<{ rls: boolean }>(
      `SELECT c.relrowsecurity AS rls
       FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
       WHERE n.nspname = 'public' AND c.relname = 'siteos_rebuild_runs'`,
    );
    expect(rows).toEqual([{ rls: true }]);
  });

  it('Rechte: authenticated nur SELECT, anon nichts — unabhängig von RLS', async () => {
    // Die Default Privileges geben jeder neuen Tabelle Schreibrechte für
    // anon/authenticated. Ohne REVOKE hinge die Schreibsperre allein am Fehlen
    // einer Schreib-Policy. Diese Prüfung liest die Rechte selbst.
    const { rows } = await ctx!.client.query<{ rolle: string; recht: string; hat: boolean }>(
      `SELECT r AS rolle, p AS recht,
              has_table_privilege(r, 'public.siteos_rebuild_runs', p) AS hat
       FROM unnest(ARRAY['anon', 'authenticated']) AS r,
            unnest(ARRAY['SELECT', 'INSERT', 'UPDATE', 'DELETE']) AS p
       ORDER BY 1, 2`,
    );
    const erlaubt = rows.filter((z) => z.hat).map((z) => `${z.rolle}:${z.recht}`);
    expect(erlaubt).toEqual(['authenticated:SELECT']);
  });

  it('nur service_role schreibt; authenticated und anon nicht', async () => {
    const A = await createTenantWithMember(ctx!, { tenantName: 'srr-ins' });

    await expect(
      als(ctx!, 'authenticated', A.userId, () => ctx!.client.query(lauf(A.tenantId))),
    ).rejects.toBeTruthy();
    await expect(
      als(ctx!, 'anon', null, () => ctx!.client.query(lauf(A.tenantId))),
    ).rejects.toBeTruthy();

    const { rows } = await als(ctx!, 'service_role', null, () =>
      ctx!.client.query<{ id: string }>(lauf(A.tenantId)),
    );
    expect(rows).toHaveLength(1);
  });

  it('Mitglied liest eigene Läufe, fremder Mandant und anon nicht', async () => {
    const A = await createTenantWithMember(ctx!, { tenantName: 'srr-a' });
    const B = await createTenantWithMember(ctx!, { tenantName: 'srr-b' });
    await als(ctx!, 'service_role', null, () => ctx!.client.query(lauf(A.tenantId)));

    const eigene = await als(ctx!, 'authenticated', A.userId, async () =>
      (await ctx!.client.query(`SELECT tenant_id FROM public.siteos_rebuild_runs`)).rows,
    );
    expect(eigene).toEqual([{ tenant_id: A.tenantId }]);

    const fremde = await als(ctx!, 'authenticated', B.userId, async () =>
      (await ctx!.client.query(`SELECT tenant_id FROM public.siteos_rebuild_runs`)).rows,
    );
    expect(fremde).toEqual([]);

    // anon hat keinen Grant (REVOKE ALL): Abfrage scheitert, statt leer zu antworten.
    await expect(
      als(ctx!, 'anon', null, () => ctx!.client.query(`SELECT 1 FROM public.siteos_rebuild_runs`)),
    ).rejects.toBeTruthy();
  });

  it('snapshot_sha256 nimmt nur 64-stelliges Hex an', async () => {
    const A = await createTenantWithMember(ctx!, { tenantName: 'srr-sha' });
    await expect(
      als(ctx!, 'service_role', null, () => ctx!.client.query(lauf(A.tenantId, 'kein-hash'))),
    ).rejects.toMatchObject({ code: '23514' });
  });

  it('siteos_publish_evaluations.backend_sha256 hat die Hex-Prüfung', async () => {
    const { rows } = await ctx!.client.query<{ def: string }>(
      `SELECT pg_get_constraintdef(con.oid) AS def
       FROM pg_constraint con
       JOIN pg_class c ON c.oid = con.conrelid
       JOIN pg_namespace n ON n.oid = c.relnamespace
       WHERE n.nspname = 'public' AND c.relname = 'siteos_publish_evaluations'
         AND con.contype = 'c' AND pg_get_constraintdef(con.oid) LIKE '%backend_sha256%'`,
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]!.def).toContain('[0-9a-f]{64}');
  });
});
