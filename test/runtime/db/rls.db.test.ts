/**
 * SPEC-001 + RFC-002 — RLS Isolation (DB integration)
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

d('SPEC-001 / RLS tenant isolation (DB)', () => {
  let ctx: DbCtx | null = null;
  beforeEach(async () => { ctx = await openDb(); });
  afterEach(async () => { await closeDb(ctx); ctx = null; });

  it('cross-tenant SELECT returns 0 rows', async () => {
    const A = await createTenantWithMember(ctx!, { tenantName: 'tenant-A' });
    const B = await createTenantWithMember(ctx!, { tenantName: 'tenant-B' });

    await insertEvent(ctx!, A.tenantId, { type: 'tenant_a.event' });
    await insertEvent(ctx!, B.tenantId, { type: 'tenant_b.event' });

    // User of B reads — must NOT see tenant A events
    await ctx!.withClaims({ sub: B.userId }, async () => {
      const r = await ctx!.client.query(
        `SELECT type FROM public.runtime_events ORDER BY global_seq`,
      );
      expect(r.rows.every((row) => row.type !== 'tenant_a.event')).toBe(true);
      expect(r.rows.some((row) => row.type === 'tenant_b.event')).toBe(true);
    });
  });

  it('member sees their own tenant events', async () => {
    const A = await createTenantWithMember(ctx!, { tenantName: 'visible' });
    await insertEvent(ctx!, A.tenantId, { type: 'rls.should_see' });

    await ctx!.withClaims({ sub: A.userId }, async () => {
      const r = await ctx!.client.query(
        `SELECT count(*)::int AS n FROM public.runtime_events WHERE tenant_id = $1`,
        [A.tenantId],
      );
      expect(r.rows[0].n).toBeGreaterThanOrEqual(1);
    });
  });

  it('unauthenticated session sees nothing', async () => {
    const A = await createTenantWithMember(ctx!);
    await insertEvent(ctx!, A.tenantId);

    await ctx!.withClaims({}, async () => {
      const r = await ctx!.client.query(
        `SELECT count(*)::int AS n FROM public.runtime_events`,
      );
      expect(r.rows[0].n).toBe(0);
    });
  });

  it('non-member cannot read another tenant via subject_ref correlation', async () => {
    const A = await createTenantWithMember(ctx!, { tenantName: 'A' });
    const B = await createTenantWithMember(ctx!, { tenantName: 'B' });

    const ref = 'opaque-ref-shared-' + Math.random().toString(36).slice(2);
    await insertEvent(ctx!, A.tenantId, { subject_ref: ref });
    await insertEvent(ctx!, B.tenantId, { subject_ref: ref });

    await ctx!.withClaims({ sub: B.userId }, async () => {
      const r = await ctx!.client.query(
        `SELECT tenant_id FROM public.runtime_events WHERE subject_ref = $1`,
        [ref],
      );
      // Only tenant B events come back
      expect(r.rows.every((row) => row.tenant_id === B.tenantId)).toBe(true);
      expect(r.rows.length).toBeGreaterThanOrEqual(1);
    });
  });
});
