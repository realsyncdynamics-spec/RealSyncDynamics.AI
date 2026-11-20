import test from 'node:test';
import assert from 'node:assert/strict';
import { createFactoryLoopDbAdapter } from '../adapter.mjs';

const taskId = '11111111-1111-4111-8111-111111111111';
const tenantId = '22222222-2222-4222-8222-222222222222';
const ready = {
  status: 'ready', checkpointVersion: 1,
  goal: { jobId: taskId, requireHumanReview: true },
  events: [{ seq: 1, type: 'loop_created' }], nextSteps: [],
};
const input = { taskId, tenantId };
const backend = (reply) => {
  const calls = [];
  const client = {
    async query(sql, params) {
      calls.push({ sql, params });
      if (reply instanceof Error) throw reply;
      return { rows: [{ result: reply }] };
    },
  };
  return { adapter: createFactoryLoopDbAdapter(client), calls };
};

test('server-only pg client injection is mandatory', () => {
  assert.throws(() => createFactoryLoopDbAdapter(null), /client_required/);
  assert.throws(() => createFactoryLoopDbAdapter({}), /client_required/);
});

test('initialization uses one parameterized stored-procedure call', async () => {
  const { adapter, calls } = backend({ version: 1, replayed: false });
  const result = await adapter.init({ ...input, idempotencyKey: 'initialize-01', state: ready });
  assert.deepEqual(result, { version: 1, replayed: false });
  assert.equal(calls.length, 1);
  assert.match(calls[0].sql, /loop_init\(\$1::uuid/);
  assert.equal(JSON.parse(calls[0].params[3]).goal.jobId, taskId);
  assert.equal(calls[0].params[4], JSON.stringify(ready.events[0]));
});

test('invalid IDs and idempotency keys fail before SQL calls', async () => {
  const { adapter, calls } = backend({ version: 1, replayed: false });
  await assert.rejects(adapter.init({
    ...input, taskId: 'not-uuid', idempotencyKey: 'initialize-01', state: ready,
  }), /task_id_invalid/);
  await assert.rejects(adapter.init({
    ...input, idempotencyKey: 'a', state: ready,
  }), /idempotency_key_invalid/);
  assert.equal(calls.length, 0);
});

test('cannot initialize a preapproved or unbound snapshot', async () => {
  const { adapter } = backend({ version: 1, replayed: false });
  await assert.rejects(adapter.init({
    ...input, idempotencyKey: 'initialize-01', state: { ...ready, status: 'review_required' },
  }), /initial_state_invalid/);
  await assert.rejects(adapter.init({
    ...input, idempotencyKey: 'initialize-01',
    state: { ...ready, goal: { ...ready.goal, jobId: tenantId } },
  }), /snapshot_invalid/);
});

test('claim validates lease and preserves fenced epoch', async () => {
  const { adapter, calls } = backend({
    version: 1, lease_epoch: 3, lease_expires_at: '2026-11-20T12:00:00Z',
  });
  const result = await adapter.claim({ ...input, workerId: 'worker-01', leaseSeconds: 60 });
  assert.deepEqual(result, {
    version: 1, leaseEpoch: 3, leaseExpiresAt: '2026-11-20T12:00:00Z',
  });
  assert.match(calls[0].sql, /loop_claim/);
  assert.equal(calls[0].params[3], 60);
  await assert.rejects(adapter.claim({ ...input, workerId: 'worker-01', leaseSeconds: 36000 }),
    /lease_seconds_invalid/);
});

test('commit binds expected version, worker and epoch as SQL parameters', async () => {
  const { adapter, calls } = backend({ version: 2, replayed: false });
  const state = {
    ...ready, status: 'awaiting_verification', checkpointVersion: 2,
    events: [...ready.events, { seq: 2, type: 'evidence_submitted' }],
  };
  const result = await adapter.commit({
    ...input, expectedVersion: 1, workerId: 'worker-01', leaseEpoch: 2,
    idempotencyKey: 'commit-0001', state,
  });
  assert.equal(result.version, 2);
  assert.deepEqual(calls[0].params.slice(0, 6),
    [taskId, tenantId, 1, 'worker-01', 2, 'commit-0001']);
});

test('invalid version and snapshot state cannot reach the database', async () => {
  const { adapter, calls } = backend({ version: 2, replayed: false });
  await assert.rejects(adapter.commit({
    ...input, expectedVersion: 1, workerId: 'worker-01', leaseEpoch: 2,
    idempotencyKey: 'commit-0001', state: ready,
  }), /checkpoint_version_invalid/);
  assert.equal(calls.length, 0);
});

test('SQL errors fail closed without leaking raw query details', async () => {
  const { adapter } = backend(new Error('secret connection string'));
  await assert.rejects(adapter.init({
    ...input, idempotencyKey: 'initialize-01', state: ready,
  }), error => error.message === 'factory_db_write_failed');
});

test('read restores a version-matched task checkpoint', async () => {
  const { adapter } = backend({
    version: 1, snapshot: ready, lease_epoch: 1, lease_expires_at: null,
  });
  const saved = await adapter.read(input);
  assert.equal(saved.version, 1);
  assert.equal(saved.state.goal.jobId, taskId);
});

test('a malformed DB row never counts as persisted state', async () => {
  const { adapter } = backend({ version: 3, snapshot: ready });
  await assert.rejects(adapter.read(input), /invalid_response/);
});

test('heartbeat renews same fenced epoch and rejects invalid parameters', async () => {
  const { adapter, calls } = backend({
    version: 1, lease_epoch: 4, lease_expires_at: '2026-11-20T12:45:00Z',
  });
  const result = await adapter.heartbeat({
    ...input, workerId: 'worker-01', leaseEpoch: 4, leaseSeconds: 60,
  });
  assert.deepEqual(result, {
    version: 1, leaseEpoch: 4, leaseExpiresAt: '2026-11-20T12:45:00Z',
  });
  assert.match(calls[0].sql, /loop_heartbeat/);
  assert.deepEqual(calls[0].params, [taskId, tenantId, 'worker-01', 4, 60]);
  await assert.rejects(adapter.heartbeat({
    ...input, workerId: 'worker-01', leaseEpoch: 0,
  }), /lease_epoch_invalid/);
  assert.equal(calls.length, 1);
});

test('release requires matching fenced epoch and returns explicit receipt', async () => {
  const { adapter, calls } = backend({ released: true, lease_epoch: 4 });
  const result = await adapter.release({
    ...input, workerId: 'worker-01', leaseEpoch: 4,
  });
  assert.deepEqual(result, { released: true, leaseEpoch: 4 });
  assert.match(calls[0].sql, /loop_release/);
  assert.deepEqual(calls[0].params, [taskId, tenantId, 'worker-01', 4]);
  await assert.rejects(adapter.release({
    ...input, workerId: 'worker-01', leaseEpoch: -1,
  }), /lease_epoch_invalid/);
  assert.equal(calls.length, 1);
});
