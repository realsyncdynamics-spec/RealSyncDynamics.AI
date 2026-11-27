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

async function createDsr(ctx: DbCtx, tenantId: string) {
  const r = await ctx.client.query<{ id: string }>(
    `INSERT INTO public.dsr_requests(tenant_id, request_type, requester_email, status)
     VALUES ($1, 'access', $2, 'received') RETURNING id`,
    [tenantId, requester],
  );
  return r.rows[0]!.id;
}

async function queueCount(ctx: DbCtx, id: string) {
  const r = await ctx.client.query<{ count: string }>(
    'SELECT count(*) FROM public.dsr_evidence_outbox WHERE dsr_id = $1', [id],
  );
  return Number(r.rows[0]!.count);
}


async function prepareSubjectKey(ctx: DbCtx, tenantId: string): Promise<string> {
  const name = `test_dsr_subject_${tenantId}_v1`;
  await ctx.client.query(
    `INSERT INTO public.subject_ref_keys
       (tenant_id, key_version, vault_secret_name, status)
     VALUES ($1, 1, $2, 'active')`,
    [tenantId, name],
  );
  await seedAppSecret(ctx, name, 'test-hmac-secret-for-dsr-recovery');
  const { rows } = await ctx.client.query<{ subject_ref: string }>(
    "SELECT public.subject_ref_compute($1,'email',$2) AS subject_ref",
    [tenantId, requester],
  );
  return rows[0]!.subject_ref;
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
    // New contract: evidence cannot be delivered without a verified subject
    // anchor. The link operation also creates a second durable DSR update.
    const ref = await prepareSubjectKey(ctx, tenantId);
    await ctx.withClaims({ role: 'service_role' }, async () => {
      const row = await ctx.client.query<{ ok: boolean }>(
        'SELECT public.dsr_outbox_subject_link($1,$2,$3,1) AS ok', [id, tenantId, ref],
      );
      expect(row.rows[0]!.ok).toBe(true);
      const r = await ctx.client.query<{ result: { delivered: number } }>(
        'SELECT public.dsr_outbox_drain(10) AS result',
      );
      expect(r.rows[0]!.result.delivered).toBe(2);
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
    expect(outbox.rows).toHaveLength(2);
    expect(outbox.rows.every(x => x.state === 'delivered' && x.attempt_count === 1)).toBe(true);
  });

  it('denies the drain RPC to authenticated non-service users', async () => {
    const { userId } = await createTenantWithMember(ctx);
    await expect(ctx.withClaims({ sub: userId, role: 'authenticated' }, async () => {
      await ctx.client.query('SELECT public.dsr_outbox_drain(10)');
    })).rejects.toThrow();
  });

  it('denies access to service-only subject email recovery and link RPCs', async () => {
    const { tenantId, userId } = await createTenantWithMember(ctx);
    const id = await createDsr(ctx, tenantId);
    await expect(ctx.withClaims({ sub: userId, role: 'authenticated' }, async () => {
      await ctx.client.query('SELECT * FROM public.dsr_outbox_subject_pending(10)');
    })).rejects.toThrow();
    await expect(ctx.withClaims({ sub: userId, role: 'authenticated' }, async () => {
      await ctx.client.query(
        'SELECT public.dsr_outbox_subject_link($1,$2,$3,1)',
        [id, tenantId, 'unauthorized-subject-ref'],
      );
    })).rejects.toThrow();
    const rows = await ctx.client.query(
      'SELECT 1 FROM public.subject_ref_mappings WHERE tenant_id=$1', [tenantId],
    );
    expect(rows.rowCount).toBe(0);
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
    const ref = await prepareSubjectKey(ctx, tenantId);
    await ctx.withClaims({ role: 'service_role' }, async () => {
      await ctx.client.query(
        'SELECT public.dsr_outbox_subject_link($1,$2,$3,1)', [id, tenantId, ref],
      );
    });
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
      "SELECT state, attempt_count, last_error FROM public.dsr_evidence_outbox WHERE dsr_id=$1 AND event_type='dsr.created'", [id],
    );
    expect(failed.rows[0]).toMatchObject({
      state: 'failed', attempt_count: 1, last_error: 'SQLSTATE_23514',
    });
    expect(failed.rows[0]!.last_error).not.toContain(requester);

    await ctx.client.query('ALTER TABLE public.runtime_events DROP CONSTRAINT dsr_force_runtime_fail');
    await ctx.client.query(
      "UPDATE public.dsr_evidence_outbox SET next_attempt_at=now() WHERE dsr_id=$1 AND state='failed'", [id],
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
  it('keeps subjectless evidence pending, then recovers with a verified HMAC', async () => {
    const { tenantId } = await createTenantWithMember(ctx);
    const id = await createDsr(ctx, tenantId);
    await ctx.withClaims({ role: 'service_role' }, async () => {
      const tasks = await ctx.client.query<{ dsr_id: string; requester_email: string }>(
        'SELECT * FROM public.dsr_outbox_subject_pending(10)',
      );
      expect(tasks.rows).toEqual([
        expect.objectContaining({ dsr_id: id, requester_email: requester }),
      ]);
      const attempted = await ctx.client.query<{ status: { failed_in_batch: number } }>(
        'SELECT public.dsr_outbox_drain(10) AS status',
      );
      expect(attempted.rows[0]!.status.failed_in_batch).toBe(1);
    });
    const waiting = await ctx.client.query<{ last_error: string; state: string }>(
      'SELECT state, last_error FROM public.dsr_evidence_outbox WHERE dsr_id=$1', [id],
    );
    expect(waiting.rows[0]).toMatchObject({ state: 'failed', last_error: 'SUBJECT_PENDING' });
    // Subject/HMAC outages must remain retryable and not exhaust the
    // twelve-attempt budget reserved for actual evidence write errors.
    for (let attempt = 0; attempt < 14; attempt++) {
      await ctx.client.query(
        'UPDATE public.dsr_evidence_outbox SET next_attempt_at=now() WHERE dsr_id=$1', [id],
      );
      await ctx.withClaims({ role: 'service_role' }, async () => {
        const { rows } = await ctx.client.query<{ result: { failed_in_batch: number } }>(
          'SELECT public.dsr_outbox_drain(10) AS result',
        );
        expect(rows[0]!.result.failed_in_batch).toBe(1);
      });
    }
    const afterOutage = await ctx.client.query<{ attempt_count: number; state: string }>(
      'SELECT attempt_count, state FROM public.dsr_evidence_outbox WHERE dsr_id=$1', [id],
    );
    expect(afterOutage.rows[0]).toMatchObject({ attempt_count: 0, state: 'failed' });

    const subjectRef = await prepareSubjectKey(ctx, tenantId);
    await ctx.withClaims({ role: 'service_role' }, async () => {
      const linked = await ctx.client.query<{ ok: boolean }>(
        'SELECT public.dsr_outbox_subject_link($1,$2,$3,1) AS ok',
        [id, tenantId, subjectRef],
      );
      expect(linked.rows[0]!.ok).toBe(true);
    });
    await ctx.client.query(
      'UPDATE public.dsr_evidence_outbox SET next_attempt_at=now() WHERE dsr_id=$1', [id],
    );
    await ctx.withClaims({ role: 'service_role' }, async () => {
      const res = await ctx.client.query<{ status: { delivered: number } }>(
        'SELECT public.dsr_outbox_drain(10) AS status',
      );
      expect(res.rows[0]!.status.delivered).toBe(2);
    });
    const emitted = await ctx.client.query<{ subject_ref: string }>(
      "SELECT subject_ref FROM public.runtime_events WHERE correlation_id=$1 AND source='governance-dsr-outbox'", [id],
    );
    expect(emitted.rows).toHaveLength(2);
    expect(emitted.rows.every(r => r.subject_ref === subjectRef)).toBe(true);
  });

  it('rejects forged subject refs and wrong-tenant linking without side effects', async () => {
    const owner = await createTenantWithMember(ctx);
    const foreign = await createTenantWithMember(ctx);
    const id = await createDsr(ctx, owner.tenantId);
    const ref = await prepareSubjectKey(ctx, owner.tenantId);
    await expect(ctx.withClaims({ role: 'service_role' }, async () => {
      await ctx.client.query(
        'SELECT public.dsr_outbox_subject_link($1,$2,$3,1)',
        [id, foreign.tenantId, ref],
      );
    })).rejects.toThrow();
    await expect(ctx.withClaims({ role: 'service_role' }, async () => {
      await ctx.client.query(
        'SELECT public.dsr_outbox_subject_link($1,$2,$3,1)',
        [id, owner.tenantId, 'fake-subject-reference'],
      );
    })).rejects.toThrow();
    const mappings = await ctx.client.query(
      'SELECT subject_ref FROM public.subject_ref_mappings WHERE tenant_id=$1',
      [owner.tenantId],
    );
    expect(mappings.rowCount).toBe(0);
    expect(await queueCount(ctx, id)).toBe(1);
  });

  it('records an erasure marker once without resetting the retention clock', async () => {
    const { tenantId } = await createTenantWithMember(ctx);
    const { rows } = await ctx.client.query<{ id: string }>(
      "INSERT INTO public.dsr_requests(tenant_id,request_type,requester_email,status) VALUES ($1,'erasure',$2,'received') RETURNING id",
      [tenantId, requester],
    );
    const id = rows[0]!.id;
    const ref = await prepareSubjectKey(ctx, tenantId);
    const link = () => ctx.withClaims({ role: 'service_role' }, async () =>
      ctx.client.query('SELECT public.dsr_outbox_subject_link($1,$2,$3,1)', [id, tenantId, ref]));
    await link();
    const { rows: first } = await ctx.client.query<{ deletion_requested_at: Date }>(
      'SELECT deletion_requested_at FROM public.subject_ref_mappings WHERE subject_ref=$1', [ref],
    );
    expect(first[0]!.deletion_requested_at).toBeTruthy();
    await link();
    const { rows: second } = await ctx.client.query<{ deletion_requested_at: Date }>(
      'SELECT deletion_requested_at FROM public.subject_ref_mappings WHERE subject_ref=$1', [ref],
    );
    expect(second[0]!.deletion_requested_at).toEqual(first[0]!.deletion_requested_at);
    const queuedErasure = await ctx.client.query(
      "SELECT event_type FROM public.dsr_evidence_outbox WHERE dsr_id=$1 AND event_type='dsr.erasure_requested'",
      [id],
    );
    expect(queuedErasure.rowCount).toBe(1);
    expect(await queueCount(ctx, id)).toBe(3);
    await ctx.withClaims({ role: 'service_role' }, async () => {
      const sent = await ctx.client.query<{ outcome: { delivered: number } }>(
        'SELECT public.dsr_outbox_drain(10) AS outcome',
      );
      expect(sent.rows[0]!.outcome.delivered).toBe(3);
      const replay = await ctx.client.query<{ outcome: { delivered: number } }>(
        'SELECT public.dsr_outbox_drain(10) AS outcome',
      );
      expect(replay.rows[0]!.outcome.delivered).toBe(0);
    });
  });

});
