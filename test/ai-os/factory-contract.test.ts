import { describe, expect, it } from 'vitest';
import {
  newFactoryMockJob, transitionFactoryMock, simulateFactoryWorker,
  type FactoryCommand, type FactoryJob, type FactoryMockContext,
} from '../../packages/ai-os-core/src/factory-contract.ts';

const HASH = 'a'.repeat(64);
const OTHER_HASH = 'b'.repeat(64);
const NOW = '2026-11-20T10:00:00Z';
const scopeId = 'internal_space_A';
const operatorId = 'mock_operator';
const ctx = (over: Partial<FactoryMockContext> = {}): FactoryMockContext => ({
  mode: 'simulation', scopeId, operatorId, isOperator: true, aal2: true, now: NOW, ...over,
});
const job = () => newFactoryMockJob('sf001', scopeId, 100);
const make = (j: FactoryJob, operation: string, opts: Partial<FactoryCommand> = {}): FactoryCommand => ({
  operation, expectedVersion: j.version, idempotencyKey: `key_${j.version}_${operation}`,
  evidenceRef: `ev_sf001_${j.version}_${operation}`, ...opts,
});
const applied = (j: FactoryJob, operation: string, context: FactoryMockContext = ctx(), opts: Partial<FactoryCommand> = {}): FactoryJob => {
  const result = transitionFactoryMock(j, make(j, operation, opts), context);
  if (!result.ok) throw new Error(`failed ${operation}: ${result.reason}`);
  return result.job;
};
const specified = () => applied(job(), 'specify', ctx(), { specSha256: HASH });
const approved = () => applied(specified(), 'approve_sandbox', ctx({ sandboxApproval: {
  id: 'approve_mock_1', jobId: 'sf001', specSha256: HASH,
  approverId: 'human_operator', humanConfirmed: true, expiresAt: '2026-11-20T11:00:00Z',
}}));

