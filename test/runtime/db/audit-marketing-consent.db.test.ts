/**
 * PR A (#1806) — marketing consent columns + triggers.
 * Must work even when audit_email_drip objects are absent (live ledger mismatch).
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { closeDb, getDbUrl, openDb, type DbCtx } from './db-helpers';

const skip = !getDbUrl();
const d = skip ? describe.skip : describe;

const MIGRATION = resolve(
  __dirname,
  '../../../supabase/migrations/20261008133000_audit_marketing_consent.sql',
);

async function insertLead(
  ctx: DbCtx,
  opts: {
    email: string;
    consent?: boolean;
    version?: string | null;
    at?: string | null;
  },
): Promise<{
  id: string;
  marketing_consent: boolean;
  marketing_consent_at: string | null;
  marketing_consent_text_version: string | null;
}> {
  const { rows } = await ctx.client.query<{
    id: string;
    marketing_consent: boolean;
    marketing_consent_at: string | null;
    marketing_consent_text_version: string | null;
  }>(
    `INSERT INTO public.sales_leads (
       email, source, path,
       marketing_consent, marketing_consent_at, marketing_consent_text_version
     ) VALUES ($1, 'audit_lp', '/audit', $2, $3::timestamptz, $4)
     RETURNING id, marketing_consent,
               marketing_consent_at::text AS marketing_consent_at,
               marketing_consent_text_version`,
    [
      opts.email,
      opts.consent ?? false,
      opts.at ?? null,
      opts.version ?? null,
    ],
  );
  return rows[0]!;
}

async function insertAudit(
  ctx: DbCtx,
  opts: {
    email: string;
    consent?: boolean;
    version?: string | null;
  },
): Promise<string> {
  const { rows } = await ctx.client.query<{ id: string }>(
    `INSERT INTO public.gdpr_audits (
       url, domain, email, score, severity, issues, ip_hash,
       marketing_consent, marketing_consent_text_version
     ) VALUES (
       $1, 'consent-test.example', $2, 80, 'low', '[]'::jsonb, 'test-hash',
       $3, $4
     ) RETURNING id`,
    [
      `https://consent-test.example/${opts.email}`,
      opts.email,
      opts.consent ?? false,
      opts.version ?? null,
    ],
  );
  return rows[0]!.id;
}

d('PR A marketing consent (DB)', () => {
  let ctx: DbCtx | null = null;
  beforeEach(async () => { ctx = await openDb(); });
  afterEach(async () => { await closeDb(ctx); ctx = null; });

  it('migration SQL does not reference audit_email_drip', () => {
    const sql = readFileSync(MIGRATION, 'utf8');
    expect(sql.toLowerCase()).not.toMatch(/audit_email_drip/);
  });

  it('applies cleanly when drip table/functions are absent (live ledger mismatch)', async () => {
    // Simulate production: drip migration marked applied but objects missing.
    await ctx!.client.query(`DROP TABLE IF EXISTS public.audit_email_drip CASCADE`);
    await ctx!.client.query(`DROP FUNCTION IF EXISTS public.audit_email_drip_due(int) CASCADE`);
    await ctx!.client.query(`DROP FUNCTION IF EXISTS public.audit_email_drip_advance(uuid, text) CASCADE`);
    await ctx!.client.query(`DROP FUNCTION IF EXISTS public.audit_email_drip_create_for_audit() CASCADE`);
    await ctx!.client.query(`DROP FUNCTION IF EXISTS public.audit_email_drip_unsubscribe(uuid) CASCADE`);

    const sql = readFileSync(MIGRATION, 'utf8');
    await expect(ctx!.client.query(sql)).resolves.toBeTruthy();

    const { rows } = await ctx!.client.query<{ exists: boolean }>(
      `SELECT EXISTS (
         SELECT 1 FROM information_schema.columns
          WHERE table_schema = 'public'
            AND table_name = 'sales_leads'
            AND column_name = 'marketing_consent'
       ) AS exists`,
    );
    expect(rows[0]?.exists).toBe(true);
  });

  it('insert with consent sets server timestamp and keeps allowlisted version', async () => {
    const before = Date.now();
    const row = await insertLead(ctx!, {
      email: `ok_${Date.now()}@example.com`,
      consent: true,
      version: 'audit_followup_v1_de',
      at: '2020-01-01T00:00:00.000Z', // client forgery — must be ignored
    });
    expect(row.marketing_consent).toBe(true);
    expect(row.marketing_consent_text_version).toBe('audit_followup_v1_de');
    expect(row.marketing_consent_at).toBeTruthy();
    const atMs = Date.parse(row.marketing_consent_at!);
    expect(atMs).toBeGreaterThanOrEqual(before - 1000);
    expect(atMs).toBeLessThan(Date.parse('2021-01-01T00:00:00.000Z')); // not the forged 2020 stamp
  });

  it('rejects bad text_version', async () => {
    await expect(
      insertLead(ctx!, {
        email: `bad_${Date.now()}@example.com`,
        consent: true,
        version: 'not_a_real_version',
      }),
    ).rejects.toMatchObject({ code: '23514' });
  });

  it('without consent nulls proof fields', async () => {
    const row = await insertLead(ctx!, {
      email: `no_${Date.now()}@example.com`,
      consent: false,
      version: 'audit_followup_v1_en',
      at: '2020-01-01T00:00:00.000Z',
    });
    expect(row.marketing_consent).toBe(false);
    expect(row.marketing_consent_at).toBeNull();
    expect(row.marketing_consent_text_version).toBeNull();
  });

  it('proof fields are immutable once set; revocation is sticky', async () => {
    const row = await insertLead(ctx!, {
      email: `imm_${Date.now()}@example.com`,
      consent: true,
      version: 'audit_followup_v1_en',
    });

    await expect(
      ctx!.client.query(
        `UPDATE public.sales_leads
            SET marketing_consent_text_version = 'audit_followup_v1_de'
          WHERE id = $1`,
        [row.id],
      ),
    ).rejects.toMatchObject({ code: '23514' });

    await expect(
      ctx!.client.query(
        `UPDATE public.sales_leads SET marketing_consent = false WHERE id = $1`,
        [row.id],
      ),
    ).rejects.toMatchObject({ code: '23514' });

    await ctx!.client.query(
      `UPDATE public.sales_leads
          SET marketing_consent_revoked_at = '2020-01-01T00:00:00Z'
        WHERE id = $1`,
      [row.id],
    );
    const { rows: after } = await ctx!.client.query<{ revoked: string }>(
      `SELECT marketing_consent_revoked_at::text AS revoked
         FROM public.sales_leads WHERE id = $1`,
      [row.id],
    );
    expect(after[0]?.revoked).toBeTruthy();
    expect(Date.parse(after[0]!.revoked)).toBeGreaterThan(Date.parse('2021-01-01T00:00:00Z'));

    await expect(
      ctx!.client.query(
        `UPDATE public.sales_leads SET marketing_consent_revoked_at = NULL WHERE id = $1`,
        [row.id],
      ),
    ).rejects.toMatchObject({ code: '23514' });
  });

  it('same rules apply on gdpr_audits', async () => {
    const id = await insertAudit(ctx!, {
      email: `audit_${Date.now()}@example.com`,
      consent: true,
      version: 'audit_followup_v1_de',
    });
    const { rows } = await ctx!.client.query<{ at: string; version: string }>(
      `SELECT marketing_consent_at::text AS at, marketing_consent_text_version AS version
         FROM public.gdpr_audits WHERE id = $1`,
      [id],
    );
    expect(rows[0]?.at).toBeTruthy();
    expect(rows[0]?.version).toBe('audit_followup_v1_de');
  });

  it('anon cannot insert or update consent columns (RLS / grants)', async () => {
    await expect(
      ctx!.withClaims({ role: 'anon' }, async () => {
        await ctx!.client.query(
          `INSERT INTO public.sales_leads (email, marketing_consent, marketing_consent_text_version)
           VALUES ('anon@example.com', true, 'audit_followup_v1_de')`,
        );
      }),
    ).rejects.toMatchObject({ code: '42501' });

    const row = await insertLead(ctx!, {
      email: `authz_${Date.now()}@example.com`,
      consent: true,
      version: 'audit_followup_v1_de',
    });

    await expect(
      ctx!.withClaims({ role: 'anon' }, async () => {
        await ctx!.client.query(
          `UPDATE public.sales_leads SET marketing_consent_revoked_at = now() WHERE id = $1`,
          [row.id],
        );
      }),
    ).rejects.toMatchObject({ code: '42501' });
  });

  it('trigger functions revoke EXECUTE from anon/authenticated', async () => {
    const { rows } = await ctx!.client.query<{
      name: string;
      anon_exec: boolean;
      auth_exec: boolean;
    }>(
      `SELECT p.proname AS name,
              has_function_privilege('anon', p.oid, 'EXECUTE') AS anon_exec,
              has_function_privilege('authenticated', p.oid, 'EXECUTE') AS auth_exec
         FROM pg_proc p
         JOIN pg_namespace n ON n.oid = p.pronamespace
        WHERE n.nspname = 'public'
          AND p.proname IN (
            'marketing_consent_before_insert',
            'marketing_consent_before_update'
          )`,
    );
    expect(rows).toHaveLength(2);
    for (const r of rows) {
      expect(r.anon_exec, r.name).toBe(false);
      expect(r.auth_exec, r.name).toBe(false);
    }
  });
});
