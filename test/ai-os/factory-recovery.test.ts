import { describe, expect, it } from 'vitest';
import {
  newFactoryMockJob, transitionFactoryMock,
  type FactoryJob, type FactoryMockContext,
} from '../../packages/ai-os-core/src/factory-contract.ts';
import {
  inspectFactoryRecovery, type RecoveryLeaseView,
  type RecoveryInspectionInput,
} from '../../packages/ai-os-core/src/factory-recovery.ts';

const now = '2026-11-20T10:00:00Z';
const hash = 'a'.repeat(64);
const context: FactoryMockContext = {
  mode: 'simulation', operatorId: 'test_operator', isOperator: true, aal2: true,
  scopeId: 'internal_factory', now,
};
function step(j: FactoryJob, operation: string, ctx: FactoryMockContext = context, extra: Record<string, unknown> = {}): FactoryJob {
  const result = transitionFactoryMock(j, {
    operation, expectedVersion: j.version, idempotencyKey: `key_${j.version}_${operation}`,
    evidenceRef: `ev_sf003_${j.version}_${operation}`, ...extra,
  }, ctx);
  if (!result.ok) throw new Error(`setup failed: ${result.reason}`);
  return result.job;
}
function fixture() {
  const draft = newFactoryMockJob('sf003', 'internal_factory', 100);
  const specified = step(draft, 'specify', context, { specSha256: hash });
  const approved = step(specified, 'approve_sandbox', {
    ...context, sandboxApproval: {
      id: 'mock_approval', jobId: 'sf003', specSha256: hash, approverId: 'human',
      humanConfirmed: true, expiresAt: '2026-11-20T11:00:00Z',
    },
  });
  const running = step(approved, 'start_mock');
  const testing = step(running, 'mock_succeeded');
  const review = step(testing, 'tests_passed');
  const completed = step(review, 'accept_review', {
    ...context, reviewApproval: {
      id: 'mock_review', jobId: 'sf003', approverId: 'human', humanConfirmed: true,
    },
  });
  return { draft, specified, approved, running, review, completed };
}
function lease(j: FactoryJob, expiresAt: string | null = null): RecoveryLeaseView {
  return { jobId: j.id, scopeId: j.scopeId, revision: 2, lastEpoch: 1,
    active: expiresAt ? { holderId: 'worker_a', epoch: 1, expiresAt } : null };
}
function inspect(j: FactoryJob, override: Partial<RecoveryInspectionInput> = {}) {
  return inspectFactoryRecovery({
    job: j, lease: lease(j), observedAt: now, undeliveredOutboxCount: 0, ...override,
  });
}

describe('SF-003 recovery inspection (read-only; simulation only)', () => {
  it('flags a running job without lease as orphaned', () => {
    expect(inspect(fixture().running)).toMatchObject({
      category: 'orphaned_worker', action: 'inspect_orphaned_job', canAutomaticallyExecute: false,
    });
  });
  it('flags an expired running lease as orphaned', () => {
    const j = fixture().running;
    expect(inspect(j, { lease: lease(j, '2026-11-20T09:59:59Z') }).category).toBe('orphaned_worker');
  });
  it('leaves valid leases alone', () => {
    const j = fixture().running;
    expect(inspect(j, { lease: lease(j, '2026-11-20T10:01:00Z') })).toMatchObject({
      category: 'lease_active', action: 'observe_only',
    });
  });
  it('does not infer missing storage means zero active leases', () => {
    expect(inspect(fixture().running, { lease: null }).category).toBe('storage_incomplete');
  });
  it('prioritizes outstanding outbox delivery reconciliation over worker status', () => {
    expect(inspect(fixture().running, { undeliveredOutboxCount: 1 })).toMatchObject({
      category: 'outbox_reconciliation_required', action: 'reconcile_outbox',
    });
  });
  it('treats unavailable outbox data as fail-closed', () => {
    expect(inspect(fixture().running, { undeliveredOutboxCount: null }).category).toBe('storage_incomplete');
  });
  it('rejects negative outbox counts', () => {
    expect(inspect(fixture().running, { undeliveredOutboxCount: -1 }).category).toBe('invalid_snapshot');
  });
  it('preserves a human review gate', () => {
    expect(inspect(fixture().review)).toMatchObject({
      category: 'awaiting_human_review', action: 'request_human_review',
    });
  });
  it('does not restart terminal jobs', () => {
    expect(inspect(fixture().completed)).toMatchObject({ category: 'terminal', action: 'none' });
  });
  it('does not start a newly specified job', () => {
    expect(inspect(fixture().specified)).toMatchObject({ category: 'not_running', action: 'none' });
  });
  it('does not automatically acquire a lease for an approved job', () => {
    expect(inspect(fixture().approved)).toMatchObject({ category: 'not_running', action: 'none' });
  });
  it('detects corrupted event history', () => {
    const j = fixture().running;
    const events = [...j.events];
    events[2] = { ...events[2], from: 'draft' };
    expect(inspect({ ...j, events }).category).toBe('invalid_snapshot');
  });
  it('detects mismatched version and missing receipts', () => {
    const j = fixture().running;
    expect(inspect({ ...j, version: 100 }).category).toBe('invalid_snapshot');
    expect(inspect({ ...j, receipts: [] }).category).toBe('invalid_snapshot');
  });
  it('detects foreign and malformed lease records', () => {
    const j = fixture().running;
    expect(inspect(j, { lease: { ...lease(j), scopeId: 'foreign' } }).category).toBe('invalid_snapshot');
    expect(inspect(j, { lease: { ...lease(j), lastEpoch: -1 } }).category).toBe('invalid_snapshot');
  });
  it('never returns execution authorization in any state', () => {
    const states = Object.values(fixture());
    for (const job of states) expect(inspect(job).canAutomaticallyExecute).toBe(false);
  });
  it('rejects a forged jump directly from sandbox approval to completed', () => {
    const j = fixture().running;
    const events = [...j.events];
    events[2] = { ...events[2], operation: 'accept_review', to: 'completed' };
    expect(inspect({ ...j, state: 'completed', events }).category).toBe('invalid_snapshot');
  });
  it('rejects missing approval metadata on previously approved job', () => {
    const j = fixture().running;
    expect(inspect({ ...j, sandboxApprovalId: null }).category).toBe('invalid_snapshot');
  });

});
