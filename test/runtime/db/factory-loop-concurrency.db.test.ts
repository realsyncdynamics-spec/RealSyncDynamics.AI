/**
 * SF-005 concurrency and crash-recovery acceptance test.
 *
 * NEVER run against the RealSync production Supabase project.
 * Requires a disposable PostgreSQL database, full existing Agent OS schema,
 * reviewed SF-005 SQL contract, TEST_DB_URL and SF005_DISPOSABLE_DB=1.
 *
 * Uses THREE separate PostgreSQL connections and committed fixtures:
 * a test in one uncommitted transaction would be invisible to another client.
 */
import { Client } from 'pg';
import { describe, expect, it } from 'vitest';
import { createGoalLoop, submitLoopEvidence } from '../../../apps/factory-worker/loop/engine.mjs';
import { getDbUrl, requireDbOrFail } from './db-helpers';

const hasDb = requireDbOrFail('sf005-parallel-worker');
const permitted = process.env.SF005_DISPOSABLE_DB === '1';
if (process.env.REQUIRE_DB_TESTS === '1' && !permitted) {
  throw new Error('SF005_DISPOSABLE_DB=1 erforderlich: niemals auf Produktion testen');
}
const d = hasDb && permitted ? describe : describe.skip;

d('SF-005 parallel worker claims and crash recovery (real PostgreSQL)', () => {
  it('serializes concurrent claims, fences expired owner, restores checkpoint', async () => {
    const url = getDbUrl()!;
    const admin = new Client({ connectionString: url });
    const first = new Client({ connectionString: url });
    const second = new Client({ connectionString: url });
    let tenantId: string | null = null;
    let firstTx = false;
    let pendingSecond: Promise<{ ok: boolean; reason?: string }> | null = null;
    await Promise.all([admin.connect(), first.connect(), second.connect()]);
    try {
      await Promise.all([first.query("SET statement_timeout='5s'"),
                         second.query("SET statement_timeout='5s'")]);
      const tenant = await admin.query<{ id: string }>(
        'INSERT INTO public.tenants(name) VALUES ($1) RETURNING id',
        ['sf005_concurrency_' + Math.random().toString(36).slice(2)]);
      tenantId = tenant.rows[0]!.id;
      const repository = 'realsyncdynamics-spec/RealSyncDynamics.AI';
      const task = await admin.query<{ id: string }>(
        'INSERT INTO public.agent_tasks(tenant_id,agent,task,status,input) ' +
        'VALUES ($1,$2,$3,$4,$5::jsonb) RETURNING id',
        [tenantId, 'software-factory', 'SF-005 concurrency', 'open',
         JSON.stringify({ factory_kind: 'software_factory', repository })]);
      const taskId = task.rows[0]!.id;
      const initial = createGoalLoop({
        id: taskId, status: 'queued', repository,
        limits: { maxCostCents: 500, maxImplementationAttempts: 3 },
      }, {
        schemaVersion: 1, goalId: 'concurrency-001', jobId: taskId, repository,
        statement: 'Check transactionally fenced recovery',
        requireHumanReview: true,
        criteria: [{ id: 'build', description: 'Build verification' }],
      }, { maxIterations: 3, maxCostCents: 500, maxDurationMs: 600000 },
         'concurrency-001', Date.now());
      await admin.query(
        'SELECT factory_runtime.loop_init($1::uuid,$2::uuid,$3,$4::jsonb,$5::jsonb)',
        [taskId, tenantId, 'initial-001', JSON.stringify(initial),
         JSON.stringify(initial.events[0])]);

      const firstPid = (await first.query<{ pid: number }>(
        'SELECT pg_backend_pid() AS pid')).rows[0]!.pid;
      const secondPid = (await second.query<{ pid: number }>(
        'SELECT pg_backend_pid() AS pid')).rows[0]!.pid;
      const claimSql =
        'SELECT factory_runtime.loop_claim($1::uuid,$2::uuid,$3,300) AS result';

      await first.query('BEGIN');
      firstTx = true;
      const lease1 = (await first.query(claimSql,
        [taskId, tenantId, 'worker-one'])).rows[0].result;
      expect(Number(lease1.lease_epoch)).toBe(1);

      // This must block on the same parent row while the first tx is open.
      pendingSecond = second.query(claimSql, [taskId, tenantId, 'worker-two'])
        .then(() => ({ ok: true }), (err: Error) => ({ ok: false, reason: String(err) }));
      let blocked = false;
      for (let n = 0; n < 40; n++) {
        const r = await admin.query<{ is_blocked: boolean }>(
          'SELECT $1::int = ANY(pg_blocking_pids($2::int)) AS is_blocked',
          [firstPid, secondPid]);
        if (r.rows[0]!.is_blocked) { blocked = true; break; }
        await new Promise(resolve => setTimeout(resolve, 25));
      }
      expect(blocked).toBe(true);

      await first.query('COMMIT');
      firstTx = false;
      const secondClaim = await pendingSecond;
      pendingSecond = null;
      expect(secondClaim.ok).toBe(false);
      expect(secondClaim.reason).toContain('loop_already_claimed');

      // Simulated worker crash: no heartbeat, then TTL expiration in disposable
      // test DB. No production timing is modified.
      await admin.query(
        "UPDATE factory_runtime.loop_checkpoints SET lease_expires_at = now() - interval '1 second' " +
        'WHERE task_id = $1', [taskId]);
      const lease2 = (await second.query(claimSql,
        [taskId, tenantId, 'worker-two'])).rows[0].result;
      expect(Number(lease2.lease_epoch)).toBe(2);

      const submitted = submitLoopEvidence(initial, {
        authorId: 'builder-01', costCents: 100,
        evidence: [{ criterionId: 'build', evidenceRef: 'artifact:build_001' }],
      }, initial.startedAtMs + 10);
      const commitSql =
        'SELECT factory_runtime.loop_commit($1::uuid,$2::uuid,$3::bigint,' +
        '$4,$5::bigint,$6,$7::jsonb,$8::jsonb) AS result';
      const values = (worker: string, epoch: number, key: string) =>
        [taskId, tenantId, 1, worker, epoch, key,
         JSON.stringify(submitted), JSON.stringify(submitted.events.at(-1))];

      await expect(first.query(commitSql,
        values('worker-one', 1, 'stale-commit-001')))
        .rejects.toThrow(/stale_or_missing_lease/);

      const saved = await second.query(commitSql,
        values('worker-two', 2, 'recovered-commit-001'));
      expect(Number(saved.rows[0].result.version)).toBe(2);
      const restored = (await admin.query(
        'SELECT factory_runtime.loop_read($1::uuid,$2::uuid) AS result',
        [taskId, tenantId])).rows[0].result;
      expect(Number(restored.version)).toBe(2);
      expect(restored.snapshot.status).toBe('awaiting_verification');
      expect(Number(restored.snapshot.iteration)).toBe(1);

      // Valid heartbeat can renew an existing epoch; release enables handoff.
      const pulse = (await second.query(
        'SELECT factory_runtime.loop_heartbeat($1::uuid,$2::uuid,$3,$4::bigint,120) AS result',
        [taskId, tenantId, 'worker-two', 2])).rows[0].result;
      expect(Number(pulse.lease_epoch)).toBe(2);
      const release = (await second.query(
        'SELECT factory_runtime.loop_release($1::uuid,$2::uuid,$3,$4::bigint) AS result',
        [taskId, tenantId, 'worker-two', 2])).rows[0].result;
      expect(release.released).toBe(true);
      const lease3 = (await first.query(claimSql,
        [taskId, tenantId, 'worker-one'])).rows[0].result;
      expect(Number(lease3.lease_epoch)).toBe(3);
      await expect(second.query(
        'SELECT factory_runtime.loop_release($1::uuid,$2::uuid,$3,$4::bigint) AS result',
        [taskId, tenantId, 'worker-two', 2]))
        .rejects.toThrow(/stale_or_missing_lease/);
    } finally {
      if (firstTx) await first.query('ROLLBACK').catch(() => {});
      if (pendingSecond) await pendingSecond.catch(() => {});
      await Promise.all([
        first.end().catch(() => {}), second.end().catch(() => {}),
      ]);
      if (tenantId) {
        await admin.query('DELETE FROM public.tenants WHERE id=$1', [tenantId])
          .catch(() => {});
      }
      await admin.end().catch(() => {});
    }
  });
});
