/**
 * linkedin_oauth_states — RLS an, keine Client-Rechte.
 * Der State enthält keine Tokens; nur service_role liest und schreibt.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { closeDb, openDb, requireDbOrFail, type DbCtx } from './db-helpers';

const d = requireDbOrFail('linkedin-oauth-states') ? describe : describe.skip;

d('linkedin_oauth_states', () => {
  let ctx: DbCtx | null = null;
  beforeEach(async () => { ctx = await openDb(); });
  afterEach(async () => { await closeDb(ctx); ctx = null; });

  it('hält RLS und vergibt die Tabelle nur an service_role', async () => {
    const flags = await ctx!.client.query<{ relrowsecurity: boolean }>(
      `SELECT relrowsecurity FROM pg_class
        WHERE oid = 'public.linkedin_oauth_states'::regclass`,
    );
    expect(flags.rows[0]?.relrowsecurity).toBe(true);

    const policies = await ctx!.client.query<{ n: number }>(
      `SELECT count(*)::int AS n FROM pg_policy
        WHERE polrelid = 'public.linkedin_oauth_states'::regclass`,
    );
    expect(policies.rows[0]?.n).toBe(0);

    const priv = await ctx!.client.query<{
      anon_select: boolean;
      auth_select: boolean;
      auth_insert: boolean;
      service_select: boolean;
      service_insert: boolean;
      service_update: boolean;
      service_delete: boolean;
    }>(
      `SELECT
         has_table_privilege('anon', 'public.linkedin_oauth_states', 'SELECT') AS anon_select,
         has_table_privilege('authenticated', 'public.linkedin_oauth_states', 'SELECT') AS auth_select,
         has_table_privilege('authenticated', 'public.linkedin_oauth_states', 'INSERT') AS auth_insert,
         has_table_privilege('service_role', 'public.linkedin_oauth_states', 'SELECT') AS service_select,
         has_table_privilege('service_role', 'public.linkedin_oauth_states', 'INSERT') AS service_insert,
         has_table_privilege('service_role', 'public.linkedin_oauth_states', 'UPDATE') AS service_update,
         has_table_privilege('service_role', 'public.linkedin_oauth_states', 'DELETE') AS service_delete`,
    );
    expect(priv.rows[0]).toEqual({
      anon_select: false,
      auth_select: false,
      auth_insert: false,
      service_select: true,
      service_insert: true,
      service_update: true,
      service_delete: true,
    });
  });
});
