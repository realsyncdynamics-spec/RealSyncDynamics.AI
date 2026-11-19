import { describe, expect, it } from 'vitest';
import {
  addFactoryCost,
  createFactoryJob,
  simulateFactoryJob,
  transitionFactoryJob,
} from '../../packages/factory-core/src/index.ts';

const specification = {
  id: 'SF-001-demo',
  repository: 'realsyncdynamics-spec/RealSyncDynamics.AI',
  baseRef: 'main',
  specificationRef: 'docs/software-factory/SF-001-FOUNDATION.md',
  limits: { maxCostCents: 250, maxImplementationAttempts: 2 },
} as const;

const ctx = (evidenceRef: string) => ({ actorKind: 'worker' as const, evidenceRef });

describe('SF-001 deterministic factory core (no execution)', () => {
  it('simulates a complete job but does not authorize a release', () => {
    const job = simulateFactoryJob(specification);
    expect(job.status).toBe('draft_pr_ready');
    expect(job.events.map((entry) => entry.to)).toEqual([
      'analyzing', 'planning', 'implementing', 'validating', 'draft_pr_ready',
    ]);
    expect(job.implementationAttempts).toBe(1);
  });

  it('refuses skipping validation and preserves the original job', () => {
    const initial = createFactoryJob(specification);
    expect(() => transitionFactoryJob(initial, 'draft_pr_ready', ctx('test:skip'))).toThrow('invalid factory transition');
    expect(initial.status).toBe('queued');
    expect(initial.events).toHaveLength(0);
  });

  it('rejects missing evidence', () => {
    const initial = createFactoryJob(specification);
    expect(() => transitionFactoryJob(initial, 'analyzing', ctx('  '))).toThrow('evidenceRef');
  });

  it('enforces strict spending caps', () => {
    const initial = createFactoryJob(specification);
    const charged = addFactoryCost(initial, 250);
    expect(charged.spentCents).toBe(250);
    expect(initial.spentCents).toBe(0);
    expect(() => addFactoryCost(charged, 1)).toThrow('budget exceeded');
    expect(() => addFactoryCost(charged, -1)).toThrow('nonnegative safe integer');
  });

  it('limits implementation retries', () => {
    let job = createFactoryJob(specification);
    for (const status of ['analyzing', 'planning', 'implementing', 'validating', 'implementing', 'validating'] as const) {
      job = transitionFactoryJob(job, status, ctx(`test:${status}`));
    }
    expect(() => transitionFactoryJob(job, 'implementing', ctx('test:third'))).toThrow('attempt limit reached');
  });

  it('keeps terminal states terminal and permits blocked jobs to resume', () => {
    let job = createFactoryJob(specification);
    job = transitionFactoryJob(job, 'analyzing', ctx('test:start'));
    job = transitionFactoryJob(job, 'blocked', ctx('test:missing-permission'));
    job = transitionFactoryJob(job, 'queued', { actorKind: 'operator', evidenceRef: 'test:reviewed' });
    expect(job.status).toBe('queued');
    const cancelled = transitionFactoryJob(job, 'cancelled', ctx('test:cancel'));
    expect(() => transitionFactoryJob(cancelled, 'queued', ctx('test:restart'))).toThrow('invalid factory transition');
  });

  it('rejects invalid budgets and malformed repository names', () => {
    expect(() => createFactoryJob({ ...specification, repository: 'not-a-full-repo' })).toThrow('owner/name');
    expect(() => createFactoryJob({ ...specification, limits: { ...specification.limits, maxCostCents: -1 } })).toThrow('nonnegative safe integer');
    expect(() => createFactoryJob({ ...specification, limits: { ...specification.limits, maxImplementationAttempts: 0 } })).toThrow('positive');
  });
});
