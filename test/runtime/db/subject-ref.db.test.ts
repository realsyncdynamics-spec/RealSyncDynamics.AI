/**
 * RFC-002 — subject_ref Lifecycle (DB integration)
 *
 * HMAC compute, rotation lifecycle, deletion semantics, RLS isolation
 * for subject-ref-correlated reads.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  closeDb,
  createTenantWithMember,
  getDbUrl,
  insertEvent,
  openDb,
  type DbCtx,
} from './db-helpers';

const skip = !getDbUrl();
const d = skip ? describe.skip : describe;

/** Generate + register a vault secret for a tenant key. */
async function seedKey(
  ctx: DbCtx,
  tenantId: string,
  keyVersion = 1,
  status: 'active' | 'rotating' | 'retired' = 'active',
): Promise<string> {
  const secretName = `subject_ref_key_${tenantId}_v${keyVersion}`;
  const secretValue = `key-material-${keyVersion}-${Math.random().toString(36).slice(2)}`;
  await ctx.client.query(
    `INSERT INTO public.app_secrets(name, value) VALUES ($1, $2)
     ON CONFLICT (name) DO UPDATE SET value = EXCLUDED.value`,
    [secretName, secretValue],
  );
  await ctx.client.query(
    `INSERT INTO public.subject_ref_keys(tenant_id, key_version, vault_secret_name, status)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (tenant_id, key_version) DO UPDATE
       SET status = EXCLUDED.status`,
    [tenantId, keyVersion, secretName, status],
  );
  return secretName;
}

d('RFC-002 / subject_ref_compute (DB)', () => {
  let ctx: DbCtx | null = null;
  beforeEach(async () => { ctx = await openDb(); });
  afterEach(async () => { await closeDb(ctx); ctx = null; });

  it('returns identical hex for identical (tenant, kind, value)', async () => {
    const { tenantId } = await createTenantWithMember(ctx!);
    await seedKey(ctx!, tenantId);

    const r = await ctx!.client.query<{ a: string; b: string }>(
      `SELECT public.subject_ref_compute($1::uuid, 'email', 'foo@bar.de') AS a,
              public.subject_ref_compute($1::uuid, 'email', 'foo@bar.de') AS b`,
      [tenantId],
    );
    expect(r.rows[0]!.a).toBe(r.rows[0]!.b);
    expect(r.rows[0]!.a).toMatch(/^[0-9a-f]{64}$/);
  });

  it('normalizes value (lower + trim) before HMAC', async () => {
    const { tenantId } = await createTenantWithMember(ctx!);
    await seedKey(ctx!, tenantId);

    const r = await ctx!.client.query<{ a: string; b: string }>(
      `SELECT public.subject_ref_compute($1::uuid, 'email', '  FOO@BAR.DE  ') AS a,
              public.subject_ref_compute($1::uuid, 'email', 'foo@bar.de')     AS b`,
      [tenantId],
    );
    expect(r.rows[0]!.a).toBe(r.rows[0]!.b);
  });

  it('produces DIFFERENT hex for two tenants on same plaintext (no cross-tenant correlation)', async () => {
    const A = await createTenantWithMember(ctx!, { tenantName: 'A', userEmail: 'a@x.de' });
    const B = await createTenantWithMember(ctx!, { tenantName: 'B', userEmail: 'b@x.de' });
    await seedKey(ctx!, A.tenantId);
    await seedKey(ctx!, B.tenantId);

    const r = await ctx!.client.query<{ a: string; b: string }>(
      `SELECT public.subject_ref_compute($1::uuid, 'email', 'shared@x.de') AS a,
              public.subject_ref_compute($2::uuid, 'email', 'shared@x.de') AS b`,
      [A.tenantId, B.tenantId],
    );
    expect(r.rows[0]!.a).not.toBe(r.rows[0]!.b);
  });

  it('different subject_kind on same value yields different hex', async () => {
    const { tenantId } = await createTenantWithMember(ctx!);
    await seedKey(ctx!, tenantId);

    const r = await ctx!.client.query<{ a: string; b: string }>(
      `SELECT public.subject_ref_compute($1::uuid, 'email',   'shared') AS a,
              public.subject_ref_compute($1::uuid, 'user_id', 'shared') AS b`,
      [tenantId],
    );
    expect(r.rows[0]!.a).not.toBe(r.rows[0]!.b);
  });

  it('raises when no usable key exists for the tenant', async () => {
    const { tenantId } = await createTenantWithMember(ctx!);
    // no seedKey

    await expect(
      ctx!.client.query(
        `SELECT public.subject_ref_compute($1::uuid, 'email', 'no@key.de')`,
        [tenantId],
      ),
    ).rejects.toThrow(/no usable subject_ref key/);
  });
});

