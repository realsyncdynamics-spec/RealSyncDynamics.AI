/**
 * SPEC-001 — Append-Only Enforcement (DB integration)
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

d('SPEC-001 / append-only enforcement (DB)', () => {
  let ctx: DbCtx | null = null;
  beforeEach(async () => { ctx = await openDb(); });
  afterEach(async () => { await closeDb(ctx); ctx = null; });

  it('UPDATE on runtime_events raises 42501', async () => {
    const { tenantId } = await createTenantWithMember(ctx!);
    const row = await insertEvent(ctx!, tenantId, { severity: 'info' });

    await expect(
      ctx!.client.query(
        `UPDATE public.runtime_events SET severity='high' WHERE id=$1`,
        [row.id],
      ),
    ).rejects.toMatchObject({ code: '42501' });
  });

  it('DELETE on runtime_events raises 42501', async () => {
    const { tenantId } = await createTenantWithMember(ctx!);
    const row = await insertEvent(ctx!, tenantId);

    await expect(
      ctx!.client.query(
        `DELETE FROM public.runtime_events WHERE id=$1`,
        [row.id],
      ),
    ).rejects.toMatchObject({ code: '42501' });
  });

  it('UPDATE error message references append-only', async () => {
    const { tenantId } = await createTenantWithMember(ctx!);
    const row = await insertEvent(ctx!, tenantId);

    try {
      await ctx!.client.query(
        `UPDATE public.runtime_events SET source='hacked' WHERE id=$1`,
        [row.id],
      );
      expect.fail('UPDATE should have thrown');
    } catch (e: unknown) {
      const err = e as { message?: string; code?: string };
      expect(err.message).toMatch(/append-only/);
      expect(err.code).toBe('42501');
    }
  });
});
