/**
 * SF-002: storage-neutral *simulation* boundary around the SF-001 reducer.
 *
 * This file does NOT implement durable storage, real authorization or a worker.
 * Production adapters MUST bind identity and scope on the server, and commit
 * job, event, receipt and cost reservation in ONE database transaction.
 */
import {
  transitionFactoryMock,
  type FactoryCommand,
  type FactoryJob,
  type FactoryMockContext,
  type FactoryRejectReason,
} from './factory-contract.ts';

export interface FactoryAtomicCommit {
  readonly scopeId: string;
  readonly jobId: string;
  readonly expectedVersion: number;
  readonly next: FactoryJob;
}
/**
 * Store contract, NOT a Postgres adapter.
 *
 * load: return a single authoritative snapshot scoped by internal workspace.
 * commit: perform an atomic compare-and-swap on the expected version; persist
 *         next job + append-only event + unique receipt together (all or none).
 *         'committed' only AFTER a committed durable transaction.
 *         Never silently fall back to memory.
 */
export interface FactoryAtomicStore {
  load(scopeId: string, jobId: string): Promise<FactoryJob | null>;
  commit(input: FactoryAtomicCommit): Promise<'committed' | 'conflict' | 'missing'>;
}
export type FactoryAtomicOutcome =
  | { readonly ok: true; readonly job: FactoryJob; readonly replay: boolean }
  | { readonly ok: false; readonly reason: FactoryRejectReason | 'not_found' | 'store_unavailable' | 'integrity_error' | 'write_conflict' };

function matchesSnapshot(job: FactoryJob, scopeId: string, jobId: string): boolean {
  return job.scopeId === scopeId && job.id === jobId &&
    Number.isSafeInteger(job.version) && job.version >= 0 &&
    Number.isSafeInteger(job.spentCents) && Number.isSafeInteger(job.budgetCents) &&
    job.spentCents >= 0 && job.budgetCents >= job.spentCents &&
    Array.isArray(job.receipts) && Array.isArray(job.events) &&
    job.events.length === job.version && job.receipts.length === job.version;
}

/**
 * Fail-closed async boundary. DB errors and "commit succeeded, reply lost"
 * are deliberately indistinguishable to the caller; replay the same key after
 * recovering the durable snapshot. No auto-retry or speculative success.
 *
 * All context inputs are synthetic mock fixtures. NEVER expose this function
 * as a client-facing authorization endpoint.
 */
export async function applyFactoryMockAtomically(
  store: FactoryAtomicStore,
  jobId: string,
  command: FactoryCommand,
  context: FactoryMockContext,
): Promise<FactoryAtomicOutcome> {
  if (context.mode !== 'simulation') return { ok: false, reason: 'simulation_only' };
  if (!context.isOperator || !context.operatorId.trim()) return { ok: false, reason: 'not_operator' };
  if (!/^[a-zA-Z0-9_-]{1,80}$/.test(jobId) || !/^[a-zA-Z0-9_-]{1,80}$/.test(context.scopeId)) {
    return { ok: false, reason: 'integrity_error' };
  }
  let job: FactoryJob | null;
  try {
    job = await store.load(context.scopeId, jobId);
  } catch {
    return { ok: false, reason: 'store_unavailable' };
  }
  if (!job) return { ok: false, reason: 'not_found' };
  if (!matchesSnapshot(job, context.scopeId, jobId)) return { ok: false, reason: 'integrity_error' };
  const transition = transitionFactoryMock(job, command, context);
  if (!transition.ok) return transition;
  if (transition.replay) return { ok: true, job, replay: true };

  const next = transition.job;
  if (next.version !== job.version + 1 ||
      next.events.length !== job.events.length + 1 ||
      next.receipts.length !== job.receipts.length + 1 ||
      next.scopeId !== job.scopeId || next.id !== job.id) {
    return { ok: false, reason: 'integrity_error' };
  }
  try {
    const result = await store.commit({
      scopeId: job.scopeId, jobId: job.id, expectedVersion: job.version, next,
    });
    if (result === 'committed') return { ok: true, job: next, replay: false };
    if (result === 'missing') return { ok: false, reason: 'not_found' };
    return { ok: false, reason: 'write_conflict' };
  } catch {
    // A thrown exception might have occurred BEFORE OR AFTER the transaction commit.
    // The caller must retry with the SAME idempotency key; never guess success.
    return { ok: false, reason: 'store_unavailable' };
  }
}
