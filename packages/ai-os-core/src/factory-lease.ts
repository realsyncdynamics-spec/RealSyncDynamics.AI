/**
 * SF-002: pure simulated worker lease + monotonically increasing fencing epoch.
 * In production every transition needs a single atomic database CAS, a trusted
 * server clock, authenticated worker identities and fenced external writes.
 * This reducer alone grants NO execution permission.
 */
import type { FactoryJob, FactoryMockContext } from './factory-contract.ts';

export interface FactoryMockLease {
  readonly holderId: string;
  /** An epoch, NOT a bearer credential. All external writes must fence by it. */
  readonly epoch: number;
  readonly expiresAt: string;
}
export interface FactoryMockLeaseSnapshot {
  readonly jobId: string;
  readonly scopeId: string;
  /** Optimistic CAS revision for the lease record. */
  readonly revision: number;
  /** Never decreases, including when lease is released. */
  readonly lastEpoch: number;
  readonly active: FactoryMockLease | null;
}
export interface FactoryMockLeaseCommand {
  readonly operation: 'acquire' | 'renew' | 'release';
  readonly expectedRevision: number;
  readonly holderId: string;
  readonly epoch?: number;
  readonly ttlSeconds?: number;
}
export type FactoryLeaseOutcome =
  | { readonly ok: true; readonly next: FactoryMockLeaseSnapshot }
  | { readonly ok: false; readonly reason: 'simulation_only' | 'not_operator' | 'scope_mismatch'
      | 'invalid_job' | 'revision_conflict' | 'leased_by_other'
      | 'stale_fence' | 'lease_expired' | 'bad_input' };

export function newFactoryMockLeaseSnapshot(job: FactoryJob): FactoryMockLeaseSnapshot {
  return { jobId: job.id, scopeId: job.scopeId, revision: 0, lastEpoch: 0, active: null };
}

/** Side-effect-free reduction, which does not persist its output. */
export function reduceFactoryMockLease(
  snapshot: FactoryMockLeaseSnapshot,
  job: FactoryJob,
  command: FactoryMockLeaseCommand,
  context: FactoryMockContext,
): FactoryLeaseOutcome {
  if (context.mode !== 'simulation') return { ok: false, reason: 'simulation_only' };
  if (!context.isOperator || !context.operatorId.trim()) return { ok: false, reason: 'not_operator' };
  if (context.scopeId !== job.scopeId || snapshot.scopeId !== job.scopeId || snapshot.jobId !== job.id) {
    return { ok: false, reason: 'scope_mismatch' };
  }
  if (snapshot.revision !== command.expectedRevision) return { ok: false, reason: 'revision_conflict' };
  if (!Number.isSafeInteger(snapshot.lastEpoch) || snapshot.lastEpoch < 0 ||
      !Number.isSafeInteger(snapshot.revision) || snapshot.revision < 0 ||
      !command.holderId || !/^[a-zA-Z0-9_-]{1,100}$/.test(command.holderId) ||
      !Number.isFinite(Date.parse(context.now))) {
    return { ok: false, reason: 'bad_input' };
  }
  const now = Date.parse(context.now);
  const previous = snapshot.active;
  if (previous && (!Number.isSafeInteger(previous.epoch) ||
       previous.epoch > snapshot.lastEpoch ||
       previous.epoch <= 0 ||
       !Number.isFinite(Date.parse(previous.expiresAt)))) {
    return { ok: false, reason: 'bad_input' };
  }
  if (command.operation === 'acquire') {
    if (job.state !== 'approved_for_sandbox' && job.state !== 'running') {
      return { ok: false, reason: 'invalid_job' };
    }
    if (!Number.isSafeInteger(command.ttlSeconds) || command.ttlSeconds! < 1 ||
        command.ttlSeconds! > 300) return { ok: false, reason: 'bad_input' };
    if (previous && Date.parse(previous.expiresAt) > now) {
      return { ok: false, reason: 'leased_by_other' };
    }
    const epoch = snapshot.lastEpoch + 1;
    if (!Number.isSafeInteger(epoch)) return { ok: false, reason: 'bad_input' };
    return { ok: true, next: {
      ...snapshot, revision: snapshot.revision + 1, lastEpoch: epoch,
      active: { holderId: command.holderId, epoch,
        expiresAt: new Date(now + command.ttlSeconds! * 1000).toISOString() },
    } };
  }
  if (!previous || previous.epoch !== command.epoch || previous.holderId !== command.holderId) {
    return { ok: false, reason: 'stale_fence' };
  }
  if (Date.parse(previous.expiresAt) <= now) return { ok: false, reason: 'lease_expired' };
  if (command.operation === 'renew') {
    if (job.state !== 'running') return { ok: false, reason: 'invalid_job' };
    if (!Number.isSafeInteger(command.ttlSeconds) || command.ttlSeconds! < 1 ||
        command.ttlSeconds! > 300) return { ok: false, reason: 'bad_input' };
    const newDeadline = Math.max(now + command.ttlSeconds! * 1000, Date.parse(previous.expiresAt) + 1);
    return { ok: true, next: { ...snapshot, revision: snapshot.revision + 1,
      active: { ...previous, expiresAt: new Date(newDeadline).toISOString() } } };
  }
  if (command.operation === 'release') {
    return { ok: true, next: { ...snapshot, revision: snapshot.revision + 1, active: null } };
  }
  return { ok: false, reason: 'bad_input' };
}
