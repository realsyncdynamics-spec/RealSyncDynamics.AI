/**
 * SPEC-001 — Hash-Chain Corruption Detection (DB integration)
 *
 * Production guarantees that nobody can UPDATE runtime_events — the
 * BEFORE-UPDATE trigger raises 42501. To prove the verifier still
 * catches tampering if an attacker bypassed the trigger (e.g. direct
 * filesystem access, mis-configured superuser), we emulate the
 * tamper by setting session_replication_role=replica, which is the
 * documented Postgres switch that disables row triggers session-wide.
 * Only the test superuser can do this; in production, no role has it.
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

d('SPEC-001 / hash-chain detects tampering (DB)', () => {
  let ctx: DbCtx | null = null;
  beforeEach(async () => { ctx = await openDb(); });
  afterEach(async () => { await closeDb(ctx); ctx = null; });

  it('verifier flags valid=false when event_hash is corrupted (bypassing trigger)', async () => {
    const { tenantId, userId } = await createTenantWithMember(ctx!);
    const a = await insertEvent(ctx!, tenantId, { type: 'corrupt.one' });
    await insertEvent(ctx!, tenantId, { type: 'corrupt.two' });

    // Tamper: rewrite payload. The verifier recomputes from canonical
    // bytes — recomputed != stored event_hash.
    await ctx!.client.query(`SET LOCAL session_replication_role = replica`);
    await ctx!.client.query(
      `UPDATE public.runtime_events
          SET payload = '{"tampered": true}'::jsonb
        WHERE id = $1`,
      [a.id],
    );
    await ctx!.client.query(`SET LOCAL session_replication_role = origin`);

    const result = await ctx!.withClaims({ sub: userId }, async () => {
      return ctx!.client.query<{
        tenant_seq: string;
        valid: boolean;
        chain_ok: boolean;
      }>(
        `SELECT tenant_seq, valid, chain_ok
           FROM public.runtime_events_verify_chain($1::uuid)
          ORDER BY tenant_seq`,
        [tenantId],
      );
    });

    expect(result.rows).toHaveLength(2);
    // Seq 1 was corrupted → valid=false (event_hash != recomputed)
    expect(result.rows[0]!.valid).toBe(false);
    // Seq 2's chain_ok depends on prev_hash matching seq 1's event_hash —
    // since seq 1's hash wasn't recomputed-on-tamper, chain_ok at seq 2
    // is STILL true (the stored prev_hash still equals the stored event_hash
    // of seq 1). The integrity break shows in valid=false at seq 1, which
    // is exactly what we want — single point of detection, no cascade.
    expect(result.rows[1]!.chain_ok).toBe(true);
  });

  it('verifier flags chain_ok=false when prev_hash is corrupted', async () => {
    const { tenantId, userId } = await createTenantWithMember(ctx!);
    await insertEvent(ctx!, tenantId, { type: 'chain.one' });
    const b = await insertEvent(ctx!, tenantId, { type: 'chain.two' });

    await ctx!.client.query(`SET LOCAL session_replication_role = replica`);
    await ctx!.client.query(
      `UPDATE public.runtime_events
          SET prev_hash = decode('00000000000000000000000000000000000000000000000000000000000000ff','hex')
        WHERE id = $1`,
      [b.id],
    );
    await ctx!.client.query(`SET LOCAL session_replication_role = origin`);

    const result = await ctx!.withClaims({ sub: userId }, async () => {
      return ctx!.client.query<{
        tenant_seq: string;
        valid: boolean;
        chain_ok: boolean;
      }>(
        `SELECT tenant_seq, valid, chain_ok
           FROM public.runtime_events_verify_chain($1::uuid)
          ORDER BY tenant_seq`,
        [tenantId],
      );
    });

    // Row 1 is fine; row 2's prev_hash no longer matches row 1's event_hash
    expect(result.rows[0]!.chain_ok).toBe(true);
    expect(result.rows[1]!.chain_ok).toBe(false);
    // Row 2's recomputed event_hash now uses the new (wrong) prev_hash,
    // so it also differs from the stored event_hash → valid=false too
    expect(result.rows[1]!.valid).toBe(false);
  });
});
