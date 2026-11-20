import test from 'node:test';
import assert from 'node:assert/strict';
import { restoreGoalLoop } from '../resume.mjs';

const taskId = '11111111-1111-4111-8111-111111111111';
const tenantId = '22222222-2222-4222-8222-222222222222';
const opts = { taskId, tenantId, workerId: 'worker-01', leaseSeconds: 300 };
const state = {
  runId: 'run-01', goal: { goalId: 'goal-01', jobId: taskId, requireHumanReview: true },
  status: 'awaiting_verification', checkpointVersion: 2, deadlineAtMs: 2000000,
  iteration: 1, spentCents: 100, limits: { maxIterations: 3, maxCostCents: 500 },
  nextSteps: [{ role: 'verifier', action: 'verify_all_criteria' }],
};
function mocked(override = {}) {
  const calls = [];
  const adapter = {
    async claim(args) { calls.push('claim'); return { version: 2, leaseEpoch: 5, leaseExpiresAt: 'test' }; },
    async read(args) { calls.push('read'); return { version: 2, state }; },
    async release(args) { calls.push('release'); return { released: true }; },
    ...override,
  };
  return { adapter, calls };
}
test('recovery claim and persisted re-read do not execute steps', async () => {
  const { adapter, calls } = mocked();
  const restored = await restoreGoalLoop(adapter, opts, 1000000);
  assert.deepEqual(calls, ['claim', 'read']);
  assert.equal(restored.canExecuteTools, false);
  assert.equal(restored.canReleaseOrDeploy, false);
  assert.equal(restored.humanReviewRequired, true);
  assert.equal(restored.nextSteps[0].role, 'verifier');
  assert.equal(restored.lease.leaseEpoch, 5);
});
test('version mismatch fails closed and releases own epoch', async () => {
  const { adapter, calls } = mocked({ async read() { calls.push('read'); return { version: 1, state }; } });
  await assert.rejects(restoreGoalLoop(adapter, opts, 1000000), /factory_restore_failed/);
  assert.deepEqual(calls, ['claim', 'read', 'release']);
});
test('terminal or expired state refuses restore', async () => {
  const { adapter, calls } = mocked({ async read() {
    calls.push('read');
    return { version: 2, state: { ...state, status: 'review_required' } };
  } });
  await assert.rejects(restoreGoalLoop(adapter, opts, 1000000), /factory_restore_failed/);
  assert.deepEqual(calls, ['claim', 'read', 'release']);
  const { adapter: other } = mocked();
  await assert.rejects(restoreGoalLoop(other, opts, 2000000), /factory_restore_failed/);
});
test('unknown next step cannot become an executable instruction', async () => {
  const { adapter, calls } = mocked({ async read() {
    calls.push('read');
    return { version: 2, state: { ...state, nextSteps: [{ role: 'shell', action: 'run_command' }] } };
  } });
  await assert.rejects(restoreGoalLoop(adapter, opts, 1000000), /factory_restore_failed/);
  assert.deepEqual(calls, ['claim', 'read', 'release']);
});
test('database error propagates without declaring successful restore', async () => {
  const { adapter } = mocked({ async claim() { throw Error('claim_denied'); } });
  await assert.rejects(restoreGoalLoop(adapter, opts, 1000000), /claim_denied/);
});
test('release failure cannot turn an invalid checkpoint into success', async () => {
  const { adapter } = mocked({
    async read() { return { version: 999, state }; },
    async release() { throw Error('lost_connection'); },
  });
  await assert.rejects(restoreGoalLoop(adapter, opts, 1000000), /factory_restore_failed/);
});
