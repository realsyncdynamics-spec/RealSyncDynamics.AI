/**
 * DB-Integration test helpers.
 *
 * Tests run against a real Postgres (provisioned via scripts/test-db/up.sh).
 * Each test runs inside a single transaction that is ROLLBACK'd at the end —
 * no test data ever persists, isolation is guaranteed by Postgres itself.
 *
 * If TEST_DB_URL is not set, getDb() returns null and the test files
 * gracefully skip their describe blocks. CI without a DB still passes.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Client, type ClientConfig } from 'pg';

export interface DbCtx {
  /** Connected pg client, inside an open transaction. */
  client: Client;
  /**
   * Run a callback with the given JWT claims set for the transaction.
   * Mirrors Supabase's auth.uid() / auth.role() resolution.
   */
  withClaims<T>(
    claims: { sub?: string; role?: string },
    fn: () => Promise<T>,
  ): Promise<T>;
}

export function getDbUrl(): string | null {
  return process.env.TEST_DB_URL ?? null;
}

/**
 * Open a transactional context for a single test. Throws if TEST_DB_URL
 * is missing — callers should check getDbUrl() first and skip if absent.
 */
export async function openDb(): Promise<DbCtx> {
  const url = getDbUrl();
  if (!url) {
    throw new Error('TEST_DB_URL not set');
  }
  const config: ClientConfig = { connectionString: url };
  const client = new Client(config);
  await client.connect();
  await client.query('BEGIN');

  async function withClaims<T>(
    claims: { sub?: string; role?: string },
    fn: () => Promise<T>,
  ): Promise<T> {
    const payload = JSON.stringify({
      sub: claims.sub ?? null,
      role: claims.role ?? 'authenticated',
    });
    // SAVEPOINT lets us recover the transaction if fn() raises (e.g. RLS
    // forbidden). Without it, a single error from a SECURITY DEFINER raise
    // aborts the outer test transaction.
    const sp = `sp_${Math.random().toString(36).slice(2, 10)}`;
    await client.query(`SAVEPOINT ${sp}`);
    // SET LOCAL doesn't accept bind parameters — use set_config()
    await client.query(`SELECT set_config('request.jwt.claims', $1, true)`, [payload]);
    if (claims.role === 'service_role') {
      await client.query(`SET LOCAL ROLE service_role`);
    } else {
      await client.query(`SET LOCAL ROLE authenticated`);
    }
    try {
      const out = await fn();
      await client.query(`RELEASE SAVEPOINT ${sp}`);
      await client.query(`RESET ROLE`);
      return out;
    } catch (err) {
      await client.query(`ROLLBACK TO SAVEPOINT ${sp}`);
      await client.query(`RESET ROLE`);
      throw err;
    }
  }

  return { client, withClaims };
}

/** Rollback + disconnect. Idempotent; safe to call in afterEach. */
export async function closeDb(ctx: DbCtx | null): Promise<void> {
  if (!ctx) return;
  try {
    await ctx.client.query('ROLLBACK');
  } catch {
    /* already rolled back */
  }
  await ctx.client.end();
}

/**
 * Convenience: create a tenant + a user + membership. Returns IDs.
 * Runs as superuser (the test client) — bypasses RLS so fixture setup is
 * not constrained by the policies under test.
 */
