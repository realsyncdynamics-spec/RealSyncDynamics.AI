import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createGoalLoop, submitLoopEvidence, verifyLoopEvidence,
  beginLoopRetry, stopGoalLoop, createNextStepsDocument,
} from '../engine.mjs';

const job = {
  id: 'job_1', status: 'queued',
  repository: 'realsyncdynamics-spec/RealSyncDynamics.AI',
  limits: { maxCostCents: 500, maxImplementationAttempts: 3 },
};
const goal = {
  schemaVersion: 1, goalId: 'goal_1', jobId: job.id,
  repository: job.repository, statement: 'Prepare reviewed patch',
  requireHumanReview: true,
  criteria: [
    { id: 'build', description: 'Build passes' },
    { id: 'security', description: 'Security checks pass' },
  ],
};
const limits = { maxIterations: 3, maxCostCents: 500, maxDurationMs: 20000 };
const evidence = [
  { criterionId: 'build', evidenceRef: 'artifact:build_001' },
  { criterionId: 'security', evidenceRef: 'artifact:security_001' },
];
const checks = [
  { criterionId: 'build', passed: true, evidenceRef: 'artifact:build_review_01' },
  { criterionId: 'security', passed: true, evidenceRef: 'artifact:security_review_01' },
];
const fresh = () => createGoalLoop(job, goal, limits, 'run_01', 1000);
const submit = (state, atMs = 1100, rows = evidence, costCents = 100, authorId = 'builder_01') =>
  submitLoopEvidence(state, { authorId, costCents, evidence: rows }, atMs);
const verify = (state, atMs = 1200, rows = checks, verifierId = 'verifier_01') =>
  verifyLoopEvidence(state, { verifierId, attestationRef: 'artifact:attestation_01', checks: rows }, atMs);

test('all criteria passed require a human review and cannot release', () => {
  const s = verify(submit(fresh()));
  assert.equal(s.status, 'review_required');
  const d = createNextStepsDocument(s);
  assert.equal(d.humanReviewRequired, true);
  assert.equal(d.canReleaseOrDeploy, false);
  assert.equal(d.nextSteps[0].role, 'operator');
  assert.throws(() => beginLoopRetry(s, 1300), /retry_not_allowed/);
});
test('independent reviewer identity differs from author', () => {
  assert.throws(() => verify(submit(fresh()), 1200, checks, 'builder_01'), /verifier_not_independent/);
});
test('no evidence cannot be falsely verified', () => {
  const s = verify(submit(fresh(), 1100, [evidence[0]]));
  assert.equal(s.status, 'retry_required');
  assert.deepEqual(s.nextSteps.map(x => x.criterionId), ['security']);
});
test('failed criterion gets targeted followup', () => {
  const s = verify(submit(fresh()), 1200, [{ ...checks[0], passed: false }, checks[1]]);
  assert.equal(s.status, 'retry_required');
  assert.equal(s.nextSteps[0].criterionId, 'build');
});
test('three failed attempts terminate and preserve evidence events', () => {
  const failed = [{ ...checks[0], passed: false }, checks[1]];
  let s = fresh();
  s = verify(submit(s, 1100), 1200, failed);
  s = beginLoopRetry(s, 1300);
  s = verify(submit(s, 1400), 1500, failed);
  s = beginLoopRetry(s, 1600);
  s = verify(submit(s, 1700), 1800, failed);
  assert.equal(s.status, 'blocked');
  assert.equal(s.iteration, 3);
  assert.equal(s.events.length, 9);
});
test('cost budget is binding and updates are immutable', () => {
  const s = fresh();
  assert.throws(() => submit(s, 1100, evidence, 501), /budget_exceeded/);
  const charged = submit(s, 1100, evidence, 200);
  assert.equal(s.spentCents, 0);
  assert.equal(charged.spentCents, 200);
  assert.equal(s.status, 'ready');
  assert.equal(Object.isFrozen(s), true);
});
test('deadline prevents evidence and allows explicit stop', () => {
  const s = fresh();
  assert.throws(() => submit(s, 25000), /deadline_exceeded/);
  assert.throws(() => stopGoalLoop(s, 'deadline_exceeded', 20000), /deadline_not_reached/);
  assert.equal(stopGoalLoop(s, 'deadline_exceeded', 25000).status, 'blocked');
});
test('factory binding and stricter factory budget are enforced', () => {
  assert.throws(() => createGoalLoop(job, { ...goal, jobId: 'other' }, limits, 'run_01', 1000), /factory_binding/);
  assert.throws(() => createGoalLoop(job, goal, { ...limits, maxCostCents: 501 }, 'run_01', 1000), /factory_limits/);
  assert.throws(() => createGoalLoop(job, goal, { ...limits, maxIterations: 4 }, 'run_01', 1000), /factory_limits/);
});
test('manual review is mandatory and acceptance criteria are unique', () => {
  assert.throws(() => createGoalLoop(job, { ...goal, requireHumanReview: false }, limits, 'run_01', 1000), /review_required/);
  assert.throws(() => createGoalLoop(job, { ...goal, criteria: [goal.criteria[0], goal.criteria[0]] }, limits, 'run_01', 1000), /criterion_duplicate/);
});
test('invalid evidence and duplicate evidence fail', () => {
  const s = fresh();
  assert.throws(() => submit(s, 1100, [{ criterionId: 'build', evidenceRef: '../secret' }]), /evidence_ref/);
  assert.throws(() => submit(s, 1100, [evidence[0], evidence[0]]), /evidence_mapping/);
  assert.equal(s.iteration, 0);
});
test('verifier must explicitly review each criterion', () => {
  assert.throws(() => verify(submit(fresh()), 1200, [checks[0]]), /all_criteria/);
  assert.throws(() => verify(submit(fresh()), 1200, [checks[0], checks[0]]), /check_mapping/);
});
test('timestamps cannot move backwards', () => {
  assert.throws(() => submit(fresh(), 999), /clock_regression/);
  const s = verify(submit(fresh()), 1200, [{ ...checks[0], passed: false }, checks[1]]);
  assert.throws(() => beginLoopRetry(s, 1100), /clock_regression/);
});
test('fail closed on missing persistence and revoked policy', () => {
  assert.equal(stopGoalLoop(fresh(), 'persistence_unavailable', 1300).status, 'blocked');
  assert.equal(stopGoalLoop(fresh(), 'policy_revoked', 1300).events.at(-1).details.reason, 'policy_revoked');
});
test('NEXT_STEPS is data and never grants execution', () => {
  const d = createNextStepsDocument(submit(fresh()));
  assert.equal(d.status, 'awaiting_verification');
  assert.equal(d.nextSteps[0].role, 'verifier');
  assert.equal(d.canReleaseOrDeploy, false);
  assert.equal(d.maxCostCents, 500);
});