d('RFC-002 / key rotation (DB)', () => {
  let ctx: DbCtx | null = null;
  beforeEach(async () => { ctx = await openDb(); });
  afterEach(async () => { await closeDb(ctx); ctx = null; });

  it('rotate creates new active key and downgrades the previous to rotating', async () => {
    const { tenantId } = await createTenantWithMember(ctx!);
    await seedKey(ctx!, tenantId, 1, 'active');

    await ctx!.withClaims({ role: 'service_role' }, async () => {
      const r = await ctx!.client.query<{ v: number }>(
        `SELECT public.rotate_subject_ref_key($1::uuid) AS v`,
        [tenantId],
      );
      expect(r.rows[0]!.v).toBe(2);
    });

    const status = await ctx!.client.query<{ key_version: number; status: string }>(
      `SELECT key_version, status FROM public.subject_ref_keys
        WHERE tenant_id=$1 ORDER BY key_version`,
      [tenantId],
    );
    expect(status.rows).toHaveLength(2);
    expect(status.rows[0]!.status).toBe('rotating');
    expect(status.rows[1]!.status).toBe('active');
  });

  it('rotate is service-role only', async () => {
    const { tenantId, userId } = await createTenantWithMember(ctx!);
    await seedKey(ctx!, tenantId);

    // Either function-level GRANT denial OR the in-body auth.role() guard
    // counts — both are the "service-role-only" contract.
    await expect(
      ctx!.withClaims({ sub: userId }, async () => {
        await ctx!.client.query(
          `SELECT public.rotate_subject_ref_key($1::uuid)`,
          [tenantId],
        );
      }),
    ).rejects.toThrow(/forbidden|permission denied/);
  });

  it('explicit p_key_version uses the rotating key during the dual-read window', async () => {
    const { tenantId } = await createTenantWithMember(ctx!);
    await seedKey(ctx!, tenantId, 1, 'active');

    // Rotate → v2 active, v1 rotating
    await ctx!.withClaims({ role: 'service_role' }, async () => {
      await ctx!.client.query(`SELECT public.rotate_subject_ref_key($1::uuid)`, [tenantId]);
    });
    // The rotate RPC created v2's row but no Vault secret — seed it
    await ctx!.client.query(
      `INSERT INTO public.app_secrets(name, value)
       VALUES ($1, 'new-key-material-v2')
       ON CONFLICT (name) DO UPDATE SET value = EXCLUDED.value`,
      [`subject_ref_key_${tenantId}_v2`],
    );

    // Compute with v1 (rotating) still works
    const r1 = await ctx!.client.query<{ ref: string }>(
      `SELECT public.subject_ref_compute($1::uuid, 'email', 'x@y.de', 1) AS ref`,
      [tenantId],
    );
    // Compute with v2 (active) also works
    const r2 = await ctx!.client.query<{ ref: string }>(
      `SELECT public.subject_ref_compute($1::uuid, 'email', 'x@y.de', 2) AS ref`,
      [tenantId],
    );
    // Default (no version) uses active = v2 → same as r2
    const rDefault = await ctx!.client.query<{ ref: string }>(
      `SELECT public.subject_ref_compute($1::uuid, 'email', 'x@y.de') AS ref`,
      [tenantId],
    );

    expect(r1.rows[0]!.ref).toMatch(/^[0-9a-f]{64}$/);
    expect(r2.rows[0]!.ref).toMatch(/^[0-9a-f]{64}$/);
    expect(r1.rows[0]!.ref).not.toBe(r2.rows[0]!.ref);
    expect(rDefault.rows[0]!.ref).toBe(r2.rows[0]!.ref);
  });
});

