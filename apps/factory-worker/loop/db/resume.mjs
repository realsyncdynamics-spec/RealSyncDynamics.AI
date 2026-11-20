/**
 * SF-005: fail-closed RESTORE PLANNER ONLY.
 * Claims a fenced checkpoint, re-reads durable state, and returns metadata.
 * Does not execute next steps or authorize AI, shell, Git, merge or deploy.
 */
const VALID = Object.freeze({
  ready: ['builder:prepare_evidence'],
  awaiting_verification: ['verifier:verify_all_criteria'],
  retry_required: ['builder:repair'],
});
function die(message) { throw Error('factory_restore_' + message); }
function checkStep(step, status) {
  const allowed = VALID[status];
  if (!step || typeof step !== 'object' ||
      !allowed.includes(step.role + ':' + step.action)) die('invalid_next_step');
  if (status === 'retry_required' &&
      (typeof step.criterionId !== 'string' || !/^[A-Za-z0-9._:-]{1,80}$/.test(step.criterionId))) {
    die('invalid_next_step');
  }
  return Object.freeze({
    role: step.role, action: step.action,
    ...(status === 'retry_required' ? { criterionId: step.criterionId } : {}),
  });
}
export async function restoreGoalLoop(adapter, opts, atMs) {
  if (!adapter || typeof adapter.claim !== 'function' ||
      typeof adapter.read !== 'function' || typeof adapter.release !== 'function') {
    die('adapter_required');
  }
  if (!opts || typeof opts.taskId !== 'string' || typeof opts.tenantId !== 'string' ||
      typeof opts.workerId !== 'string') die('identity_invalid');
  if (!Number.isSafeInteger(atMs) || atMs < 0) die('clock_invalid');
  // Database claim verifies the tenant, task status, deadline and lease.
  const lease = await adapter.claim(opts);
  try {
    const record = await adapter.read({ taskId: opts.taskId, tenantId: opts.tenantId });
    const state = record?.state;
    if (!state || typeof state !== 'object' || !Object.hasOwn(VALID, state.status) ||
        state.goal?.jobId !== opts.taskId ||
        record.version !== lease.version || state.checkpointVersion !== lease.version ||
        state.goal?.requireHumanReview !== true ||
        !Number.isSafeInteger(state.deadlineAtMs) || atMs >= state.deadlineAtMs ||
        !Array.isArray(state.nextSteps) || state.nextSteps.length < 1 ||
        state.nextSteps.length > 12 ||
        !Number.isSafeInteger(state.iteration) || state.iteration < 0 ||
        !Number.isSafeInteger(state.limits?.maxIterations) ||
        state.iteration > state.limits.maxIterations ||
        !Number.isSafeInteger(state.spentCents) ||
        state.spentCents < 0 || state.spentCents > state.limits?.maxCostCents) {
      die('checkpoint_invalid');
    }
    const nextSteps = Object.freeze(state.nextSteps.map(x => checkStep(x, state.status)));
    return Object.freeze({
      runId: state.runId, goalId: state.goal.goalId,
      taskId: opts.taskId, tenantId: opts.tenantId,
      status: state.status, checkpointVersion: record.version,
      iteration: state.iteration, spentCents: state.spentCents,
      nextSteps, lease: Object.freeze({ ...lease }),
      humanReviewRequired: true, canExecuteTools: false, canReleaseOrDeploy: false,
    });
  } catch {
    // Release only this worker's current fencing epoch. If the release fails,
    // the lease expires at its SQL deadline; never claim a successful restore.
    await adapter.release({
      taskId: opts.taskId, tenantId: opts.tenantId,
      workerId: opts.workerId, leaseEpoch: lease.leaseEpoch,
    }).catch(() => {});
    die('failed');
  }
}
