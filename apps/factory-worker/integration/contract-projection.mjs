/**
 * SF-007: DISPLAY-ONLY bridge for two divergent, simulation-only Factory contracts.
 *
 * This adapter cannot authorize a worker, attest a database commit, merge a PR,
 * verify a test or release code. Inputs are UNTRUSTED snapshots. Do not use
 * the returned phase as an execution or deployment gate.
 */
const AI_STATES = new Set([
  'draft', 'specified', 'approved_for_sandbox', 'running', 'testing',
  'review_required', 'completed', 'blocked', 'failed', 'cancelled',
]);
const WORKER_STATES = new Set([
  'queued', 'analyzing', 'planning', 'implementing', 'validating',
  'blocked', 'draft_pr_ready', 'failed', 'cancelled',
]);
const CORRELATION_KEYS = ['jobId', 'scopeId', 'repository', 'commitSha'];
const AI_KEYS = ['jobId', 'scopeId', 'state', 'version'];
const WORKER_KEYS = ['jobId', 'repository', 'commitSha', 'status'];
const ID = /^[A-Za-z0-9_-]{1,80}$/;
const REPO = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/;
const SHA40 = /^[0-9a-f]{40}$/;
const own = (o, k) => Object.prototype.hasOwnProperty.call(o, k);

function plainObject(o) {
  return o !== null && typeof o === 'object' && !Array.isArray(o) &&
    (Object.getPrototypeOf(o) === Object.prototype || Object.getPrototypeOf(o) === null);
}
function exactShape(o, fields) {
  return plainObject(o) && Object.keys(o).length === fields.length &&
    fields.every(k => own(o, k));
}
function ensureShape(value, fields, reason) {
  if (!exactShape(value, fields)) throw new Error(reason);
}
function has(x, values) {
  return values.includes(x);
}

/**
 * Strictly correlate two independently supplied snapshots for human triage.
 * All authority is deliberately denied, including when both sources claim
 * a successful or approved state. Never substitute for signed evidence.
 */
export function projectFactoryContractStatus(input) {
  ensureShape(input, ['correlation', 'ai', 'worker'], 'sf007_input_schema_denied');
  const { correlation, ai, worker } = input;
  ensureShape(correlation, CORRELATION_KEYS, 'sf007_correlation_schema_denied');
  ensureShape(ai, AI_KEYS, 'sf007_ai_schema_denied');
  ensureShape(worker, WORKER_KEYS, 'sf007_worker_schema_denied');

  const { jobId, scopeId, repository, commitSha } = correlation;
  if (typeof jobId !== 'string' || !ID.test(jobId) ||
      typeof scopeId !== 'string' || !ID.test(scopeId) ||
      typeof repository !== 'string' || !REPO.test(repository) ||
      typeof commitSha !== 'string' || !SHA40.test(commitSha)) {
    throw new Error('sf007_invalid_correlation');
  }
  if (ai.jobId !== jobId || ai.scopeId !== scopeId ||
      worker.jobId !== jobId || worker.repository !== repository ||
      worker.commitSha !== commitSha) {
    throw new Error('sf007_identity_mismatch');
  }
  if (!AI_STATES.has(ai.state) || !WORKER_STATES.has(worker.status) ||
      !Number.isSafeInteger(ai.version) || ai.version < 0) {
    throw new Error('sf007_invalid_snapshot');
  }

  const aiFailed = has(ai.state, ['failed', 'cancelled', 'blocked']);
  const workerFailed = has(worker.status, ['failed', 'cancelled', 'blocked']);
  const workerActive = has(worker.status, ['analyzing', 'planning', 'implementing', 'validating']);
  const aiCompleted = ai.state === 'completed';
  const contradictory =
    (aiFailed && workerActive) ||
    (aiCompleted && worker.status !== 'draft_pr_ready') ||
    (ai.state === 'draft' && has(worker.status, ['implementing', 'validating', 'draft_pr_ready'])) ||
    (workerFailed && has(ai.state, ['running', 'testing', 'review_required', 'completed']));

  let phase;
  if (contradictory) phase = 'inconsistent_snapshots';
  else if (aiFailed || workerFailed) phase = 'blocked';
  else if (aiCompleted) phase = 'legacy_completion_unverified';
  else if (ai.state === 'review_required' || worker.status === 'draft_pr_ready') phase = 'human_review_pending';
  else if (ai.state === 'testing' || worker.status === 'validating') phase = 'validation_unverified';
  else if (ai.state === 'running' || worker.status === 'implementing') phase = 'execution_unverified';
  else if (ai.state === 'approved_for_sandbox') phase = 'approval_unverified';
  else if (ai.state === 'specified' || has(worker.status, ['analyzing', 'planning'])) phase = 'planning';
  else phase = 'intake';

  return Object.freeze({
    schemaVersion: 1,
    kind: 'read_only_contract_projection',
    phase,
    correlation: Object.freeze({ jobId, scopeId, repository, commitSha }),
    observed: Object.freeze({ aiState: ai.state, aiVersion: ai.version, workerStatus: worker.status }),
    authority: Object.freeze({
      canExecute: false,
      canVerifyTests: false,
      canCreatePullRequest: false,
      canMerge: false,
      canDeploy: false,
      canSpend: false,
    }),
    requiredVerification: Object.freeze([
      'server_identity_and_scope',
      'trusted_checkout_attestation',
      'transactional_job_event_receipt_outbox',
      'durable_lease_and_fencing',
      'independent_test_evidence',
      'human_release_review',
    ]),
  });
}
