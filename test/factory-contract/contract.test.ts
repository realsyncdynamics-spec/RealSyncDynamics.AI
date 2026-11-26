import { describe, expect, it } from 'vitest';
import { NO_AUTHORITY, createFactoryJob, parseFactoryJob } from '../../packages/factory-contract/src/index.ts';
import { createInput, SHA_A } from './fixtures.ts';

describe('factory-contract: kanonischer Vertrag v1', () => {
  it('legt einen Entwurf mit getrenntem Branch und Basis-SHA in Cent an', () => {
    const job = createFactoryJob(createInput());
    expect(job.status).toBe('draft');
    expect(job.branch).toBe('sf-demo-job');
    expect(job.baseCommitSha).toBe(SHA_A);
    expect(job.budget).toEqual({ currency: 'EUR', maxCents: 1000, spentCents: 0 });
    expect(job.version).toBe(0);
    expect(job.leaseEpoch).toBe(0);
    expect(Object.isFrozen(job.budget)).toBe(true);
  });

  it('lehnt geschützte oder fremde Branches ab', () => {
    for (const branch of ['main', 'master', 'sf-', 'SF-x', 'sf-a/../main', 'claude/x']) {
      expect(() => createFactoryJob(createInput({ branch }))).toThrow('branch_invalid');
    }
  });

  it('verlangt eine 40-stellige Basis-SHA statt eines Branchnamens', () => {
    expect(() => createFactoryJob(createInput({ baseCommitSha: 'main' }))).toThrow('base_commit_sha_invalid');
  });

  it('akzeptiert nur das freigegebene Repository', () => {
    expect(() => createFactoryJob(createInput({ repository: 'evil/RealSyncDynamics.AI' }))).toThrow('repository_not_allowed');
  });

  it('lehnt Budgets als Kommazahl ab', () => {
    expect(() => createFactoryJob(createInput({ budgetMaxCents: 12.5 }))).toThrow('budget_max_cents_invalid');
  });

  it('verlangt einen Tenant als UUID', () => {
    expect(() => createFactoryJob(createInput({ tenantId: 'tenant-a' }))).toThrow('tenant_id_invalid');
  });

  it('lehnt Zusatzfelder und Getter ab', () => {
    const job = createFactoryJob(createInput());
    expect(() => parseFactoryJob({ ...job, isOperator: true })).toThrow('job_unexpected_field:isOperator');
    const withGetter = { ...job };
    Object.defineProperty(withGetter, 'status', { get: () => 'review_required', enumerable: true });
    expect(() => parseFactoryJob(withGetter)).toThrow('job_status_missing');
  });

  it('lehnt review_required ohne Nachweise ab', () => {
    const job = createFactoryJob(createInput());
    expect(() => parseFactoryJob({ ...job, status: 'review_required' })).toThrow('review_evidence_missing:checkout');
  });

  it('lehnt eine Phase außerhalb von running ab', () => {
    const job = createFactoryJob(createInput());
    expect(() => parseFactoryJob({ ...job, phase: 'planning' })).toThrow('phase_status_mismatch');
  });

  it('lehnt unbekannte Vertragsversionen ab', () => {
    const job = createFactoryJob(createInput());
    expect(() => parseFactoryJob({ ...job, contractVersion: 2 })).toThrow('contract_version_unsupported');
  });

  it('hält alle Autoritäts-Flags fest auf false', () => {
    expect(NO_AUTHORITY).toEqual({
      statusAuthenticated: false,
      evidenceVerified: false,
      repositoryBindingVerified: false,
      checkoutAttested: false,
      humanReviewStillRequired: true,
      canStartWorker: false,
      canCreatePullRequest: false,
      canMerge: false,
      canDeploy: false,
    });
    expect(Object.isFrozen(NO_AUTHORITY)).toBe(true);
  });
});
