/** SF-005: run only on a disposable PostgreSQL test database. */
import { beforeEach, afterEach, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createGoalLoop, submitLoopEvidence, verifyLoopEvidence } from '../../../apps/factory-worker/loop/engine.mjs';
import { openDb, closeDb, createTenantWithMember, requireDbOrFail, type DbCtx } from './db-helpers';

const sql = readFileSync(join(__dirname,
  '../../../apps/factory-worker/loop/db/postgres-contract.sql'), 'utf8');
describe('SF-005 SQL contract static', () => {
  it('uses existing queue and audit', () => {
    expect(sql).toContain('REFERENCES public.agent_tasks(id)');
    expect(sql).toContain('INSERT INTO public.agent_events');
    expect(sql).not.toContain('CREATE TABLE public.agent_tasks');
    expect(sql).not.toContain('cron.schedule(');
  });
  it('enforces CAS, lease fencing and idempotency', () => {
    expect(sql).toContain('r.version <> p_expected_version');
    expect(sql).toContain('r.lease_epoch <> p_lease_epoch');
    expect(sql).toContain('idempotency_conflict');
  });
  it('remains a private service-only API', () => {
    expect(sql).toContain('ENABLE ROW LEVEL SECURITY');
    expect(sql).toContain('SECURITY DEFINER SET search_path = pg_catalog');
    expect(sql).toContain('FROM PUBLIC, anon, authenticated');
  });
});