describe('SF-001 factory contract: no external effects', () => {
  it('replays the complete mock lifecycle but requires explicit final review', () => {
    let j = approved();
    const work = simulateFactoryWorker(j, ctx(), 'passed');
    expect(work.ok).toBe(true);
    if (!work.ok) return;
    j = work.job;
    expect(j.state).toBe('review_required');
    expect(j.spentCents).toBe(1);
    expect(j.events.map(e => e.operation)).toEqual(['specify', 'approve_sandbox', 'start_mock', 'mock_succeeded', 'tests_passed']);
    expect(transitionFactoryMock(j, make(j, 'accept_review'), ctx())).toEqual({ ok: false, reason: 'approval_required' });
    const reviewed = transitionFactoryMock(j, make(j, 'accept_review'), ctx({ reviewApproval: {
      id: 'review_mock_1', jobId: 'sf001', approverId: 'human_operator', humanConfirmed: true,
    }}));
    expect(reviewed.ok).toBe(true);
    if (reviewed.ok) expect(reviewed.job.state).toBe('completed');
  });

  it('rejects absent operator identity and foreign namespace', () => {
    const j = job();
    expect(transitionFactoryMock(j, make(j, 'specify', { specSha256: HASH }), ctx({ isOperator: false }))).toMatchObject({ ok: false, reason: 'not_operator' });
    expect(transitionFactoryMock(j, make(j, 'specify', { specSha256: HASH }), ctx({ scopeId: 'foreign_tenant' }))).toMatchObject({ ok: false, reason: 'scope_mismatch' });
  });

  it('rejects direct production access irrespective of synthetic approvals', () => {
    const j = approved();
    expect(transitionFactoryMock(j, make(j, 'start_mock'), ctx({ mode: 'production' }))).toMatchObject({ ok: false, reason: 'simulation_only' });
    expect(simulateFactoryWorker(j, ctx(), 'attempted_production')).toMatchObject({ ok: false, reason: 'simulation_only' });
    expect(transitionFactoryMock(j, make(j, 'deploy_production'), ctx())).toMatchObject({ ok: false, reason: 'invalid_transition' });
  });

  it('rejects approval without MFA or matching job/spec or verified human decision', () => {
    const j = specified();
    const base = { id: 'approval', jobId: j.id, specSha256: HASH, approverId: 'owner', humanConfirmed: true, expiresAt: '2026-11-20T11:00:00Z' };
    expect(transitionFactoryMock(j, make(j, 'approve_sandbox'), ctx())).toMatchObject({ ok: false, reason: 'approval_required' });
    expect(transitionFactoryMock(j, make(j, 'approve_sandbox'), ctx({ aal2: false, sandboxApproval: base }))).toMatchObject({ ok: false, reason: 'approval_required' });
    expect(transitionFactoryMock(j, make(j, 'approve_sandbox'), ctx({ sandboxApproval: { ...base, jobId: 'other' } }))).toMatchObject({ ok: false, reason: 'approval_required' });
    expect(transitionFactoryMock(j, make(j, 'approve_sandbox'), ctx({ sandboxApproval: { ...base, specSha256: OTHER_HASH } }))).toMatchObject({ ok: false, reason: 'approval_required' });
    expect(transitionFactoryMock(j, make(j, 'approve_sandbox'), ctx({ sandboxApproval: { ...base, humanConfirmed: false } }))).toMatchObject({ ok: false, reason: 'approval_required' });
    expect(transitionFactoryMock(j, make(j, 'approve_sandbox'), ctx({ sandboxApproval: { ...base, expiresAt: '2026-11-20T09:00:00Z' } }))).toMatchObject({ ok: false, reason: 'approval_expired' });
  });

  it('rejects sandbox start after approval expiry', () => {
    const j = approved();
    expect(transitionFactoryMock(j, make(j, 'start_mock'), ctx({ now: '2026-11-20T12:00:00Z' }))).toMatchObject({ ok: false, reason: 'approval_expired' });
  });

  it('rejects budget overrun and preserves old state', () => {
    const j = approved();
    const result = transitionFactoryMock(j, make(j, 'start_mock', { mockCostCents: 101 }), ctx());
    expect(result).toMatchObject({ ok: false, reason: 'budget_exceeded' });
    expect(j.state).toBe('approved_for_sandbox');
    expect(j.spentCents).toBe(0);
  });

  it('records failed worker and no automatic retry', () => {
    const r = simulateFactoryWorker(approved(), ctx(), 'crashed');
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.job.state).toBe('failed');
    expect(transitionFactoryMock(r.job, make(r.job, 'start_mock'), ctx())).toMatchObject({ ok: false, reason: 'invalid_transition' });
  });

  it('records failed test as failed without asking for production deployment', () => {
    const r = simulateFactoryWorker(approved(), ctx(), 'test_failed');
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.job.state).toBe('failed');
  });

  it('does not allow skipped states or terminal-to-active transitions', () => {
    const draft = job();
    expect(transitionFactoryMock(draft, make(draft, 'start_mock'), ctx())).toMatchObject({ ok: false, reason: 'invalid_transition' });
    const cancelled = applied(draft, 'cancel');
    expect(transitionFactoryMock(cancelled, make(cancelled, 'specify', { specSha256: HASH }), ctx())).toMatchObject({ ok: false, reason: 'invalid_transition' });
  });

  it('deduplicates exact retry but refuses same key with different content', () => {
    const j = job();
    const command = make(j, 'specify', { specSha256: HASH });
    const first = transitionFactoryMock(j, command, ctx());
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    const again = transitionFactoryMock(first.job, command, ctx());
    expect(again).toMatchObject({ ok: true, replay: true });
    if (again.ok) expect(again.job.events).toHaveLength(1);
    expect(transitionFactoryMock(first.job, { ...command, specSha256: OTHER_HASH }, ctx())).toMatchObject({ ok: false, reason: 'idempotency_conflict' });
    expect(transitionFactoryMock(first.job, { ...make(first.job, 'approve_sandbox'), expectedVersion: 0 }, ctx())).toMatchObject({ ok: false, reason: 'version_conflict' });
  });

  it('rejects malformed input without mutating the original', () => {
    const j = job();
    expect(transitionFactoryMock(j, make(j, 'specify', { specSha256: 'not_hash' }), ctx())).toMatchObject({ ok: false, reason: 'bad_input' });
    expect(transitionFactoryMock(j, make(j, 'specify', { specSha256: HASH, mockCostCents: -1 }), ctx())).toMatchObject({ ok: false, reason: 'bad_input' });
    expect(j.events).toHaveLength(0);
  });
});
