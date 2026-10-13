/**
 * #1865 — audit ownership & tenant selection, real-Postgres regressions.
 *
 * REQUIRE_DB_TESTS=1 must fail, not silently skip, without TEST_DB_URL.
 * Fixture DDL (auth.users.email_confirmed_at) is only required by the
 * lightweight test bootstrap; in Supabase it is an existing auth column.
 * All changes are rolled back by db-helpers at the end of each test.
 */
import { resolve } from 'node:path';
import { beforeEach, afterEach, describe, expect, it } from 'vitest';
import {
  applyMigration, closeDb, createTenantWithMember, openDb,
  requireDbOrFail, type DbCtx,
} from './db-helpers';

const enabled = requireDbOrFail('audit claim tenant selection');
const d = enabled ? describe : describe.skip;
const migrations = resolve(__dirname, '../../../supabase/migrations');
const file = '20261013060000_claim_gdpr_audit_explicit_tenant.sql';

async function audit(ctx: DbCtx, email: string): Promise<string> {
  const { rows } = await ctx.client.query<{ id: string }>(
    `INSERT INTO public.gdpr_audits
       (url, domain, email, score, severity, issues, ip_hash)
     VALUES ('https://claim-test.example', 'claim-test.example', $1,
             65, 'medium', '[]'::jsonb, 'claim-test-ip')
     RETURNING id`,
    [email],
  );
  return rows[0]!.id;
}

async function confirmed(ctx: DbCtx, userId: string): Promise<void> {
  await ctx.client.query(
    'UPDATE auth.users SET email_confirmed_at = now() WHERE id = $1',
    [userId],
  );
}

async function claim(
  ctx: DbCtx, userId: string, auditId: string, tenantId?: string,
): Promise<Record<string, unknown>> {
  return ctx.withClaims({ sub: userId }, async () => {
    const { rows } = tenantId === undefined
      ? await ctx.client.query<{ result: Record<string, unknown> }>(
          'SELECT public.claim_gdpr_audit($1::uuid) AS result',
          [auditId],
        )
      : await ctx.client.query<{ result: Record<string, unknown> }>(
          'SELECT public.claim_gdpr_audit($1::uuid, $2::uuid) AS result',
          [auditId, tenantId],
        );
    return rows[0]!.result;
  });
}

async function secondTenant(ctx: DbCtx, userId: string): Promise<string> {
  const { rows } = await ctx.client.query<{ id: string }>(
    "INSERT INTO public.tenants(name) VALUES ('second-claim-tenant') RETURNING id",
  );
  const id = rows[0]!.id;
  await ctx.client.query(
    "INSERT INTO public.memberships (tenant_id, user_id, role) VALUES ($1,$2,'owner')",
    [id, userId],
  );
  return id;
}

