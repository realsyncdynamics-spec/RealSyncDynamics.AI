import { describe, expect, it } from 'vitest';
import {
  NO_AUTHORITY,
  createFactoryJob,
  isLoopCompatibleWithJob,
  transitionFactoryJob,
  type FactoryJob,
  type FactoryTransitionCommand,
} from '../../packages/factory-contract/src/index.ts';
import { createInput, REVIEW_EVIDENCE } from './fixtures.ts';

let clock = 0;
function cmd(job: FactoryJob, overrides: Partial<FactoryTransitionCommand>): FactoryTransitionCommand {
  clock += 1;
  return {
    to: 'specified',
    phase: null,
    expectedVersion: job.version,
    fencingEpoch: null,
    at: new Date(Date.UTC(2026, 10, 25, 10, 0, clock)).toISOString(),
    actorRef: 'test-actor',
    note: 'Testschritt',
    costCents: 0,
    evidence: [],
    ...overrides,
  };
}

function step(job: FactoryJob, overrides: Partial<FactoryTransitionCommand>): FactoryJob {
  const result = transitionFactoryJob(job, cmd(job, overrides));
  expect(result.authority).toEqual(NO_AUTHORITY);
  return result.job;
}

function runningJob(): FactoryJob {
  let job = createFactoryJob(createInput());
  job = step(job, { to: 'specified' });
  job = step(job, { to: 'queued' });
  return step(job, { to: 'running', phase: 'analysis' });
}

describe('factory-contract: State-Machine', () => {
  it('führt einen Job bis review_required und zählt Version, Epoche und Versuche', () => {
    let job = runningJob();
    expect(job.leaseEpoch).toBe(1);
    job = step(job, { to: 'running', phase: 'planning', fencingEpoch: 1 });
    job = step(job, { to: 'running', phase: 'implementation', fencingEpoch: 1, costCents: 300 });
    job = step(job, { to: 'validating', fencingEpoch: 1 });
    job = step(job, { to: 'review_required', fencingEpoch: 1, evidence: REVIEW_EVIDENCE });
    expect(job.status).toBe('review_required');
    expect(job.version).toBe(7);
    expect(job.attempts.used).toBe(1);
    expect(job.budget.spentCents).toBe(300);
    expect(job.events.map(e => e.sequence)).toEqual([1, 2, 3, 4, 5, 6, 7]);
  });

  it('weist veraltete Versionen ab (Compare-and-swap)', () => {
    const job = createFactoryJob(createInput());
    expect(() => transitionFactoryJob(job, cmd(job, { expectedVersion: 5 }))).toThrow('version_conflict');
  });

  it('weist unerlaubte Übergänge ab', () => {
    const job = createFactoryJob(createInput());
    expect(() => transitionFactoryJob(job, cmd(job, { to: 'running', phase: 'analysis' }))).toThrow('invalid_transition');
  });

  it('kennt nach review_required keinen Weg zu Merge oder Release', () => {
    let job = runningJob();
    job = step(job, { to: 'running', phase: 'implementation', fencingEpoch: 1 });
    job = step(job, { to: 'validating', fencingEpoch: 1 });
    job = step(job, { to: 'review_required', fencingEpoch: 1, evidence: REVIEW_EVIDENCE });
    for (const to of ['queued', 'running', 'validating', 'cancelled'] as const) {
      expect(() => transitionFactoryJob(job, cmd(job, { to, phase: to === 'running' ? 'implementation' : null }))).toThrow('invalid_transition');
    }
  });

  it('verlangt für review_required alle Nachweisarten', () => {
    let job = runningJob();
    job = step(job, { to: 'running', phase: 'implementation', fencingEpoch: 1 });
    job = step(job, { to: 'validating', fencingEpoch: 1 });
    expect(() => transitionFactoryJob(job, cmd(job, {
      to: 'review_required', fencingEpoch: 1, evidence: REVIEW_EVIDENCE.slice(0, 3),
    }))).toThrow('review_evidence_missing:security');
  });

  it('weist Worker mit alter Lease nach Pause und Neustart ab (Fencing)', () => {
    let job = runningJob();
    job = step(job, { to: 'paused' });
    job = step(job, { to: 'queued' });
    job = step(job, { to: 'running', phase: 'planning' });
    expect(job.leaseEpoch).toBe(2);
    expect(() => transitionFactoryJob(job, cmd(job, { to: 'validating', fencingEpoch: 1 }))).toThrow('stale_lease');
    expect(() => transitionFactoryJob(job, cmd(job, { to: 'validating', fencingEpoch: null }))).toThrow('fencing_epoch_required');
  });

  it('blockiert Budgetüberschreitung, statt zu kappen', () => {
    const job = runningJob();
    expect(() => transitionFactoryJob(job, cmd(job, {
      to: 'running', phase: 'planning', fencingEpoch: 1, costCents: 1001,
    }))).toThrow('budget_exceeded');
  });

  it('begrenzt Implementierungsversuche', () => {
    let job = runningJob();
    job = step(job, { to: 'running', phase: 'implementation', fencingEpoch: 1 });
    job = step(job, { to: 'validating', fencingEpoch: 1 });
    job = step(job, { to: 'running', phase: 'implementation', fencingEpoch: 1 });
    job = step(job, { to: 'validating', fencingEpoch: 1 });
    expect(job.attempts.used).toBe(2);
    expect(() => transitionFactoryJob(job, cmd(job, {
      to: 'running', phase: 'implementation', fencingEpoch: 1,
    }))).toThrow('attempts_exhausted');
  });

  it('erlaubt Phasen nur vorwärts', () => {
    let job = runningJob();
    job = step(job, { to: 'running', phase: 'planning', fencingEpoch: 1 });
    expect(() => transitionFactoryJob(job, cmd(job, { to: 'running', phase: 'analysis', fencingEpoch: 1 }))).toThrow('phase_regression');
  });

  it('lehnt rückdatierte Events ab', () => {
    const job = runningJob();
    expect(() => transitionFactoryJob(job, cmd(job, {
      to: 'paused', at: '2020-01-01T00:00:00Z',
    }))).toThrow('event_time_regression');
  });

  it('lehnt unbekannte Felder im Kommando ab, etwa mitgelieferte Actor-Objekte', () => {
    const job = createFactoryJob(createInput());
    const command = { ...cmd(job, {}), actor: { kind: 'operator', isOperator: true, aal: 'aal2' } };
    expect(() => transitionFactoryJob(job, command as FactoryTransitionCommand)).toThrow('command_unexpected_field:actor');
  });

  it('lässt den Eingangsjob bei Fehlern unverändert', () => {
    const job = runningJob();
    const before = JSON.stringify(job);
    expect(() => transitionFactoryJob(job, cmd(job, { to: 'validating', fencingEpoch: 9 }))).toThrow('stale_lease');
    expect(JSON.stringify(job)).toBe(before);
  });

  it('trennt Goal-Loop und Job-Status', () => {
    let job = runningJob();
    expect(isLoopCompatibleWithJob(job, 'ready')).toBe(false);
    job = step(job, { to: 'running', phase: 'implementation', fencingEpoch: 1 });
    expect(isLoopCompatibleWithJob(job, 'review_required')).toBe(true);
    expect(job.status).toBe('running');
    expect(isLoopCompatibleWithJob(job, 'completed')).toBe(false);
  });
});
