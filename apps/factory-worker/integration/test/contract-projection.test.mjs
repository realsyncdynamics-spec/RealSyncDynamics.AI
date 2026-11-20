/** SF-007: synthetic compatibility tests; no GitHub, providers, DB or execution. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { projectFactoryContractStatus } from '../contract-projection.mjs';

const commitSha = 'a'.repeat(40);
function sample() {
  return {
    correlation: {
      jobId: 'sf007_fixture', scopeId: 'factory_internal',
      repository: 'realsyncdynamics-spec/RealSyncDynamics.AI', commitSha,
    },
    ai: { jobId: 'sf007_fixture', scopeId: 'factory_internal', state: 'draft', version: 0 },
    worker: {
      jobId: 'sf007_fixture', repository: 'realsyncdynamics-spec/RealSyncDynamics.AI',
      commitSha, status: 'queued',
    },
  };
}
function projection(aiState, workerStatus, version = 1) {
  const s = sample();
  s.ai.state = aiState;
  s.ai.version = version;
  s.worker.status = workerStatus;
  return projectFactoryContractStatus(s);
}

test('intake is visible but never executable', () => {
  const p = projectFactoryContractStatus(sample());
  assert.equal(p.phase, 'intake');
  assert.equal(p.schemaVersion, 1);
  assert.equal(p.kind, 'read_only_contract_projection');
  assert.deepEqual(Object.values(p.authority), [false, false, false, false, false, false]);
  assert.equal(Object.isFrozen(p.authority), true);
  assert.equal(Object.isFrozen(p.correlation), true);
});
test('planning does not imply sandbox authorization', () => {
  assert.equal(projection('specified', 'planning').phase, 'planning');
});
test('AI-OS sandbox approval label is not a grant', () => {
  const p = projection('approved_for_sandbox', 'queued');
  assert.equal(p.phase, 'approval_unverified');
  assert.equal(p.authority.canExecute, false);
});
test('implementing and running remain unverified', () => {
  const p = projection('running', 'implementing');
  assert.equal(p.phase, 'execution_unverified');
  assert.equal(p.authority.canSpend, false);
});
test('validating and testing are not evidence of passing tests', () => {
  const p = projection('testing', 'validating');
  assert.equal(p.phase, 'validation_unverified');
  assert.equal(p.authority.canVerifyTests, false);
});
test('draft PR status and AI review cannot release', () => {
  const p = projection('review_required', 'draft_pr_ready');
  assert.equal(p.phase, 'human_review_pending');
  assert.equal(p.authority.canCreatePullRequest, false);
  assert.equal(p.authority.canMerge, false);
  assert.equal(p.authority.canDeploy, false);
});
test('legacy completed is not production-complete', () => {
  const p = projection('completed', 'draft_pr_ready');
  assert.equal(p.phase, 'legacy_completion_unverified');
  assert.equal(p.authority.canDeploy, false);
});
test('consistent failed state blocks', () => {
  assert.equal(projection('failed', 'failed').phase, 'blocked');
});
test('active worker contradicting terminal AI state triggers investigation', () => {
  assert.equal(projection('cancelled', 'implementing').phase, 'inconsistent_snapshots');
});
test('completed AI state cannot coexist with active worker status', () => {
  assert.equal(projection('completed', 'validating').phase, 'inconsistent_snapshots');
});
test('invalid status is not normalized optimistically', () => {
  assert.throws(() => projection('approved_production', 'queued'), /sf007_invalid_snapshot/);
  assert.throws(() => projection('draft', 'deployed'), /sf007_invalid_snapshot/);
});
test('cross-job identity and cross-scope collisions are rejected', () => {
  const x = sample(); x.ai.jobId = 'other';
  assert.throws(() => projectFactoryContractStatus(x), /sf007_identity_mismatch/);
  const y = sample(); y.ai.scopeId = 'customer_tenant';
  assert.throws(() => projectFactoryContractStatus(y), /sf007_identity_mismatch/);
});
test('other repo or commit cannot be silently correlated', () => {
  const x = sample(); x.worker.repository = 'other/repo';
  assert.throws(() => projectFactoryContractStatus(x), /sf007_identity_mismatch/);
  const y = sample(); y.worker.commitSha = 'b'.repeat(40);
  assert.throws(() => projectFactoryContractStatus(y), /sf007_identity_mismatch/);
});
test('unpinned branch or malformed commit denied', () => {
  const x = sample(); x.correlation.commitSha = 'main';
  assert.throws(() => projectFactoryContractStatus(x), /sf007_invalid_correlation/);
  const y = sample(); y.correlation.repository = 'https://evil.test/repo';
  assert.throws(() => projectFactoryContractStatus(y), /sf007_invalid_correlation/);
});
test('negative, fractional or unsafe event versions are denied', () => {
  for (const version of [-1, 1.5, Number.MAX_SAFE_INTEGER + 1]) {
    const x = sample(); x.ai.version = version;
    assert.throws(() => projectFactoryContractStatus(x), /sf007_invalid_snapshot/);
  }
});
test('client-injected approvals and deploy flags denied before projection', () => {
  const x = sample(); x.ai.isOperator = true;
  assert.throws(() => projectFactoryContractStatus(x), /sf007_ai_schema_denied/);
  const y = sample(); y.worker.deploy = true;
  assert.throws(() => projectFactoryContractStatus(y), /sf007_worker_schema_denied/);
  const z = sample(); z.productionApproved = true;
  assert.throws(() => projectFactoryContractStatus(z), /sf007_input_schema_denied/);
});
test('prototype-influenced snapshots denied', () => {
  const x = sample(); x.ai = Object.create({ state: 'completed' });
  assert.throws(() => projectFactoryContractStatus(x), /sf007_ai_schema_denied/);
});
test('all outputs explicitly require trusted independent evidence', () => {
  for (const aiState of ['draft', 'specified', 'approved_for_sandbox', 'running',
    'testing', 'review_required', 'completed', 'blocked', 'failed', 'cancelled']) {
    const p = projection(aiState, 'draft_pr_ready');
    assert.equal(p.requiredVerification.length, 6);
    assert.equal(Object.values(p.authority).every(v => v === false), true);
  }
});
