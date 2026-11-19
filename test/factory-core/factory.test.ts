import { describe, expect, it } from 'vitest';
import {
  authorizeFactoryAction,
  transitionFactoryJob,
  FactoryTransitionError,
  type FactoryJob,
  type TrustedActor,
} from '../../packages/factory-core/src/index';

const operator: TrustedActor = { kind: 'operator', id: 'operator-1', isOperator: true, aal: 'aal2' };
const weakOperator: TrustedActor = { ...operator, aal: 'aal1' };
const worker: TrustedActor = { kind: 'worker', id: 'worker-1', isOperator: false, aal: null };
const fixture = (status: FactoryJob['status'] = 'specified'): FactoryJob => ({
  id: 'SF-001-DEMO',
  repository: 'realsyncdynamics-spec/RealSyncDynamics.AI',
  branch: 'sf-001-demo',
  status,
  scopeApproved: true,
  budget: { maxCostEur: 25, spentCostEur: 0, maxAttempts: 2, attempts: 0 },
  version: 0,
  history: [],
});
const command = (to: FactoryJob['status'], actor: TrustedActor, extra = {}) => ({
  to, actor, expectedVersion: 0, at: '2026-11-20T08:00:00Z', note: 'SF-001 unit test', ...extra,
});

describe('SF-001: fail-closed policy', () => {
  it('denies merge, deploy, migration, secrets, even for 2FA operator', () => {
    for (const action of ['github.pr.merge', 'production.deploy', 'database.migrate', 'secrets.modify'] as const) {
      expect(authorizeFactoryAction(operator, fixture(), action))
        .toEqual({ allow: false, reason: 'separate_release_required' });
    }
  });
  it('requires AAL2 and approved scope before queue', () => {
    expect(authorizeFactoryAction(weakOperator, fixture(), 'job.queue'))
      .toMatchObject({ allow: false, reason: 'mfa_required' });
    expect(authorizeFactoryAction(operator, { ...fixture(), scopeApproved: false }, 'job.queue'))
      .toMatchObject({ allow: false });
    expect(authorizeFactoryAction(operator, fixture(), 'job.queue')).toEqual({ allow: true });
  });
  it('rejects non-allowlisted repos, untrusted branches and exhausted budgets', () => {
    expect(authorizeFactoryAction(worker, { ...fixture('running'), repository: 'someone/other' }, 'sandbox.tests.run'))
      .toMatchObject({ allow: false, reason: 'repository_not_allowlisted' });
    expect(authorizeFactoryAction(worker, { ...fixture('running'), branch: 'feature/untrusted' }, 'sandbox.tests.run'))
      .toMatchObject({ allow: false, reason: 'invalid_branch' });
    expect(authorizeFactoryAction(worker, { ...fixture('running'), budget: { ...fixture().budget, spentCostEur: 25 } }, 'sandbox.tests.run'))
      .toMatchObject({ allow: false, reason: 'cost_budget_exhausted' });
  });
  it('rejects non-finite and non-integer budgets', () => {
    expect(authorizeFactoryAction(operator, { ...fixture(), budget: { ...fixture().budget, maxCostEur: Infinity } }, 'job.queue'))
      .toMatchObject({ allow: false, reason: 'invalid_budget' });
    expect(authorizeFactoryAction(operator, { ...fixture(), budget: { ...fixture().budget, attempts: NaN } }, 'job.queue'))
      .toMatchObject({ allow: false, reason: 'invalid_budget' });
    expect(authorizeFactoryAction(operator, { ...fixture(), budget: { ...fixture().budget, maxAttempts: 1.5 } }, 'job.queue'))
      .toMatchObject({ allow: false, reason: 'invalid_budget' });
  });
  it('does not allow a worker to queue or an operator to write code', () => {
    expect(authorizeFactoryAction(worker, fixture(), 'job.queue')).toMatchObject({ allow: false });
    expect(authorizeFactoryAction(operator, fixture('running'), 'sandbox.branch.write'))
      .toMatchObject({ allow: false });
  });
});

describe('SF-001: deterministic state machine', () => {
  it('queues a specified job with event, leaving input immutable', () => {
    const before = fixture();
    const after = transitionFactoryJob(before, command('queued', operator));
    expect(after.status).toBe('queued');
    expect(after.version).toBe(1);
    expect(after.history).toHaveLength(1);
    expect(after.history[0]).toMatchObject({ sequence: 1, from: 'specified', to: 'queued' });
    expect(before.status).toBe('specified');
    expect(before.history).toHaveLength(0);
  });
  it('rejects invalid transitions and stale versions', () => {
    expect(() => transitionFactoryJob(fixture(), command('pr_ready', worker)))
      .toThrowError('invalid_transition');
    expect(() => transitionFactoryJob(fixture(), command('queued', operator, { expectedVersion: 99 })))
      .toThrowError('version_conflict');
  });
  it('requires validation evidence to enter pr_ready (syntax only; adapter verifies)', () => {
    const job = fixture('validating');
    expect(() => transitionFactoryJob(job, command('pr_ready', worker)))
      .toThrowError('validation_evidence_required');
    const evidence = {
      typecheck: 'passed' as const, tests: 'passed' as const, security: 'passed' as const,
      evidenceIds: ['check-123'],
      prUrl: 'https://github.com/realsyncdynamics-spec/RealSyncDynamics.AI/pull/5000',
    };
    expect(transitionFactoryJob(job, command('pr_ready', worker, { evidence })).status).toBe('pr_ready');
  });
  it('counts attempts on running and prevents retries beyond budget', () => {
    const validating = { ...fixture('validating'), budget: { ...fixture().budget, attempts: 1 } };
    const running = transitionFactoryJob(validating, command('running', worker));
    expect(running.budget.attempts).toBe(2);
    const afterTests = transitionFactoryJob(running, command('validating', worker, { expectedVersion: 1 }));
    expect(afterTests.status).toBe('validating');
    expect(() => transitionFactoryJob(afterTests, command('running', worker, { expectedVersion: 2 })))
      .toThrowError('attempt_budget_exhausted');
  });
  it('pauses and resumes only on operator AAL2, without controlling a real worker', () => {
    const active = fixture('running');
    expect(() => transitionFactoryJob(active, command('paused', worker)))
      .toThrowError('operator_aal2_required');
    const paused = transitionFactoryJob(active, command('paused', operator));
    expect(paused.status).toBe('paused');
    expect(() => transitionFactoryJob(paused, command('queued', weakOperator, { expectedVersion: 1 })))
      .toThrowError('operator_aal2_required');
    const resumed = transitionFactoryJob(paused, command('queued', operator, { expectedVersion: 1 }));
    expect(resumed.status).toBe('queued');
    expect(resumed.history).toHaveLength(2);
  });
  it('prevents unauthorized cancellation', () => {
    expect(() => transitionFactoryJob(fixture('running'), command('canceled', worker)))
      .toThrowError('operator_aal2_required');
    expect(transitionFactoryJob(fixture('running'), command('canceled', operator)).status)
      .toBe('canceled');
  });
  it('uses typed transition errors', () => {
    try { transitionFactoryJob(fixture(), command('pr_ready', worker)); }
    catch (error) { expect(error).toBeInstanceOf(FactoryTransitionError); }
  });
});