d('RFC-002 / erasure (DB)', () => {
  let ctx: DbCtx | null = null;
  beforeEach(async () => { ctx = await openDb(); });
  afterEach(async () => { await closeDb(ctx); ctx = null; });

  it('request_subject_erasure marks mapping + emits dsr.erasure_requested', async () => {
    const { tenantId, userId } = await createTenantWithMember(ctx!);
    await seedKey(ctx!, tenantId);

    // Pretend we computed a subject_ref previously
    const ref = 'abc123ref' + Math.random().toString(36).slice(2);
    await ctx!.client.query(
      `INSERT INTO public.subject_ref_mappings
         (subject_ref, tenant_id, key_version, subject_kind, encrypted_value)
       VALUES ($1, $2, 1, 'email', decode('00', 'hex'))`,
      [ref, tenantId],
    );

    await ctx!.withClaims({ sub: userId }, async () => {
      await ctx!.client.query(
        `SELECT public.request_subject_erasure($1::uuid, $2, INTERVAL '30 days', 'test')`,
        [tenantId, ref],
      );
    });

    const m = await ctx!.client.query<{ deletion_requested_at: string }>(
      `SELECT deletion_requested_at FROM public.subject_ref_mappings WHERE subject_ref=$1`,
      [ref],
    );
    expect(m.rows[0]!.deletion_requested_at).not.toBeNull();

    const e = await ctx!.client.query<{ type: string; subject_ref: string }>(
      `SELECT type, subject_ref FROM public.runtime_events
        WHERE tenant_id=$1 AND type='dsr.erasure_requested'`,
      [tenantId],
    );
    expect(e.rows[0]!.type).toBe('dsr.erasure_requested');
    expect(e.rows[0]!.subject_ref).toBe(ref);
  });

  it('request_subject_erasure rejects non-members', async () => {
    const { tenantId } = await createTenantWithMember(ctx!);
    const { rows: u } = await ctx!.client.query<{ id: string }>(
      `INSERT INTO auth.users(email) VALUES ('erasure-outsider@x.de') RETURNING id`,
    );

    await expect(
      ctx!.withClaims({ sub: u[0]!.id }, async () => {
        await ctx!.client.query(
          `SELECT public.request_subject_erasure($1::uuid, 'ref-x', INTERVAL '30 days', NULL)`,
          [tenantId],
        );
      }),
    ).rejects.toThrow(/forbidden/);
  });
});

d('RFC-002 / DSR export view + RPC (DB)', () => {
  let ctx: DbCtx | null = null;
  beforeEach(async () => { ctx = await openDb(); });
  afterEach(async () => { await closeDb(ctx); ctx = null; });

  it('subject_dsr_export_v returns only rows with subject_ref', async () => {
    const { tenantId, userId } = await createTenantWithMember(ctx!);
    await insertEvent(ctx!, tenantId, { subject_ref: 'ref-with-enough-length', type: 'dsr.has_subject' });
    await insertEvent(ctx!, tenantId, { subject_ref: null, type: 'dsr.no_subject' });

    await ctx!.withClaims({ sub: userId }, async () => {
      const r = await ctx!.client.query<{ subject_ref: string }>(
        `SELECT subject_ref FROM public.subject_dsr_export_v
          WHERE tenant_id=$1`,
        [tenantId],
      );
      expect(r.rows.every((x) => x.subject_ref !== null)).toBe(true);
      expect(r.rows).toHaveLength(1);
    });
  });

  it('incident_correlation_export returns ts-ordered events', async () => {
    const { tenantId, userId } = await createTenantWithMember(ctx!);
    const ref = 'incident-ref-' + Math.random().toString(36).slice(2);
    await insertEvent(ctx!, tenantId, { subject_ref: ref, type: 'incident.one' });
    await insertEvent(ctx!, tenantId, { subject_ref: ref, type: 'incident.two' });
    await insertEvent(ctx!, tenantId, { subject_ref: ref, type: 'incident.three' });

    const r = await ctx!.withClaims({ sub: userId }, async () => {
      return ctx!.client.query<{ tenant_seq: string; type: string }>(
        `SELECT tenant_seq, type FROM public.incident_correlation_export($1::uuid, $2)`,
        [tenantId, ref],
      );
    });
    expect(r.rows).toHaveLength(3);
    const seqs = r.rows.map((x) => Number(x.tenant_seq));
    expect(seqs).toEqual([...seqs].sort((a, b) => a - b));
  });

  it('cross-tenant subject_ref lookup returns empty (no leak)', async () => {
    const A = await createTenantWithMember(ctx!, { tenantName: 'A', userEmail: 'a@y.de' });
    const B = await createTenantWithMember(ctx!, { tenantName: 'B', userEmail: 'b@y.de' });
    const ref = 'cross-leak-' + Math.random().toString(36).slice(2);
    await insertEvent(ctx!, A.tenantId, { subject_ref: ref, type: 'leak.test' });

    await ctx!.withClaims({ sub: B.userId }, async () => {
      const r = await ctx!.client.query<{ subject_ref: string }>(
        `SELECT subject_ref FROM public.subject_dsr_export_v WHERE subject_ref=$1`,
        [ref],
      );
      expect(r.rows).toEqual([]);
    });
  });
});
