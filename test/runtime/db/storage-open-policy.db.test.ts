/**
 * Storage — keine Policy darf Client-Rollen pauschal auf einen Bucket lassen.
 *
 * Anlass: In Produktion stand bis zum 2026-09-07 die Policy
 * `vault buckets full access` (FOR ALL, Rolle `public`, Buckets `bilder` und
 * `dokumente`) — ohne Migration, ohne Aufrufer, ohne Mandantenbezug. Die
 * Migration 20260907120000 entfernt sie. Dieser Test hält fest, dass nach
 * dem vollständigen Migrationslauf keine Policy dieses Namens existiert und
 * dass keine Policy auf storage.objects der Rolle `public` ein pauschales
 * ALL/INSERT/UPDATE/DELETE gewährt.
 *
 * Er läuft gegen das CI-Schema (storage.objects als Stub) und gegen ein
 * `supabase db reset`. Gegen Produktion misst der Betreiber mit derselben
 * Abfrage nach dem Deploy (docs/runbooks/storage-open-bucket-policy.md).
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { closeDb, getDbUrl, openDb, type DbCtx } from './db-helpers';

const skip = !getDbUrl();
const d = skip ? describe.skip : describe;

d('Storage / offene Bucket-Policies (DB)', () => {
  let ctx: DbCtx | null = null;
  beforeEach(async () => { ctx = await openDb(); });
  afterEach(async () => { await closeDb(ctx); ctx = null; });

  it('die Policy „vault buckets full access" existiert nicht', async () => {
    const r = await ctx!.client.query<{ n: number }>(
      `SELECT count(*)::int AS n FROM pg_policies
        WHERE schemaname = 'storage' AND tablename = 'objects'
          AND policyname = 'vault buckets full access'`,
    );
    expect(r.rows[0]!.n).toBe(0);
  });

  it('keine Policy auf storage.objects gewährt der Rolle public Schreibrechte', async () => {
    const r = await ctx!.client.query<{ policyname: string; cmd: string }>(
      `SELECT policyname, cmd FROM pg_policies
        WHERE schemaname = 'storage' AND tablename = 'objects'
          AND 'public' = ANY (roles)
          AND cmd IN ('ALL', 'INSERT', 'UPDATE', 'DELETE')`,
    );
    expect(r.rows).toEqual([]);
  });
});
