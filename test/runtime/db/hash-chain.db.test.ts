/**
 * SPEC-001 — Hash-Chain Verification (DB integration)
 *
 * Run with: TEST_DB_URL=postgresql://postgres@127.0.0.1:5432/<db> npm test
 * Without TEST_DB_URL the describe block is skipped.
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

d('SPEC-001 / hash-chain verifier (DB)', () => {
  let ctx: DbCtx | null = null;
  beforeEach(async () => { ctx = await openDb(); });
  afterEach(async () => { await closeDb(ctx); ctx = null; });

  it('first event has prev_hash NULL and non-null event_hash', async () => {
    const { tenantId } = await createTenantWithMember(ctx!);
    const row = await insertEvent(ctx!, tenantId);
    expect(row.prev_hash).toBeNull();
    expect(row.event_hash).toBeInstanceOf(Buffer);
    expect(row.event_hash.length).toBe(32);
    expect(Number(row.tenant_seq)).toBe(1);
  });

  it('second event prev_hash equals first event_hash', async () => {
    const { tenantId } = await createTenantWithMember(ctx!);
    const a = await insertEvent(ctx!, tenantId, { type: 'a.one' });
    const b = await insertEvent(ctx!, tenantId, { type: 'a.two' });
    expect(b.prev_hash).not.toBeNull();
    expect(b.prev_hash!.equals(a.event_hash)).toBe(true);
    expect(Number(b.tenant_seq)).toBe(2);
  });

  it('verify_chain returns valid=true and chain_ok=true for unmodified rows', async () => {
    const { tenantId, userId } = await createTenantWithMember(ctx!);
    await insertEvent(ctx!, tenantId, { type: 'v.one' });
    await insertEvent(ctx!, tenantId, { type: 'v.two' });
    await insertEvent(ctx!, tenantId, { type: 'v.three' });

    const result = await ctx!.withClaims({ sub: userId }, async () => {
      return ctx!.client.query<{
        tenant_seq: string;
        valid: boolean;
        chain_ok: boolean;
      }>(`SELECT tenant_seq, valid, chain_ok
            FROM public.runtime_events_verify_chain($1::uuid)
           ORDER BY tenant_seq`, [tenantId]);
    });

    expect(result.rows).toHaveLength(3);
    expect(result.rows.every((r) => r.valid && r.chain_ok)).toBe(true);
  });

  it('verifier rejects callers without tenant membership', async () => {
    const { tenantId } = await createTenantWithMember(ctx!);
    await insertEvent(ctx!, tenantId);

    // Different user, no membership
    const { rows: u } = await ctx!.client.query<{ id: string }>(
      `INSERT INTO auth.users(email) VALUES ('outsider@example.com') RETURNING id`,
    );
    const outsiderId = u[0]!.id;

    await expect(
      ctx!.withClaims({ sub: outsiderId }, async () => {
        await ctx!.client.query(
          `SELECT * FROM public.runtime_events_verify_chain($1::uuid)`,
          [tenantId],
        );
      }),
    ).rejects.toThrow(/forbidden/);
  });
});
