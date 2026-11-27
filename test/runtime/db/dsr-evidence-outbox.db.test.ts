/**
 * Phase-3/P0: real Postgres acceptance for the transactionally queued
 * DSR evidence trail. No database URL -> explicitly skipped, NOT passed.
 * To run: TEST_DB_URL=$(bash scripts/test-db/dsr-outbox-up.sh)
 *         npx vitest run test/runtime/db/dsr-evidence-outbox.db.test.ts
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  closeDb, createTenantWithMember, requireDbOrFail, openDb, seedAppSecret, type DbCtx,
} from './db-helpers';

const suite = requireDbOrFail('DSR evidence outbox') ? describe : describe.skip;
const requester = 'subject@example.test';

async function seedDsrKey(ctx: DbCtx, tenantId: string) {
  const name = `dsr_test_${tenantId}`;
  await ctx.client.query(
    `INSERT INTO public.subject_ref_keys(tenant_id, key_version, vault_secret_name, status)
     VALUES ($1, 1, $2, 'active') ON CONFLICT (tenant_id, key_version) DO NOTHING`,
    [tenantId, name],
  );
  await seedAppSecret(ctx, name, `isolated-test-secret-${tenantId}`);
}

async function createDsr(ctx: DbCtx, tenantId: string, opts: {
  requestType?: 'access' | 'erasure';
  missingKey?: boolean;
} = {}) {
  let metadata: Record<string, string> = {};
  if (!opts.missingKey) {
    await seedDsrKey(ctx, tenantId);
    const ref = await ctx.withClaims({ role: 'service_role' }, async () => {
      const result = await ctx.client.query<{ ref: string }>(
        "SELECT public.subject_ref_compute($1,'email',$2) AS ref",
        [tenantId, requester],
      );
      return result.rows[0]!.ref;
    });
    metadata = { subject_ref: ref };
  }
  const r = await ctx.client.query<{ id: string }>(
    `INSERT INTO public.dsr_requests(tenant_id, request_type, requester_email, status, metadata)
     VALUES ($1, $2, $3, 'received', $4::jsonb) RETURNING id`,
    [tenantId, opts.requestType ?? 'access', requester, JSON.stringify(metadata)],
  );
  return r.rows[0]!.id;
}

async function queueCount(ctx: DbCtx, id: string) {
  const r = await ctx.client.query<{ count: string }>(
    'SELECT count(*) FROM public.dsr_evidence_outbox WHERE dsr_id = $1', [id],
  );
  return Number(r.rows[0]!.count);
}

suite('DSR evidence outbox — PostgreSQL integration', () => {
  let ctx: DbCtx;
  beforeEach(async () => { ctx = await openDb(); });
  afterEach(async () => { await closeDb(ctx); });

  it('atomically creates a DSR, a pending work item and an admin audit row', async () => {
    const { tenantId } = await createTenantWithMember(ctx);
    const id = await createDsr(ctx, tenantId);
    expect(await queueCount(ctx, id)).toBe(1);
    const rows = await ctx.client.query<{ state: string; event_type: string; event_payload: unknown }>(
      'SELECT state, event_type, event_payload FROM public.dsr_evidence_outbox WHERE dsr_id = $1', [id],
    );
    expect(rows.rows[0]!.state).toBe('pending');
    expect(rows.rows[0]!.event_type).toBe('dsr.created');
    const payload = JSON.stringify(rows.rows[0]!.event_payload);
    expect(payload).not.toContain(requester);
    const audit = await ctx.client.query(
      `SELECT id FROM public.governance_admin_log
       WHERE target_id=$1 AND action='dsr.created'`, [id],
    );
    expect(audit.rowCount).toBe(1);
  });

  it('rolls the DSR write back when the durable outbox cannot be inserted', async () => {
    const { tenantId } = await createTenantWithMember(ctx);
    await ctx.client.query(
      `ALTER TABLE public.dsr_evidence_outbox
       ADD CONSTRAINT dsr_forced_failure CHECK (event_type <> 'dsr.created')`,
    );
    await ctx.client.query('SAVEPOINT failed_insert');
    await expect(createDsr(ctx, tenantId)).rejects.toThrow();
    await ctx.client.query('ROLLBACK TO SAVEPOINT failed_insert');
    const dsrs = await ctx.client.query(
      'SELECT 1 FROM public.dsr_requests WHERE tenant_id=$1', [tenantId],
    );
    const audits = await ctx.client.query(
      `SELECT 1 FROM public.governance_admin_log
       WHERE tenant_id=$1 AND action='dsr.created'`, [tenantId],
    );
    expect(dsrs.rowCount).toBe(0);
    expect(audits.rowCount).toBe(0);
  });

  it('delivers exactly once even if the caller retries after a lost response', async () => {
    const { tenantId } = await createTenantWithMember(ctx);
    const id = await createDsr(ctx, tenantId);

    await ctx.withClaims({ role: 'service_role' }, async () => {
      const r = await ctx.client.query<{ result: { delivered: number } }>(
        'SELECT public.dsr_outbox_drain(10) AS result',
      );
      expect(r.rows[0]!.result.delivered).toBe(1);
    });
    await ctx.withClaims({ role: 'service_role' }, async () => {
      const r = await ctx.client.query<{ result: { delivered: number } }>(
        'SELECT public.dsr_outbox_drain(10) AS result',
      );
      expect(r.rows[0]!.result.delivered).toBe(0);
    });

    const events = await ctx.client.query(
      `SELECT id FROM public.runtime_events
       WHERE type='dsr.created' AND source='governance-dsr-outbox' AND correlation_id=$1`,
      [id],
    );
    expect(events.rowCount).toBe(1);
    const outbox = await ctx.client.query<{ state: string; attempt_count: number }>(
      'SELECT state, attempt_count FROM public.dsr_evidence_outbox WHERE dsr_id=$1', [id],
    );
    expect(outbox.rows[0]).toMatchObject({ state: 'delivered', attempt_count: 1 });
  });

  it('denies the drain RPC to authenticated non-service users', async () => {
    const { userId } = await createTenantWithMember(ctx);
    await expect(ctx.withClaims({ sub: userId, role: 'authenticated' }, async () => {
      await ctx.client.query('SELECT public.dsr_outbox_drain(10)');
    })).rejects.toThrow();
  });

  it('does not allow a tenant member to read another tenant evidence queue', async () => {
    const a = await createTenantWithMember(ctx);
    const b = await createTenantWithMember(ctx);
    const own = await createDsr(ctx, a.tenantId);
    const foreign = await createDsr(ctx, b.tenantId);
    await ctx.withClaims({ sub: a.userId, role: 'authenticated' }, async () => {
      const rows = await ctx.client.query<{ dsr_id: string }>(
        'SELECT dsr_id FROM public.dsr_evidence_outbox ORDER BY created_at',
      );
      expect(rows.rows.map(x => x.dsr_id)).toContain(own);
      expect(rows.rows.map(x => x.dsr_id)).not.toContain(foreign);
    });
    // A failed SQL statement aborts a PostgreSQL subtransaction. Let
    // withClaims roll its savepoint back instead of catching inside it.
    await expect(ctx.withClaims({ sub: a.userId, role: 'authenticated' }, async () => {
      await ctx.client.query(
        `INSERT INTO public.dsr_evidence_outbox(tenant_id, dsr_id, event_type)
         VALUES ($1, $2, 'dsr.created')`, [a.tenantId, own],
      );
    })).rejects.toThrow();
  });

  it('queues evidence for an update from another trusted DB writer (erasure sweeper path)', async () => {
    const { tenantId } = await createTenantWithMember(ctx);
    const id = await createDsr(ctx, tenantId);
    await ctx.client.query(
      `UPDATE public.dsr_requests SET status='completed', completed_at=now()
       WHERE id=$1`, [id],
    );
    const rows = await ctx.client.query<{ event_type: string }>(
      'SELECT event_type FROM public.dsr_evidence_outbox WHERE dsr_id=$1 ORDER BY created_at,id', [id],
    );
    expect(rows.rows.map(x => x.event_type).sort()).toEqual(['dsr.closed', 'dsr.created']);
  });

  it('keeps failed evidence pending and can later deliver the same outbox item', async () => {
    const { tenantId } = await createTenantWithMember(ctx);
    const id = await createDsr(ctx, tenantId);
    await ctx.client.query(
      `ALTER TABLE public.runtime_events
       ADD CONSTRAINT dsr_force_runtime_fail CHECK (type <> 'dsr.created')`,
    );
    await ctx.withClaims({ role: 'service_role' }, async () => {
      const res = await ctx.client.query<{ result: { failed_in_batch: number } }>(
        'SELECT public.dsr_outbox_drain(10) AS result',
      );
      expect(res.rows[0]!.result.failed_in_batch).toBe(1);
    });
    const failed = await ctx.client.query<{ state: string; attempt_count: number; last_error: string }>(
      'SELECT state, attempt_count, last_error FROM public.dsr_evidence_outbox WHERE dsr_id=$1', [id],
    );
    expect(failed.rows[0]).toMatchObject({
      state: 'failed', attempt_count: 1, last_error: 'SQLSTATE_23514',
    });
    expect(failed.rows[0]!.last_error).not.toContain(requester);

    await ctx.client.query('ALTER TABLE public.runtime_events DROP CONSTRAINT dsr_force_runtime_fail');
    await ctx.client.query(
      'UPDATE public.dsr_evidence_outbox SET next_attempt_at=now() WHERE dsr_id=$1', [id],
    );
    await ctx.withClaims({ role: 'service_role' }, async () => {
      const res = await ctx.client.query<{ result: { delivered: number } }>(
        'SELECT public.dsr_outbox_drain(10) AS result',
      );
      expect(res.rows[0]!.result.delivered).toBe(1);
    });
    const events = await ctx.client.query(
      `SELECT id FROM public.runtime_events WHERE source='governance-dsr-outbox'
       AND type='dsr.created' AND correlation_id=$1`, [id],
    );
    expect(events.rowCount).toBe(1);
  });

  it('retries an unlinked DSR after a tenant HMAC key is recovered', async () => {
    const {tenantId} = await createTenantWithMember(ctx);
    const id = await createDsr(ctx, tenantId, {missingKey: true});

    await ctx.withClaims({role:'service_role'}, async () => {
      const result = await ctx.client.query<{result:{failed_in_batch:number}}>(
        'SELECT public.dsr_outbox_drain(10) AS result',
      );
      expect(result.rows[0]!.result.failed_in_batch).toBe(1);
    });
    const retry = await ctx.client.query<{state:string,last_error:string}>(
      'SELECT state,last_error FROM public.dsr_evidence_outbox WHERE dsr_id=$1', [id],
    );
    expect(retry.rows[0]).toMatchObject({state:'failed',last_error:'SQLSTATE_P0002'});
    const before = await ctx.client.query(
      "SELECT id FROM public.runtime_events WHERE type='dsr.created' AND correlation_id=$1",
      [id],
    );
    expect(before.rowCount).toBe(0);

    // Recovered Vault key must retry the *same* durable task.
    await seedDsrKey(ctx, tenantId);
    await ctx.client.query(
      'UPDATE public.dsr_evidence_outbox SET next_attempt_at=now() WHERE dsr_id=$1', [id],
    );
    await ctx.withClaims({role:'service_role'}, async () => {
      const result = await ctx.client.query<{result:{delivered:number}}>(
        'SELECT public.dsr_outbox_drain(10) AS result',
      );
      expect(result.rows[0]!.result.delivered).toBe(1);
    });
    const linked = await ctx.client.query<{subject_ref:string}>(
      "SELECT metadata->>'subject_ref' AS subject_ref FROM public.dsr_requests WHERE id=$1",
      [id],
    );
    const subjectRef=linked.rows[0]!.subject_ref;
    expect(subjectRef).toMatch(/^[a-f0-9]{64}$/);
    const mapping = await ctx.client.query<{key_version:number}>(
      'SELECT key_version FROM public.subject_ref_mappings WHERE tenant_id=$1 AND subject_ref=$2',
      [tenantId,subjectRef],
    );
    expect(mapping.rows[0]!.key_version).toBe(1);
    const event=await ctx.client.query(
      "SELECT subject_ref FROM public.runtime_events WHERE type='dsr.created' AND correlation_id=$1",
      [id],
    );
    expect(event.rows).toEqual([{subject_ref:subjectRef}]);
  });

  it('atomically enqueues erasure once and preserves the retention timestamp on replay', async () => {
    const {tenantId} = await createTenantWithMember(ctx);
    const id = await createDsr(ctx, tenantId, {requestType:'erasure'});
    const runDrain = () => ctx.withClaims({role:'service_role'}, async () => {
      const r=await ctx.client.query<{result:{delivered:number}}>(
        'SELECT public.dsr_outbox_drain(10) AS result',
      );
      return r.rows[0]!.result.delivered;
    });
    expect(await runDrain()).toBe(1);
    const marker=await ctx.client.query<{deletion_requested_at:Date,erased_at:Date|null}>(
      "SELECT deletion_requested_at,erased_at FROM public.subject_ref_mappings WHERE tenant_id=$1",
      [tenantId],
    );
    expect(marker.rows[0]!.deletion_requested_at).toBeTruthy();
    expect(marker.rows[0]!.erased_at).toBeNull();
    expect(await runDrain()).toBe(0);
    const unchanged=await ctx.client.query<{deletion_requested_at:Date}>(
      'SELECT deletion_requested_at FROM public.subject_ref_mappings WHERE tenant_id=$1',
      [tenantId],
    );
    expect(unchanged.rows[0]!.deletion_requested_at).toEqual(marker.rows[0]!.deletion_requested_at);
    const erasureEvents=await ctx.client.query(
      "SELECT id FROM public.runtime_events WHERE type='dsr.erasure_requested' AND correlation_id=$1",
      [id],
    );
    expect(erasureEvents.rowCount).toBe(1);
    // The existing SPEC-001 hash chain must include BOTH atomic events.
    const chained = await ctx.client.query<{prev_hash:Buffer|null;event_hash:Buffer;tenant_seq:string}>(
      'SELECT prev_hash,event_hash,tenant_seq FROM public.runtime_events WHERE correlation_id=$1 ORDER BY tenant_seq',
      [id],
    );
    expect(chained.rows).toHaveLength(2);
    expect(chained.rows[0]!.event_hash.length).toBe(32);
    expect(chained.rows[1]!.prev_hash).toEqual(chained.rows[0]!.event_hash);
  });


  it('rolls back erasure marker, mapping and chained evidence together on delivery failure', async () => {
    const {tenantId} = await createTenantWithMember(ctx);
    const id = await createDsr(ctx, tenantId, {requestType:'erasure'});
    await ctx.client.query(
      "ALTER TABLE public.runtime_events ADD CONSTRAINT dsr_block_erasure_event CHECK (type <> 'dsr.erasure_requested')",
    );
    await ctx.withClaims({role:'service_role'}, async () => {
      const result = await ctx.client.query<{result:{failed_in_batch:number}}>(
        'SELECT public.dsr_outbox_drain(10) AS result',
      );
      expect(result.rows[0]!.result.failed_in_batch).toBe(1);
    });
    const mappings = await ctx.client.query(
      'SELECT subject_ref FROM public.subject_ref_mappings WHERE tenant_id=$1', [tenantId],
    );
    expect(mappings.rowCount).toBe(0);
    const events = await ctx.client.query(
      'SELECT type FROM public.runtime_events WHERE correlation_id=$1', [id],
    );
    expect(events.rowCount).toBe(0);
    const pending = await ctx.client.query<{state:string;last_error:string}>(
      'SELECT state,last_error FROM public.dsr_evidence_outbox WHERE dsr_id=$1',
      [id],
    );
    expect(pending.rows[0]).toMatchObject({state:'failed',last_error:'SQLSTATE_23514'});

    await ctx.client.query('ALTER TABLE public.runtime_events DROP CONSTRAINT dsr_block_erasure_event');
    await ctx.client.query(
      'UPDATE public.dsr_evidence_outbox SET next_attempt_at=now() WHERE dsr_id=$1', [id],
    );
    await ctx.withClaims({role:'service_role'}, async () => {
      const result = await ctx.client.query<{result:{delivered:number}}>(
        'SELECT public.dsr_outbox_drain(10) AS result',
      );
      expect(result.rows[0]!.result.delivered).toBe(1);
    });
    const restored = await ctx.client.query(
      'SELECT deletion_requested_at FROM public.subject_ref_mappings WHERE tenant_id=$1',
      [tenantId],
    );
    expect(restored.rowCount).toBe(1);
    expect(restored.rows[0]!.deletion_requested_at).toBeTruthy();
    const evidence = await ctx.client.query(
      'SELECT type FROM public.runtime_events WHERE correlation_id=$1 ORDER BY tenant_seq',
      [id],
    );
    expect(evidence.rows.map(r=>r.type)).toEqual(['dsr.created','dsr.erasure_requested']);
  });

});
