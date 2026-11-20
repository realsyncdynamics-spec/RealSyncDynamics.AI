/**
 * SF-005: pure offline Goal & Loop Engine. No AI, shell, network, Git,
 * database, merge, release or deployment. Evidence labels are untrusted.
 */
const ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,79}$/;
const REF = /^(?:evidence|artifact|sha256):[A-Za-z0-9._:/-]{8,160}$/;
const ok = (x, message) => { if (!x) throw Error(message); };
const isObj = x => x !== null && typeof x === 'object' && !Array.isArray(x);
const ident = (x, name) => ok(typeof x === 'string' && ID.test(x), name + '_invalid');
const ref = (x, name) => ok(typeof x === 'string' && REF.test(x), name + '_invalid');
const integer = (x, low, high, name) => ok(Number.isSafeInteger(x) && x >= low && x <= high, name + '_invalid');
function text(x, max, name) {
  ok(typeof x === 'string' && x.trim().length > 0 && !x.includes('\0') &&
    encodeURIComponent(x).replace(/%[0-9A-F]{2}/g, 'x').length <= max, name + '_invalid');
}
function time(s, atMs) {
  integer(atMs, 0, Number.MAX_SAFE_INTEGER, 'clock');
  ok(atMs >= s.startedAtMs && atMs >= s.events.at(-1).atMs, 'clock_regression');
}
function next(status, failures = []) {
  if (status === 'ready') return [{ role: 'builder', action: 'prepare_evidence' }];
  if (status === 'awaiting_verification') return [{ role: 'verifier', action: 'verify_all_criteria' }];
  if (status === 'retry_required') return failures.map(criterionId => ({ role: 'builder', action: 'repair', criterionId }));
  if (status === 'review_required') return [{ role: 'operator', action: 'review_draft' }];
  return [{ role: 'operator', action: 'resolve_blocker' }];
}
function append(s, type, atMs, details = {}) {
  return Object.freeze([...s.events, Object.freeze({
    seq: s.events.length + 1, atMs, type, details: Object.freeze({ ...details }),
  })]);
}
function update(s, status, changes = {}, failures = []) {
  return Object.freeze({
    ...s, ...changes, status, checkpointVersion: s.checkpointVersion + 1,
    nextSteps: Object.freeze(next(status, failures)),
  });
}
export function createGoalLoop(job, goal, limits, runId, atMs) {
  ok(isObj(job) && isObj(goal) && isObj(limits), 'input_invalid');
  ident(runId, 'run_id');
  integer(atMs, 0, Number.MAX_SAFE_INTEGER - 3600000, 'start_time');
  ok(job.status === 'queued' && goal.jobId === job.id &&
     goal.repository === job.repository, 'factory_binding_invalid');
  ok(goal.schemaVersion === 1 && goal.requireHumanReview === true, 'review_required');
  ident(goal.goalId, 'goal_id'); text(goal.statement, 1000, 'statement');
  ok(Array.isArray(goal.criteria) && goal.criteria.length >= 1 && goal.criteria.length <= 12, 'criteria_invalid');
  const seen = new Set();
  const criteria = goal.criteria.map(c => {
    ok(isObj(c), 'criterion_invalid'); ident(c.id, 'criterion_id');
    text(c.description, 500, 'criterion_description');
    ok(!seen.has(c.id), 'criterion_duplicate'); seen.add(c.id);
    return Object.freeze({ id: c.id, description: c.description });
  });
  integer(limits.maxIterations, 1, 5, 'max_iterations');
  integer(limits.maxCostCents, 0, 2000, 'max_cost');
  integer(limits.maxDurationMs, 1000, 3600000, 'max_duration');
  ok(limits.maxIterations <= job.limits?.maxImplementationAttempts &&
    limits.maxCostCents <= job.limits?.maxCostCents, 'factory_limits_exceeded');
  return Object.freeze({
    schemaVersion: 1, runId, status: 'ready',
    goal: Object.freeze({
      schemaVersion: 1, goalId: goal.goalId, jobId: goal.jobId,
      repository: goal.repository, statement: goal.statement,
      requireHumanReview: true, criteria: Object.freeze(criteria),
    }),
    limits: Object.freeze({
      maxIterations: limits.maxIterations, maxCostCents: limits.maxCostCents,
      maxDurationMs: limits.maxDurationMs,
    }),
    startedAtMs: atMs, deadlineAtMs: atMs + limits.maxDurationMs,
    iteration: 0, spentCents: 0, checkpointVersion: 1, submission: null,
    checks: Object.freeze([]), nextSteps: Object.freeze(next('ready')),
    events: Object.freeze([Object.freeze({
      seq: 1, type: 'loop_created', atMs, details: Object.freeze({ jobId: job.id }),
    })]),
  });
}
export function submitLoopEvidence(s, receipt, atMs) {
  ok(isObj(s) && isObj(receipt), 'input_invalid');
  ok(s.status === 'ready', 'not_ready'); time(s, atMs);
  ok(atMs <= s.deadlineAtMs, 'deadline_exceeded');
  ok(s.iteration < s.limits.maxIterations, 'iterations_exceeded');
  ident(receipt.authorId, 'author_id');
  integer(receipt.costCents, 0, 2000, 'cost');
  ok(receipt.costCents <= s.limits.maxCostCents - s.spentCents, 'budget_exceeded');
  ok(Array.isArray(receipt.evidence) &&
    receipt.evidence.length <= s.goal.criteria.length, 'evidence_invalid');
  const allowed = new Set(s.goal.criteria.map(c => c.id)), seen = new Set();
  const evidence = receipt.evidence.map(c => {
    ok(isObj(c), 'evidence_invalid'); ident(c.criterionId, 'criterion_id');
    ref(c.evidenceRef, 'evidence_ref');
    ok(allowed.has(c.criterionId) && !seen.has(c.criterionId), 'evidence_mapping_invalid');
    seen.add(c.criterionId);
    return Object.freeze({ criterionId: c.criterionId, evidenceRef: c.evidenceRef });
  });
  const submission = Object.freeze({
    authorId: receipt.authorId, evidence: Object.freeze(evidence), iteration: s.iteration + 1,
  });
  return update(s, 'awaiting_verification', {
    submission, iteration: submission.iteration, spentCents: s.spentCents + receipt.costCents,
    events: append(s, 'evidence_submitted', atMs, {
      iteration: submission.iteration, costCents: receipt.costCents,
    }),
    checks: Object.freeze([]),
  });
}
export function verifyLoopEvidence(s, report, atMs) {
  ok(isObj(s) && isObj(report), 'input_invalid');
  ok(s.status === 'awaiting_verification', 'not_awaiting_verification'); time(s, atMs);
  ok(atMs <= s.deadlineAtMs, 'deadline_exceeded');
  ident(report.verifierId, 'verifier_id');
  ok(report.verifierId !== s.submission.authorId, 'verifier_not_independent');
  ref(report.attestationRef, 'attestation_ref');
  ok(Array.isArray(report.checks) &&
    report.checks.length === s.goal.criteria.length, 'all_criteria_required');
  const allowed = new Set(s.goal.criteria.map(c => c.id));
  const submitted = new Set(s.submission.evidence.map(c => c.criterionId)), seen = new Set();
  const checks = report.checks.map(c => {
    ok(isObj(c), 'check_invalid'); ident(c.criterionId, 'criterion_id');
    ref(c.evidenceRef, 'check_ref');
    ok(typeof c.passed === 'boolean', 'check_boolean_required');
    ok(allowed.has(c.criterionId) && !seen.has(c.criterionId), 'check_mapping_invalid');
    seen.add(c.criterionId);
    return Object.freeze({
      criterionId: c.criterionId, evidenceRef: c.evidenceRef,
      passed: c.passed && submitted.has(c.criterionId),
    });
  });
  const failed = checks.filter(c => !c.passed).map(c => c.criterionId);
  const retry = s.iteration < s.limits.maxIterations &&
    s.spentCents < s.limits.maxCostCents && atMs < s.deadlineAtMs;
  const status = failed.length === 0 ? 'review_required' : retry ? 'retry_required' : 'blocked';
  return update(s, status, {
    checks: Object.freeze(checks),
    events: append(s, 'verification_completed', atMs, {
      verifierId: report.verifierId, attestationRef: report.attestationRef,
      failed: Object.freeze(failed), status,
    }),
  }, failed);
}
export function beginLoopRetry(s, atMs) {
  ok(isObj(s) && s.status === 'retry_required', 'retry_not_allowed'); time(s, atMs);
  ok(s.iteration < s.limits.maxIterations && s.spentCents < s.limits.maxCostCents &&
    atMs < s.deadlineAtMs, 'retry_limit_exceeded');
  return update(s, 'ready', {
    events: append(s, 'retry_started', atMs, { iteration: s.iteration }),
  });
}
export function stopGoalLoop(s, reason, atMs) {
  ok(isObj(s), 'loop_invalid'); time(s, atMs);
  ok(['deadline_exceeded', 'operator_cancelled', 'policy_revoked',
    'persistence_unavailable'].includes(reason), 'stop_reason_invalid');
  ok(!['review_required', 'blocked'].includes(s.status), 'already_terminal');
  if (reason === 'deadline_exceeded') ok(atMs > s.deadlineAtMs, 'deadline_not_reached');
  return update(s, 'blocked', { events: append(s, 'loop_stopped', atMs, { reason }) });
}
export function createNextStepsDocument(s) {
  ok(isObj(s), 'loop_invalid');
  return {
    schemaVersion: 1, runId: s.runId, goalId: s.goal.goalId, jobId: s.goal.jobId,
    repository: s.goal.repository, status: s.status,
    checkpointVersion: s.checkpointVersion, iteration: s.iteration,
    maxIterations: s.limits.maxIterations, spentCents: s.spentCents,
    maxCostCents: s.limits.maxCostCents, deadlineAtMs: s.deadlineAtMs,
    humanReviewRequired: true, canReleaseOrDeploy: false,
    nextSteps: s.nextSteps.map(x => ({ ...x })),
  };
}