d('P0 audit claim — verified ownership and explicit tenant', () => {
  let ctx: DbCtx;
  beforeEach(async () => {
    ctx = await openDb();
    // The small test-db bootstrap omits this Supabase auth.users column.
    await ctx.client.query(
      'ALTER TABLE auth.users ADD COLUMN IF NOT EXISTS email_confirmed_at timestamptz',
    );
    await applyMigration(ctx, migrations, file);
  });
  afterEach(async () => { await closeDb(ctx); });

  it('one confirmed owner with one membership: legacy one-arg call works and is idempotent', async () => {
    const email = 'claim-owner@example.com';
    const { tenantId, userId } = await createTenantWithMember(ctx, { userEmail: email });
    await confirmed(ctx, userId);
    const id = await audit(ctx, email.toUpperCase());

    const first = await claim(ctx, userId, id);
    expect(first.ok).toBe(true);
    expect(first.already_claimed).toBe(false);
    expect(first.tenant_id).toBe(tenantId);
    expect((await claim(ctx, userId, id)).already_claimed).toBe(true);

    const { rows } = await ctx.client.query(
      'SELECT tenant_id, user_id, claimed_at FROM public.gdpr_audits WHERE id=$1', [id],
    );
    expect(rows[0].tenant_id).toBe(tenantId);
    expect(rows[0].user_id).toBe(userId);
    expect(rows[0].claimed_at).not.toBeNull();
  });

  it('multiple memberships without choice fail closed and do not modify the audit', async () => {
    const email = 'ambiguous@example.com';
    const { userId } = await createTenantWithMember(ctx, { userEmail: email });
    await confirmed(ctx, userId);
    await secondTenant(ctx, userId);
    const id = await audit(ctx, email);

    await expect(claim(ctx, userId, id)).rejects.toThrow(/explicit tenant selection required/);
    const { rows } = await ctx.client.query(
      'SELECT tenant_id, claimed_at FROM public.gdpr_audits WHERE id=$1', [id],
    );
    expect(rows[0]).toEqual({ tenant_id: null, claimed_at: null });
  });

  it('explicit choice selects only a tenant with owner/admin membership', async () => {
    const email = 'choose@example.com';
    const { tenantId: first, userId } = await createTenantWithMember(ctx, { userEmail: email });
    await confirmed(ctx, userId);
    const second = await secondTenant(ctx, userId);
    const id = await audit(ctx, email);

    const r = await claim(ctx, userId, id, second);
    expect(r.tenant_id).toBe(second);
    expect(r.tenant_id).not.toBe(first);
  });

  it('nonmember tenant cannot be selected, despite matching audit email', async () => {
    const email = 'forbidden-tenant@example.com';
    const { userId } = await createTenantWithMember(ctx, { userEmail: email });
    const outsider = await createTenantWithMember(ctx);
    await confirmed(ctx, userId);
    const id = await audit(ctx, email);
    await expect(claim(ctx, userId, id, outsider.tenantId))
      .rejects.toThrow(/tenant claim not authorized/);
  });

  it('unconfirmed account cannot claim even when e-mail matches', async () => {
    const email = 'unverified@example.com';
    const { userId } = await createTenantWithMember(ctx, { userEmail: email });
    const id = await audit(ctx, email);
    await expect(claim(ctx, userId, id))
      .rejects.toThrow(/verified account email required/);
  });

  it('different e-mail or absent audit e-mail does not prove ownership', async () => {
    const email = 'real-owner@example.com';
    const { userId } = await createTenantWithMember(ctx, { userEmail: email });
    await confirmed(ctx, userId);
    const unrelated = await audit(ctx, 'someone-else@example.com');
    const noEmail = await audit(ctx, '');
    await expect(claim(ctx, userId, unrelated))
      .rejects.toThrow(/audit ownership not verified/);
    await expect(claim(ctx, userId, noEmail))
      .rejects.toThrow(/audit ownership not verified/);
  });

  it('already-owned audit cannot be moved into another tenant', async () => {
    const email = 'once-only@example.com';
    const { tenantId, userId } = await createTenantWithMember(ctx, { userEmail: email });
    await confirmed(ctx, userId);
    const second = await secondTenant(ctx, userId);
    const id = await audit(ctx, email);
    await claim(ctx, userId, id, tenantId);
    await expect(claim(ctx, userId, id, second)).rejects.toThrow(/already claimed/);
    const { rows } = await ctx.client.query(
      'SELECT tenant_id FROM public.gdpr_audits WHERE id=$1', [id],
    );
    expect(rows[0].tenant_id).toBe(tenantId);
  });

  it('unclaimed but partially assigned report cannot be silently overwritten', async () => {
    const email = 'partial-owner@example.com';
    const { tenantId, userId } = await createTenantWithMember(ctx, { userEmail: email });
    await confirmed(ctx, userId);
    const id = await audit(ctx, email);
    await ctx.client.query(
      'UPDATE public.gdpr_audits SET tenant_id=$1 WHERE id=$2', [tenantId, id],
    );
    await expect(claim(ctx, userId, id)).rejects.toThrow(/audit ownership inconsistent/);
  });
});
