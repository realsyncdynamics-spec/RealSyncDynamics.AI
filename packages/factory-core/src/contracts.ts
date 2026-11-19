/** SF-001: pure contracts. No database, network or production side effects. */
export type FactoryJobStatus =
  | 'queued'
  | 'analyzing'
  | 'planning'
  | 'implementing'
  | 'validating'
  | 'blocked'
  | 'draft_pr_ready'
  | 'failed'
  | 'cancelled';

export type FactoryActorKind = 'worker' | 'operator';

export interface FactoryLimits {
  readonly maxCostCents: number;
  /** Maximum total entry attempts into the implementing state. */
  readonly maxImplementationAttempts: number;
}

export interface FactoryEvent {
  readonly from: FactoryJobStatus | null;
  readonly to: FactoryJobStatus;
  readonly actorKind: FactoryActorKind;
  /** Reference to a separately stored, redacted evidence artifact. */
  readonly evidenceRef: string;
}

export interface FactoryJob {
  readonly id: string;
  readonly repository: string;
  readonly baseRef: string;
  readonly specificationRef: string;
  readonly status: FactoryJobStatus;
  readonly limits: FactoryLimits;
  readonly spentCents: number;
  readonly implementationAttempts: number;
  readonly events: readonly FactoryEvent[];
}

export interface CreateFactoryJobInput {
  readonly id: string;
  readonly repository: string;
  readonly baseRef: string;
  readonly specificationRef: string;
  readonly limits: FactoryLimits;
}

/** These are trace labels, NOT an identity or authorization decision. */
export interface FactoryTransitionContext {
  readonly actorKind: FactoryActorKind;
  readonly evidenceRef: string;
}