const hasDb = requireDbOrFail('sf005-postgres-contract');
const permitted = process.env.SF005_DISPOSABLE_DB === '1';
if (process.env.REQUIRE_DB_TESTS === '1' && !permitted) {
  throw new Error('SF005_DISPOSABLE_DB=1 erforderlich: niemals auf Produktion testen');
}
const d = hasDb && permitted ? describe : describe.skip;
d('SF-005 real PostgreSQL — requires isolated DB plus contract installed', () => {
  let ctx: DbCtx | null = null;
  let tenantId = '', memberId = '', taskId = '';
  let initial: ReturnType<typeof createGoalLoop>;
  const q = (query: string, params: unknown[] = []) => ctx!.client.query(query, params);
  async function rejected(query: string, params: unknown[], regex: RegExp) {
    await q('SAVEPOINT sf005_check');
    try {
      await expect(q(query, params)).rejects.toThrow(regex);
    } finally {
      await q('ROLLBACK TO SAVEPOINT sf005_check');
      await q('RELEASE SAVEPOINT sf005_check');
    }
  }
  const init = async () => (await q(
    'SELECT factory_runtime.loop_init($1::uuid,$2::uuid,$3,$4::jsonb,$5::jsonb) AS result',
    [taskId, tenantId, 'initialize-01', JSON.stringify(initial),
     JSON.stringify(initial.events[0])])).rows[0].result;
  const claim = async () => (await q(
    'SELECT factory_runtime.loop_claim($1::uuid,$2::uuid,$3,300) AS result',
    [taskId, tenantId, 'worker-01'])).rows[0].result;
  const commit = async (version: number, epoch: number, state: unknown, event: unknown, key='commit-0001') =>
    (await q('SELECT factory_runtime.loop_commit($1::uuid,$2::uuid,$3::bigint,$4,$5::bigint,$6,$7::jsonb,$8::jsonb) AS result',
      [taskId, tenantId, version, 'worker-01', epoch, key,
       JSON.stringify(state), JSON.stringify(event)])).rows[0].result;
  const submit = () => submitLoopEvidence(initial, {
    authorId: 'builder-01', costCents: 100,
    evidence: [{ criterionId: 'build', evidenceRef: 'artifact:builder_001' }],
  }, initial.startedAtMs + 10);

  beforeEach(async () => {
    ctx = await openDb();
    const ids = await createTenantWithMember(ctx);
    tenantId = ids.tenantId; memberId = ids.userId;
    const task = await q(
      'INSERT INTO public.agent_tasks(tenant_id,agent,task,status,input) ' +
      'VALUES ($1,$2,$3,$4,$5::jsonb) RETURNING id',
      [tenantId, 'software-factory', 'SF-005 DB contract', 'open',
       JSON.stringify({ factory_kind: 'software_factory',
         repository: 'realsyncdynamics-spec/RealSyncDynamics.AI' })]);
    taskId = task.rows[0].id;
    initial = createGoalLoop({
      id: taskId, status: 'queued', repository: 'realsyncdynamics-spec/RealSyncDynamics.AI',
      limits: { maxCostCents: 500, maxImplementationAttempts: 3 },
    }, {
      schemaVersion: 1, goalId: 'goal-001', jobId: taskId,
      repository: 'realsyncdynamics-spec/RealSyncDynamics.AI',
      statement: 'Review a safe change', requireHumanReview: true,
      criteria: [{ id: 'build', description: 'Build passes' }],
    }, { maxIterations: 3, maxCostCents: 500, maxDurationMs: 600000 },
       'run-001', Date.now());
  });
  afterEach(async () => { await closeDb(ctx); ctx = null; });

  it('initializes exactly once and replays duplicate idempotency keys', async () => {
    expect(await init()).toMatchObject({ version: 1, replayed: false });
    expect(await init()).toMatchObject({ version: 1, replayed: true });
    const r = await q('SELECT version FROM factory_runtime.loop_checkpoints WHERE task_id=$1', [taskId]);
    expect(Number(r.rows[0].version)).toBe(1);
    const audit = await q("SELECT count(*)::int AS n FROM public.agent_events WHERE tenant_id=$1 AND event_type='factory.loop.created'", [tenantId]);
    expect(audit.rows[0].n).toBe(1);
  });
  it('enforces tenant isolation on read and initialization', async () => {
    await init();
    const other = await createTenantWithMember(ctx!);
    await rejected('SELECT factory_runtime.loop_read($1::uuid,$2::uuid)',
      [taskId, other.tenantId], /loop_not_found/);
    await rejected('SELECT factory_runtime.loop_init($1::uuid,$2::uuid,$3,$4::jsonb,$5::jsonb)',
      [taskId, other.tenantId, 'initialize-02', JSON.stringify(initial),
       JSON.stringify(initial.events[0])], /task_binding_denied/);
  });
  it('persists a CAS update, allows replay, rejects stale version', async () => {
    await init();
    const lease = await claim();
    const after = submit();
    expect(await commit(1, Number(lease.lease_epoch), after, after.events.at(-1)))
      .toMatchObject({ version: 2, replayed: false });
    expect(await commit(1, Number(lease.lease_epoch), after, after.events.at(-1)))
      .toMatchObject({ version: 2, replayed: true });
    await rejected('SELECT factory_runtime.loop_commit($1::uuid,$2::uuid,$3::bigint,$4,$5::bigint,$6,$7::jsonb,$8::jsonb)',
      [taskId, tenantId, 1, 'worker-01', lease.lease_epoch, 'another-commit',
       JSON.stringify(after), JSON.stringify(after.events.at(-1))], /stale_checkpoint_version/);
  });
  it('rejects stale fencing epoch and forged review status', async () => {
    await init();
    const lease = await claim();
    const after = submit();
    await rejected('SELECT factory_runtime.loop_commit($1::uuid,$2::uuid,$3::bigint,$4,$5::bigint,$6,$7::jsonb,$8::jsonb)',
      [taskId, tenantId, 1, 'worker-01', Number(lease.lease_epoch)+1, 'stale-epoch',
       JSON.stringify(after), JSON.stringify(after.events.at(-1))], /stale_or_missing_lease/);
    await rejected('SELECT factory_runtime.loop_commit($1::uuid,$2::uuid,$3::bigint,$4,$5::bigint,$6,$7::jsonb,$8::jsonb)',
      [taskId, tenantId, 1, 'worker-01', lease.lease_epoch, 'forged-review',
       JSON.stringify({ ...after, status: 'review_required' }),
       JSON.stringify(after.events.at(-1))], /invalid_loop_transition/);
  });
  it('rolls back checkpoint when the versioned audit event insert fails', async () => {
    await init();
    const lease = await claim();
    const after = submit();
    await q('INSERT INTO factory_runtime.loop_events ' +
      '(task_id,tenant_id,version,idempotency_key,snapshot,event_data) ' +
      'VALUES ($1,$2,2,$3,$4::jsonb,$5::jsonb)',
      [taskId, tenantId, 'collision-01', JSON.stringify(after), JSON.stringify(after.events.at(-1))]);
    await rejected('SELECT factory_runtime.loop_commit($1::uuid,$2::uuid,$3::bigint,$4,$5::bigint,$6,$7::jsonb,$8::jsonb)',
      [taskId, tenantId, 1, 'worker-01', lease.lease_epoch, 'commit-0001',
       JSON.stringify(after), JSON.stringify(after.events.at(-1))], /duplicate key/);
    const r = await q('SELECT version, snapshot FROM factory_runtime.loop_checkpoints WHERE task_id=$1', [taskId]);
    expect(Number(r.rows[0].version)).toBe(1);
    expect(r.rows[0].snapshot.status).toBe('ready');
  });
  it('blocks authenticated direct SQL and private function access', async () => {
    await init();
    await expect(ctx!.withClaims({sub: memberId, role: 'authenticated'}, async () => {
      await q('SELECT * FROM factory_runtime.loop_checkpoints WHERE task_id=$1', [taskId]);
    })).rejects.toThrow(/permission denied/);
    await expect(ctx!.withClaims({sub: memberId, role: 'authenticated'}, async () => {
      await q('SELECT factory_runtime.loop_read($1::uuid,$2::uuid)', [taskId, tenantId]);
    })).rejects.toThrow(/permission denied/);
  });
  it('requires an independent verifier before review_required', async () => {
    await init();
    const lease = await claim();
    const submitted = submit();
    await commit(1, Number(lease.lease_epoch), submitted,
      submitted.events.at(-1), 'commit-submitted');
    const verified = verifyLoopEvidence(submitted, {
      verifierId: 'verifier-01', attestationRef: 'artifact:verifier_001',
      checks: [{ criterionId: 'build', passed: true,
        evidenceRef: 'artifact:review_001' }],
    }, submitted.events.at(-1)!.atMs + 10);
    const forgedEvent = {
      ...verified.events.at(-1)!,
      details: { ...verified.events.at(-1)!.details, verifierId: 'builder-01' },
    };
    const forged = { ...verified, events: [...verified.events.slice(0, -1), forgedEvent] };
    await rejected(
      'SELECT factory_runtime.loop_commit($1::uuid,$2::uuid,$3::bigint,$4,$5::bigint,$6,$7::jsonb,$8::jsonb)',
      [taskId, tenantId, 2, 'worker-01', lease.lease_epoch,
        'commit-forged', JSON.stringify(forged), JSON.stringify(forgedEvent)],
      /verifier_not_independent/);
    expect(await commit(2, Number(lease.lease_epoch), verified,
      verified.events.at(-1), 'commit-verified'))
      .toMatchObject({ version: 3, replayed: false });
    const read = await q('SELECT snapshot FROM factory_runtime.loop_checkpoints WHERE task_id=$1', [taskId]);
    expect(read.rows[0].snapshot.status).toBe('review_required');
  });

});