export async function createTenantWithMember(
  ctx: DbCtx,
  opts: { tenantName?: string; userEmail?: string } = {},
): Promise<{ tenantId: string; userId: string }> {
  // Die Vorgabe MUSS je Aufruf verschieden sein: `auth.users.email` ist UNIQUE
  // (so in scripts/test-db/bootstrap.sql und im CI-Bootstrap). Eine feste
  // Adresse liess jeden Test scheitern, der zwei Mandanten anlegt — und das
  // sind genau die Isolationstests, auf die es ankommt. Wer eine bestimmte
  // Adresse braucht, uebergibt sie weiterhin.
  const {
    tenantName = `t_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    userEmail = `u_${Date.now()}_${Math.random().toString(36).slice(2, 10)}@example.com`,
  } = opts;

  const { rows: tRows } = await ctx.client.query<{ id: string }>(
    `INSERT INTO public.tenants(name) VALUES ($1) RETURNING id`,
    [tenantName],
  );
  const tenantId = tRows[0]!.id;

  const { rows: uRows } = await ctx.client.query<{ id: string }>(
    `INSERT INTO auth.users(email) VALUES ($1) RETURNING id`,
    [userEmail],
  );
  const userId = uRows[0]!.id;

  await ctx.client.query(
    `INSERT INTO public.memberships(tenant_id, user_id, role) VALUES ($1,$2,'owner')`,
    [tenantId, userId],
  );
  await ctx.client.query(
    `INSERT INTO public.tenant_memberships(tenant_id, user_id, role) VALUES ($1,$2,'owner')`,
    [tenantId, userId],
  );

  return { tenantId, userId };
}

/** Insert a runtime event with minimal envelope. Returns the new row. */
export async function insertEvent(
  ctx: DbCtx,
  tenantId: string,
  overrides: Partial<{
    type: string;
    severity: string;
    source: string;
    review_status: string;
    subject_ref: string | null;
    payload: unknown;
    trace_id: string | null;
    causation_id: string | null;
  }> = {},
): Promise<{
  id: string;
  global_seq: string;
  tenant_seq: string;
  event_hash: Buffer;
  prev_hash: Buffer | null;
}> {
  const params = {
    type: overrides.type ?? 'test.event',
    severity: overrides.severity ?? 'info',
    source: overrides.source ?? 'integration-test',
    review_status: overrides.review_status ?? 'auto',
    subject_ref: overrides.subject_ref ?? null,
    payload: JSON.stringify(overrides.payload ?? {}),
    trace_id: overrides.trace_id ?? null,
    causation_id: overrides.causation_id ?? null,
  };

  const { rows } = await ctx.client.query<{
    id: string;
    global_seq: string;
    tenant_seq: string;
    event_hash: Buffer;
    prev_hash: Buffer | null;
  }>(
    `INSERT INTO public.runtime_events
       (tenant_id, type, severity, source, review_status, subject_ref,
        payload, trace_id, causation_id)
     VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb,$8,$9)
     RETURNING id, global_seq, tenant_seq, event_hash, prev_hash`,
    [
      tenantId,
      params.type,
      params.severity,
      params.source,
      params.review_status,
      params.subject_ref,
      params.payload,
      params.trace_id,
      params.causation_id,
    ],
  );
  return rows[0]!;
}

/**
 * Macht ein stilles Überspringen zum Fehler, wenn `REQUIRE_DB_TESTS=1` gesetzt
 * ist.
 *
 * Ohne `TEST_DB_URL` überspringen sich DB-Tests still — bequem lokal, fatal in
 * CI: Eine Suite, die nichts prüft, ist dort nicht von einer zu unterscheiden,
 * die alles prüft. `security-regressions.db.test.ts` trug diese Vorkehrung
 * bisher als Einzelstück; hier steht sie einmal, damit jede Datei, die in CI
 * laufen SOLL, sie übernehmen kann.
 *
 * Gibt zurück, ob die Tests laufen können — der Aufrufer wählt damit
 * `describe` oder `describe.skip`.
 */
export function requireDbOrFail(label: string): boolean {
  const url = getDbUrl();
  if (!url && process.env.REQUIRE_DB_TESTS === '1') {
    throw new Error(
      `REQUIRE_DB_TESTS=1, aber TEST_DB_URL fehlt. „${label}" waere still ` +
      'uebersprungen worden — genau der Zustand, den diese Vorkehrung verhindert.',
    );
  }
  return Boolean(url);
}

