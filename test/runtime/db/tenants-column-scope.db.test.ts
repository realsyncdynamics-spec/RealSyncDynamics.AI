/**
 * Tenant-Spaltenschutz (20261029120000_tenants_owner_update_column_scope.sql).
 *
 *   - authenticated/anon haben kein Tabellen-UPDATE mehr auf public.tenants
 *   - Server-only-Spalten (Trial, Partner, Billing, Domain, Branding, Zähler)
 *     sind für authenticated nicht schreibbar
 *   - erlaubte Profilspalten bleiben für authenticated schreibbar (sofern vorhanden)
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { closeDb, openDb, requireDbOrFail, type DbCtx } from './db-helpers';

const d = requireDbOrFail('tenants-column-scope') ? describe : describe.skip;

const SERVER_ONLY = [
  'trial_expires_at',
  'partner_id',
  'custom_domain',
  'billing_email',
  'auto_invoice_passthrough',
  'claimed_at',
  'run_count',
  'custom_css',
  'custom_logo_url',
  'brand_colors',
];
const CLIENT_WRITABLE = [
  'company_name',
  'org_name',
  'tenant_type',
  'org_size_employees',
  'industry',
  'ai_data_residency_policy',
  'onboarded_at',
];

d('Tenant-Spaltenschutz', () => {
  let ctx: DbCtx | null = null;

  beforeEach(async () => {
    ctx = await openDb();
  });

  afterEach(async () => {
    await closeDb(ctx);
    ctx = null;
  });

  async function existing(cols: string[]): Promise<string[]> {
    const { rows } = await ctx!.client.query<{ column_name: string }>(
      `SELECT column_name FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'tenants' AND column_name = ANY($1)`,
      [cols],
    );
    return rows.map((r) => r.column_name);
  }

  async function canUpdate(role: string, col: string): Promise<boolean> {
    const { rows } = await ctx!.client.query<{ ok: boolean }>(
      `SELECT has_column_privilege($1, 'public.tenants', $2, 'UPDATE') AS ok`,
      [role, col],
    );
    return rows[0]!.ok;
  }

  it('entzieht Tabellen-UPDATE für anon und authenticated', async () => {
    const { rows } = await ctx!.client.query<{ a: boolean; n: boolean }>(
      `SELECT has_table_privilege('authenticated', 'public.tenants', 'UPDATE') AS a,
              has_table_privilege('anon', 'public.tenants', 'UPDATE') AS n`,
    );
    expect(rows[0]).toEqual({ a: false, n: false });
  });

  it('Server-only-Spalten sind für authenticated nicht schreibbar', async () => {
    for (const col of await existing(SERVER_ONLY)) {
      expect({ col, ok: await canUpdate('authenticated', col) }).toEqual({ col, ok: false });
    }
  });

  it('erlaubte Profilspalten bleiben für authenticated schreibbar', async () => {
    for (const col of await existing(CLIENT_WRITABLE)) {
      expect({ col, ok: await canUpdate('authenticated', col) }).toEqual({ col, ok: true });
    }
  });
});
