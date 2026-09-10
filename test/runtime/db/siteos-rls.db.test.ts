/**
 * SiteOS — Mandantentrennung der Versionskette (DB integration).
 *
 * Der App Builder Workspace lädt `siteos_blueprints` direkt über den
 * Client (RLS), Schreiben läuft ausschließlich über die Edge Function mit
 * `service_role`. Beides wird hier gegen echtes Postgres nachgewiesen, nicht
 * aus der Migration abgelesen: Tenant A sieht Projekt B nicht, kann es nicht
 * speichern, und ohne Anmeldung ist die Kette leer.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { closeDb, createTenantWithMember, getDbUrl, openDb, type DbCtx } from './db-helpers';

const skip = !getDbUrl();
const d = skip ? describe.skip : describe;

const SHA_A = 'a'.repeat(64);
const SHA_B = 'b'.repeat(64);

async function insertBlueprint(ctx: DbCtx, tenantId: string, slug: string, sha: string): Promise<string> {
  const { rows } = await ctx.client.query<{ id: string }>(
    `INSERT INTO public.siteos_blueprints
       (tenant_id, slug, name, industry, version, blueprint, content_sha256, origin_source)
     VALUES ($1, $2, $3, 'sonstiges', 1, '{"schemaVersion":1,"pages":[]}'::jsonb, $4, 'ai-builder')
     RETURNING id`,
    [tenantId, slug, `Site ${slug}`, sha],
  );
  return rows[0]!.id;
}

d('SiteOS / RLS auf siteos_blueprints (DB)', () => {
  let ctx: DbCtx | null = null;
  beforeEach(async () => { ctx = await openDb(); });
  afterEach(async () => { await closeDb(ctx); ctx = null; });

  it('Tenant A liest nur die eigene Kette — Projekt B ist unsichtbar, auch bei gleichem Slug', async () => {
    const A = await createTenantWithMember(ctx!, { tenantName: 'siteos-A' });
    const B = await createTenantWithMember(ctx!, { tenantName: 'siteos-B' });
    await insertBlueprint(ctx!, A.tenantId, 'praxis', SHA_A);
    await insertBlueprint(ctx!, B.tenantId, 'praxis', SHA_B);

    await ctx!.withClaims({ sub: A.userId }, async () => {
      const r = await ctx!.client.query<{ tenant_id: string; content_sha256: string }>(
        `SELECT tenant_id, content_sha256 FROM public.siteos_blueprints WHERE slug = 'praxis'`,
      );
      expect(r.rows.map((row) => row.content_sha256)).toEqual([SHA_A]);
      expect(r.rows.every((row) => row.tenant_id === A.tenantId)).toBe(true);

      // Genau die Abfrage des Workspace: jüngste Version des Slugs — für B leer.
      const foreign = await ctx!.client.query(
        `SELECT id FROM public.siteos_blueprints WHERE tenant_id = $1 AND slug = 'praxis' ORDER BY version DESC LIMIT 1`,
        [B.tenantId],
      );
      expect(foreign.rowCount).toBe(0);
    });
  });

  it('Tenant A kann Projekt B nicht speichern — und auch die eigene Kette nicht direkt beschreiben', async () => {
    const A = await createTenantWithMember(ctx!, { tenantName: 'siteos-A2' });
    const B = await createTenantWithMember(ctx!, { tenantName: 'siteos-B2' });
    const idB = await insertBlueprint(ctx!, B.tenantId, 'kanzlei', SHA_B);

    await ctx!.withClaims({ sub: A.userId }, async () => {
      // Kein UPDATE-Recht: 0 betroffene Zeilen, keine Fehlermeldung — genau der
      // Fall, den die Oberfläche als NOT_FOUND und nie als „gespeichert" zeigt.
      const upd = await ctx!.client.query(
        `UPDATE public.siteos_blueprints SET name = 'gekapert' WHERE id = $1`, [idB],
      );
      expect(upd.rowCount).toBe(0);
    });

    // Kein INSERT-Recht, auch nicht in den eigenen Mandanten: Versionen
    // vergibt allein die Edge Function (service_role). Der Fehler muss aus
    // `withClaims` herauslaufen, damit der Helper auf den Savepoint
    // zurückrollt — ein innerhalb abgefangener Fehler ließe die Transaktion
    // abgebrochen zurück (RELEASE SAVEPOINT schlägt dann fehl).
    await expect(ctx!.withClaims({ sub: A.userId }, () => ctx!.client.query(
      `INSERT INTO public.siteos_blueprints
         (tenant_id, slug, name, industry, version, blueprint, content_sha256)
       VALUES ($1, 'eigene', 'Eigene', 'sonstiges', 1, '{}'::jsonb, $2)`,
      [A.tenantId, SHA_A],
    ))).rejects.toThrow(/row-level security|permission denied/i);

    // Der Fremdversuch hat nichts verändert.
    const check = await ctx!.client.query<{ name: string }>(`SELECT name FROM public.siteos_blueprints WHERE id = $1`, [idB]);
    expect(check.rows[0]!.name).toBe('Site kanzlei');
  });

  it('ohne Anmeldung ist die Kette leer', async () => {
    const A = await createTenantWithMember(ctx!, { tenantName: 'siteos-anon' });
    await insertBlueprint(ctx!, A.tenantId, 'anon', SHA_A);
    await ctx!.withClaims({}, async () => {
      const r = await ctx!.client.query<{ n: number }>(`SELECT count(*)::int AS n FROM public.siteos_blueprints`);
      expect(r.rows[0]!.n).toBe(0);
    });
  });

  it('Bewertungen und Herkunftskette folgen derselben Trennung', async () => {
    const A = await createTenantWithMember(ctx!, { tenantName: 'siteos-A3' });
    const B = await createTenantWithMember(ctx!, { tenantName: 'siteos-B3' });
    const idB = await insertBlueprint(ctx!, B.tenantId, 'steuer', SHA_B);
    await ctx!.client.query(
      `INSERT INTO public.siteos_publish_evaluations
         (tenant_id, blueprint_id, artifact_sha256, blueprint_sha256, status, evidence_complete, backend_preservation, policy_compliant, human_approval_required)
       VALUES ($1, $2, $3, $3, 'blocked', true, 'preserve_all', false, false)`,
      [B.tenantId, idB, SHA_B],
    );
    await ctx!.withClaims({ sub: A.userId }, async () => {
      const r = await ctx!.client.query<{ n: number }>(`SELECT count(*)::int AS n FROM public.siteos_publish_evaluations WHERE blueprint_id = $1`, [idB]);
      expect(r.rows[0]!.n).toBe(0);
    });
    await ctx!.withClaims({ sub: B.userId }, async () => {
      const r = await ctx!.client.query<{ n: number }>(`SELECT count(*)::int AS n FROM public.siteos_publish_evaluations WHERE blueprint_id = $1`, [idB]);
      expect(r.rows[0]!.n).toBe(1);
    });
  });
});