/**
 * Ein benanntes Geheimnis so hinterlegen, dass `public.get_app_secret()` es
 * findet — und zwar auf dem Weg, den die jeweilige Datenbank wirklich hat.
 *
 * ## Warum das nicht eine Zeile ist
 *
 * Es gibt zwei Fassungen von `get_app_secret`, und welche gilt, entscheidet
 * die Migrationsfolge:
 *
 *   * `20260505230000_app_secret_rpc.sql` liest aus **Vault**
 *     (`vault.decrypted_secrets`). Das ist die Fassung, die in Produktion und
 *     im CI-Schema gilt.
 *   * `20260603000000_subject_ref_lifecycle.sql` legt ersatzweise
 *     `public.app_secrets` an — aber **nur, wenn `get_app_secret` noch nicht
 *     existiert**. Gegen das volle Schema greift dieser Zweig nie.
 *
 * Ein Test, der fest in `public.app_secrets` schreibt, lief deshalb nur im
 * minimalen Harnisch — also genau dort, wo der echte Vault-Pfad fehlt. Er
 * prüfte damit einen Zustand, den es in Produktion nicht gibt.
 *
 * Diese Funktion schreibt in den Speicher, den die Datenbank tatsächlich
 * führt, und bevorzugt Vault. Findet sie keinen von beiden, wirft sie —
 * stillschweigend nichts zu hinterlegen wäre der schlechteste Ausgang, weil
 * der Test dann an einer Folgezeile scheitert und die Ursache verdeckt.
 */
export async function seedAppSecret(
  ctx: DbCtx,
  name: string,
  value: string,
): Promise<void> {
  const { rows } = await ctx.client.query<{ vault: string | null; legacy: string | null }>(
    `SELECT to_regclass('vault.secrets')::text AS vault,
            to_regclass('public.app_secrets')::text AS legacy`,
  );
  const { vault, legacy } = rows[0]!;

  if (vault) {
    await ctx.client.query(
      `INSERT INTO vault.secrets(name, secret) VALUES ($1, $2)
       ON CONFLICT (name) DO UPDATE SET secret = EXCLUDED.secret`,
      [name, value],
    );
    return;
  }
  if (legacy) {
    await ctx.client.query(
      `INSERT INTO public.app_secrets(name, value) VALUES ($1, $2)
       ON CONFLICT (name) DO UPDATE SET value = EXCLUDED.value`,
      [name, value],
    );
    return;
  }
  throw new Error(
    'Weder vault.secrets noch public.app_secrets vorhanden — '
    + 'get_app_secret() kann in dieser Datenbank nichts finden.',
  );
}

/**
 * Eine Migration innerhalb der Testtransaktion anwenden — ohne ihre eigene
 * Transaktionsklammer.
 *
 * ## Der Befund, den diese Funktion behebt
 *
 * Jeder Test hier laeuft in einer Transaktion, die `closeDb()` zurueckrollt.
 * Genau darauf beruht die Isolation. Eine Migration, die selbst `BEGIN;` und
 * `COMMIT;` enthaelt, bricht das: Das `COMMIT` schliesst die AEUSSERE
 * Transaktion ab, und alles, was der Test bis dahin angelegt hat, bleibt
 * dauerhaft in der Datenbank stehen.
 *
 * Am 2026-09-06 gemessen und genau so passiert: `tenant-entitlements-callers`
 * wandte `20260831020000` unveraendert an (Zeile 67 `BEGIN;`, Zeile 191
 * `COMMIT;`) und hinterliess `products`, `entitlements`, `subscriptions` und
 * `entitlement_grants` in der Testdatenbank. Der naechste Lauf von
 * `entitlement-grants.db.test.ts` scheiterte daran mit „relation
 * subscriptions already exists" — an einem Zustand, den ein frueherer Test
 * hinterlassen hatte, nicht an einem Befund. Zwei Dateien hatten die Klammer
 * einzeln entfernt, eine nicht; deshalb steht sie ab jetzt hier.
 *
 * `PostgreSQL` kennt keine geschachtelten Transaktionen — ein `COMMIT` in
 * einer laufenden Transaktion ist kein Fehler, sondern wirkt. Es gibt also
 * keine Absicherung dagegen ausser: die Klammer entfernen.
 */
export function applyMigration(ctx: DbCtx, migrationsDir: string, file: string): Promise<unknown> {
  const sql = readFileSync(join(migrationsDir, file), 'utf8')
    // Alle Vorkommen, nicht nur das erste: Eine Migration darf mehrere
    // Bloecke haben, und ein uebrig gebliebenes COMMIT genuegt fuer den
    // Schaden oben.
    .replace(/^\s*(BEGIN|COMMIT)\s*;\s*$/gm, '');
  return ctx.client.query(sql);
}
