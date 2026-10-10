/**
 * Domain Enrollment — `pilot_enroll_monitoring_source` (Migration 20261010120000).
 *
 * ## Warum gegen echtes Postgres
 *
 * `provision-tenant` ruft die Funktion im catalog-Schritt auf und ist zugleich
 * der Status-Endpunkt des Tenant-Boots, wird also wiederholt aufgerufen. Die
 * Fassung aus 20260811020648 setzte eine vorhandene Quelle bei jedem Aufruf
 * auf `active` und `next_scan_at = now()` — jeder Status-Abruf hätte einen
 * Scan ausgelöst und eine pausierte Quelle reaktiviert. Ob das jetzt
 * unterbleibt, hängt an plpgsql, Advisory-Lock und GRANTs: nichts davon ist in
 * TypeScript nachbildbar.
 *
 * ## Matrix
 *
 *   erster Aufruf               → eine aktive Quelle, Scan sofort fällig
 *   zweiter Aufruf, pausiert    → dieselbe id, Status und Zeitplan unverändert
 *   gleiche URL, anderer Tenant → eigene Quelle (keine Mandanten-Vermischung)
 *   leere URL                   → Fehler statt Leerzeile
 *   authenticated               → kein EXECUTE (42501)
 *
 * Ohne TEST_DB_URL wird übersprungen (Muster der übrigen *.db.test.ts).
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { applyMigration, closeDb, createTenantWithMember, getDbUrl, openDb, type DbCtx } from './db-helpers';

const __dirname = dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = join(__dirname, '..', '..', '..', 'supabase', 'migrations');

const skip = !getDbUrl();
const d = skip ? describe.skip : describe;

const SERVER = { role: 'service_role' } as const;
const URL = 'https://example.com';

interface PgError extends Error { code?: string }

d('pilot_enroll_monitoring_source', () => {
  let ctx: DbCtx;

  beforeEach(async () => {
    ctx = await openDb();
    await applyMigration(ctx, MIGRATIONS_DIR, '20261010120000_pilot_enroll_monitoring_source_insert_only.sql');
  });
  afterEach(async () => { await closeDb(ctx); });

  async function enroll(tenantId: string, url = URL, name = 'example.com'): Promise<string> {
    return ctx.withClaims(SERVER, async () => {
      const { rows } = await ctx.client.query<{ id: string }>(
        `SELECT public.pilot_enroll_monitoring_source($1, $2, $3) AS id`,
        [tenantId, url, name],
      );
      return rows[0]!.id;
    });
  }

  async function source(id: string) {
    const { rows } = await ctx.client.query<{
      status: string; next_scan_at: Date | null; name: string; type: string; scan_frequency: string;
    }>(
      `SELECT status, next_scan_at, name, type, scan_frequency FROM public.monitoring_sources WHERE id = $1`,
      [id],
    );
    return rows[0]!;
  }

  async function countFor(tenantId: string): Promise<number> {
    const { rows } = await ctx.client.query<{ n: string }>(
      `SELECT count(*) AS n FROM public.monitoring_sources WHERE tenant_id = $1`,
      [tenantId],
    );
    return Number(rows[0]!.n);
  }

  it('legt beim ersten Aufruf eine aktive, sofort fällige Website-Quelle an', async () => {
    const { tenantId } = await createTenantWithMember(ctx);
    const id = await enroll(tenantId);

    const row = await source(id);
    expect(row).toMatchObject({ status: 'active', name: 'example.com', type: 'website', scan_frequency: 'daily' });
    expect(row.next_scan_at).not.toBeNull();
    expect(await countFor(tenantId)).toBe(1);
  });

  it('lässt eine vorhandene Quelle beim zweiten Aufruf unverändert — auch wenn sie pausiert ist', async () => {
    const { tenantId } = await createTenantWithMember(ctx);
    const id = await enroll(tenantId);

    // Der Kunde pausiert die Quelle; der Scheduler hat den nächsten Scan
    // weit in die Zukunft gelegt.
    const later = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    await ctx.client.query(
      `UPDATE public.monitoring_sources SET status = 'paused', next_scan_at = $2 WHERE id = $1`,
      [id, later],
    );

    // Wiederholter Boot-/Status-Aufruf.
    const again = await enroll(tenantId);

    expect(again).toBe(id);
    const row = await source(id);
    expect(row.status).toBe('paused');
    expect(row.next_scan_at?.getTime()).toBe(later.getTime());
    expect(await countFor(tenantId)).toBe(1);
  });

  it('trennt Mandanten: dieselbe URL bei einem anderen Tenant ist eine eigene Quelle', async () => {
    const a = await createTenantWithMember(ctx);
    const b = await createTenantWithMember(ctx);

    const idA = await enroll(a.tenantId);
    const idB = await enroll(b.tenantId);

    expect(idA).not.toBe(idB);
    expect(await countFor(a.tenantId)).toBe(1);
    expect(await countFor(b.tenantId)).toBe(1);
  });

  it('lehnt eine leere URL ab, statt eine Leerzeile anzulegen', async () => {
    const { tenantId } = await createTenantWithMember(ctx);
    await expect(enroll(tenantId, '   ')).rejects.toThrow(/tenant_id und url sind erforderlich/);
    expect(await countFor(tenantId)).toBe(0);
  });

  it('ist für authenticated nicht ausführbar — nur die Edge Function darf eintragen', async () => {
    const { tenantId, userId } = await createTenantWithMember(ctx);

    const err = await ctx.withClaims({ sub: userId, role: 'authenticated' }, () =>
      ctx.client.query(`SELECT public.pilot_enroll_monitoring_source($1, $2, $3)`, [tenantId, URL, 'example.com']),
    ).catch((e: PgError) => e);

    expect((err as PgError).code).toBe('42501');
    expect(await countFor(tenantId)).toBe(0);
  });
});
