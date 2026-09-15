/**
 * try_dispatch_welcome_email muss aufrufbar sein und darf die Anmeldung
 * nicht sprengen — auch ohne Vault-Secret und ohne pg_net.
 *
 * Ohne TEST_DB_URL wird der Block übersprungen (wie die übrigen Dateien hier).
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { closeDb, getDbUrl, openDb, type DbCtx } from './db-helpers';

const skip = !getDbUrl();
const d = skip ? describe.skip : describe;

d('welcome-email Signup-Dispatch (DB)', () => {
  let ctx: DbCtx | null = null;
  beforeEach(async () => { ctx = await openDb(); });
  afterEach(async () => { await closeDb(ctx); ctx = null; });

  it('try_dispatch_welcome_email kehrt ohne Fehler zurück', async () => {
    await expect(
      ctx!.client.query(
        `SELECT public.try_dispatch_welcome_email($1::uuid)`,
        ['00000000-0000-4000-8000-000000000001'],
      ),
    ).resolves.toBeTruthy();
  });

  it('INSERT in auth.users bleibt möglich, wenn der Dispatch fehlschlägt', async () => {
    const email = `welcome_${Date.now()}_${Math.random().toString(36).slice(2, 8)}@example.com`;
    const { rows } = await ctx!.client.query<{ id: string }>(
      `INSERT INTO auth.users(email) VALUES ($1) RETURNING id`,
      [email],
    );
    expect(rows[0]?.id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    );
  });
});
