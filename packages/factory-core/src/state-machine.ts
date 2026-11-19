import type { FactoryJob, FactoryStatus, TrustedActor, ValidationEvidence } from './contracts';
import { authorizeFactoryAction } from './policy';

const TRANSITIONS: Readonly<Record<FactoryStatus, readonly FactoryStatus[]>> = {
  draft: ['specified', 'canceled'],
  specified: ['queued', 'canceled'],
  queued: ['running', 'paused', 'canceled'],
  paused: ['queued', 'canceled'],
  running: ['validating', 'paused', 'failed', 'canceled'],
  validating: ['running', 'paused', 'pr_ready', 'failed', 'canceled'],
  pr_ready: [],
  failed: [],
  canceled: [],
};

export class FactoryTransitionError extends Error {
  constructor(readonly code: string) { super(code); this.name = 'FactoryTransitionError'; }
}

export interface TransitionCommand {
  readonly to: FactoryStatus;
  readonly actor: TrustedActor;
  readonly expectedVersion: number;
  readonly at: string;
  readonly note: string;
  readonly evidence?: ValidationEvidence;
}

/**
 * Immutable, deterministic in-memory transitions. This is NOT durable auditing,
 * identity verification, physical worker cancellation or a release gate.
 * Future service MUST persist event and state atomically with version locking.
 */
export function transitionFactoryJob(job: FactoryJob, cmd: TransitionCommand): FactoryJob {
  if (cmd.expectedVersion !== job.version) throw new FactoryTransitionError('version_conflict');
  if (!TRANSITIONS[job.status].includes(cmd.to)) throw new FactoryTransitionError('invalid_transition');
  if (!cmd.actor.id.trim()) throw new FactoryTransitionError('actor_missing');
  if (!cmd.note.trim() || !Number.isFinite(Date.parse(cmd.at))) {
    throw new FactoryTransitionError('event_metadata_required');
  }
  const operatorOnly = cmd.to === 'specified' || cmd.to === 'queued'
    || cmd.to === 'paused' || cmd.to === 'canceled';
  if (operatorOnly) {
    if (cmd.actor.kind !== 'operator' || !cmd.actor.isOperator || cmd.actor.aal !== 'aal2') {
      throw new FactoryTransitionError('operator_aal2_required');
    }
  } else if (cmd.actor.kind !== 'worker' || cmd.actor.isOperator || cmd.actor.aal !== null) {
    throw new FactoryTransitionError('worker_identity_required');
  }
  if (cmd.to === 'queued') {
    const d = authorizeFactoryAction(cmd.actor, job, 'job.queue');
    if (!d.allow) throw new FactoryTransitionError(d.reason);
  }
  if (cmd.actor.kind === 'worker') {
    const a = cmd.to === 'running' ? 'sandbox.branch.write'
      : cmd.to === 'pr_ready' ? 'github.pr.prepare'
      : cmd.to === 'failed' ? 'repository.read' : 'sandbox.tests.run';
    const d = authorizeFactoryAction(cmd.actor, job, a);
    if (!d.allow) throw new FactoryTransitionError(d.reason);
  }
  if (cmd.to === 'running' && job.budget.attempts >= job.budget.maxAttempts) {
    throw new FactoryTransitionError('attempt_budget_exhausted');
  }
  if (cmd.to === 'pr_ready') {
    const e = cmd.evidence;
    if (!e || e.typecheck !== 'passed' || e.tests !== 'passed' || e.security !== 'passed' ||
        e.evidenceIds.length === 0 || !e.evidenceIds.every((id) => Boolean(id.trim())) ||
        !/^https:\/\/github\.com\/realsyncdynamics-spec\/RealSyncDynamics\.AI\/pull\/[1-9]\d*$/.test(e.prUrl)) {
      throw new FactoryTransitionError('validation_evidence_required');
    }
  }
  return {
    ...job,
    version: job.version + 1,
    budget: {
      ...job.budget,
      attempts: cmd.to === 'running' ? job.budget.attempts + 1 : job.budget.attempts,
    },
    status: cmd.to,
    history: [...job.history, {
      sequence: job.version + 1,
      jobId: job.id,
      from: job.status,
      to: cmd.to,
      actorId: cmd.actor.id,
      at: cmd.at,
      note: cmd.note,
    }],
  };
}
