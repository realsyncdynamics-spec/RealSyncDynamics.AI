/**
 * SF-001: Contracts for RealSync's internal Software Factory.
 * Pure data types: NO DB access, network, API secrets, execution or tenant data.
 * TrustedActor must be constructed only after server/worker authentication.
 * These types are NOT an execution authorization boundary.
 */
export const FACTORY_STATUSES = [
  'draft', 'specified', 'queued', 'paused', 'running',
  'validating', 'pr_ready', 'failed', 'canceled',
] as const;
export type FactoryStatus = (typeof FACTORY_STATUSES)[number];

export type FactoryAction =
  | 'repository.read'
  | 'specification.write'
  | 'job.queue'
  | 'sandbox.branch.write'
  | 'sandbox.tests.run'
  | 'github.pr.prepare'
  | 'github.pr.merge'
  | 'production.deploy'
  | 'database.migrate'
  | 'secrets.modify';

export interface TrustedActor {
  readonly kind: 'operator' | 'worker';
  readonly id: string;
  readonly isOperator: boolean;
  readonly aal: 'aal1' | 'aal2' | null;
}

export interface FactoryBudget {
  readonly maxCostEur: number;
  readonly spentCostEur: number;
  readonly maxAttempts: number;
  readonly attempts: number;
}

export interface FactoryJob {
  readonly id: string;
  readonly repository: string;
  /** Must be a separate branch, never protected main. */
  readonly branch: string;
  readonly status: FactoryStatus;
  readonly scopeApproved: boolean;
  readonly budget: FactoryBudget;
  readonly version: number;
  readonly history: readonly FactoryEvent[];
}

export interface FactoryEvent {
  readonly sequence: number;
  readonly jobId: string;
  readonly from: FactoryStatus;
  readonly to: FactoryStatus;
  readonly actorId: string;
  readonly at: string;
  readonly note: string;
}

export interface ValidationEvidence {
  readonly typecheck: 'passed' | 'failed' | 'missing';
  readonly tests: 'passed' | 'failed' | 'missing';
  readonly security: 'passed' | 'failed' | 'missing';
  readonly evidenceIds: readonly string[];
  /** URL MUST be verified by future GitHub adapter; syntax is not proof. */
  readonly prUrl: string;
}

export type FactoryDecision =
  | { readonly allow: true }
  | { readonly allow: false; readonly reason: string };
