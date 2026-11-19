import type { FactoryAction, FactoryDecision, FactoryJob, TrustedActor } from './contracts';

/** Initial pilot restricted to RealSync's own repository. */
export const ALLOWED_REPOSITORIES = ['realsyncdynamics-spec/RealSyncDynamics.AI'] as const;
const ALWAYS_DENIED = new Set<FactoryAction>([
  'github.pr.merge', 'production.deploy', 'database.migrate', 'secrets.modify',
]);
const WORKER_ACTIONS = new Set<FactoryAction>([
  'repository.read', 'sandbox.branch.write', 'sandbox.tests.run', 'github.pr.prepare',
]);
const OPERATOR_ACTIONS = new Set<FactoryAction>([
  'repository.read', 'specification.write', 'job.queue',
]);

/**
 * Deterministic fail-closed policy preview, NOT an execution policy.
 * A future service MUST verify actor identity, job/branch binding,
 * budget reservations and permissions at the actual execution boundary.
 */
export function authorizeFactoryAction(
  actor: TrustedActor,
  job: FactoryJob,
  action: FactoryAction,
): FactoryDecision {
  if (!ALLOWED_REPOSITORIES.some((repo) => repo === job.repository)) {
    return { allow: false, reason: 'repository_not_allowlisted' };
  }
  if (ALWAYS_DENIED.has(action)) return { allow: false, reason: 'separate_release_required' };
  if (!actor.id.trim()) return { allow: false, reason: 'actor_missing' };
  if (![job.budget.maxCostEur, job.budget.spentCostEur,
         job.budget.maxAttempts, job.budget.attempts].every(Number.isFinite) ||
      !Number.isInteger(job.budget.maxAttempts) || !Number.isInteger(job.budget.attempts) ||
      job.budget.maxCostEur < 0 || job.budget.spentCostEur < 0 ||
      job.budget.maxAttempts < 1 || job.budget.attempts < 0) {
    return { allow: false, reason: 'invalid_budget' };
  }
  if (job.budget.spentCostEur >= job.budget.maxCostEur &&
      (action === 'job.queue' || action === 'sandbox.branch.write' || action === 'sandbox.tests.run')) {
    return { allow: false, reason: 'cost_budget_exhausted' };
  }
  if (job.budget.attempts >= job.budget.maxAttempts &&
      action === 'sandbox.branch.write') {
    return { allow: false, reason: 'attempt_budget_exhausted' };
  }
  if (actor.kind === 'operator') {
    if (!actor.isOperator) return { allow: false, reason: 'not_operator' };
    if (!OPERATOR_ACTIONS.has(action)) return { allow: false, reason: 'operation_not_allowed_for_operator' };
    if (action !== 'repository.read' && actor.aal !== 'aal2') {
      return { allow: false, reason: 'mfa_required' };
    }
    if (action === 'job.queue' && (!job.scopeApproved || !['specified', 'paused'].includes(job.status))) {
      return { allow: false, reason: 'scope_or_status_not_ready' };
    }
    return { allow: true };
  }
  if (actor.kind !== 'worker' || actor.isOperator || actor.aal !== null) {
    return { allow: false, reason: 'invalid_worker_identity' };
  }
  if (!WORKER_ACTIONS.has(action)) return { allow: false, reason: 'operation_not_allowed_for_worker' };
  if (!job.scopeApproved || !['queued', 'running', 'validating'].includes(job.status)) {
    return { allow: false, reason: 'worker_job_not_authorized' };
  }
  if (!/^sf-[a-z0-9-]+$/.test(job.branch) || job.branch === 'main') {
    return { allow: false, reason: 'invalid_branch' };
  }
  return { allow: true };
}
