import type {
  CreateFactoryJobInput,
  FactoryJob,
  FactoryJobStatus,
  FactoryTransitionContext,
} from './contracts.ts';

const allowedTransitions: Readonly<Record<FactoryJobStatus, readonly FactoryJobStatus[]>> = {
  queued: ['analyzing', 'cancelled', 'failed'],
  analyzing: ['planning', 'blocked', 'failed', 'cancelled'],
  planning: ['implementing', 'blocked', 'failed', 'cancelled'],
  implementing: ['validating', 'blocked', 'failed', 'cancelled'],
  validating: ['draft_pr_ready', 'implementing', 'blocked', 'failed', 'cancelled'],
  blocked: ['queued', 'cancelled'],
  draft_pr_ready: [],
  failed: [],
  cancelled: [],
};

function requireNonblank(value: string, label: string): void {
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(`${label} must be nonblank`);
  }
}

function requireNonnegativeInteger(value: number, label: string): void {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new Error(`${label} must be a nonnegative safe integer`);
  }
}

/** Create a deterministic local job record; this does not enqueue execution. */
export function createFactoryJob(input: CreateFactoryJobInput): FactoryJob {
  requireNonblank(input.id, 'id');
  requireNonblank(input.repository, 'repository');
  requireNonblank(input.baseRef, 'baseRef');
  requireNonblank(input.specificationRef, 'specificationRef');
  if (!/^[^/\s]+\/[^/\s]+$/.test(input.repository)) {
    throw new Error('repository must have owner/name format');
  }
  requireNonnegativeInteger(input.limits.maxCostCents, 'maxCostCents');
  requireNonnegativeInteger(input.limits.maxImplementationAttempts, 'maxImplementationAttempts');
  if (input.limits.maxImplementationAttempts === 0) {
    throw new Error('maxImplementationAttempts must be positive');
  }

  return {
    id: input.id,
    repository: input.repository,
    baseRef: input.baseRef,
    specificationRef: input.specificationRef,
    status: 'queued',
    limits: { ...input.limits },
    spentCents: 0,
    implementationAttempts: 0,
    events: [],
  };
}

/**
 * Pure lifecycle validation, NOT a security boundary.
 * A future server-side policy decision must authorize every tool execution.
 * No production, merge, migration or deploy state/action is defined here.
 */
export function transitionFactoryJob(
  job: FactoryJob,
  to: FactoryJobStatus,
  context: FactoryTransitionContext,
): FactoryJob {
  requireNonblank(context.evidenceRef, 'evidenceRef');
  if (context.actorKind !== 'operator' && context.actorKind !== 'worker') {
    throw new Error('unsupported actorKind');
  }
  if (!allowedTransitions[job.status].includes(to)) {
    throw new Error(`invalid factory transition: ${job.status} -> ${to}`);
  }
  const implementationAttempts = job.implementationAttempts + Number(to === 'implementing');
  if (implementationAttempts > job.limits.maxImplementationAttempts) {
    throw new Error('implementation attempt limit reached');
  }
  return {
    ...job,
    status: to,
    implementationAttempts,
    events: [...job.events, {
      from: job.status,
      to,
      actorKind: context.actorKind,
      evidenceRef: context.evidenceRef,
    }],
  };
}

/** Account for execution spend without ever mutating the input job. */
export function addFactoryCost(job: FactoryJob, additionalCents: number): FactoryJob {
  requireNonnegativeInteger(additionalCents, 'additionalCents');
  if (additionalCents > job.limits.maxCostCents - job.spentCents) {
    throw new Error('factory cost budget exceeded');
  }
  return { ...job, spentCents: job.spentCents + additionalCents };
}

/** A deterministic demonstration; no code is generated, no PR is created. */
export function simulateFactoryJob(input: CreateFactoryJobInput): FactoryJob {
  let job = createFactoryJob(input);
  const stages: FactoryJobStatus[] = [
    'analyzing', 'planning', 'implementing', 'validating', 'draft_pr_ready',
  ];
  for (const stage of stages) {
    job = transitionFactoryJob(job, stage, {
      actorKind: 'worker',
      evidenceRef: `simulation:${input.id}:${stage}`,
    });
  }
  return job;
}
