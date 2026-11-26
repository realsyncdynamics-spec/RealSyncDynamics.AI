import type { CreateFactoryJobInput, FactoryEvidenceRef, LegacyBinding } from '../../packages/factory-contract/src/index.ts';

export const SHA_A = 'a'.repeat(40);
export const SHA_B = 'b'.repeat(40);
export const SPEC = 'c'.repeat(64);
export const HASH = 'd'.repeat(64);
export const TENANT = '11111111-2222-4333-8444-555555555555';
export const REPO = 'realsyncdynamics-spec/RealSyncDynamics.AI';

export function createInput(overrides: Partial<CreateFactoryJobInput> = {}): CreateFactoryJobInput {
  return {
    id: 'job-1',
    tenantId: TENANT,
    repository: REPO,
    branch: 'sf-demo-job',
    baseCommitSha: SHA_A,
    specSha256: SPEC,
    scopeId: 'scope-1',
    budgetMaxCents: 1000,
    maxImplementationAttempts: 2,
    ...overrides,
  };
}

export const REVIEW_EVIDENCE: FactoryEvidenceRef[] = ['checkout', 'typecheck', 'tests', 'security'].map(kind => ({
  kind: kind as FactoryEvidenceRef['kind'],
  ref: `evidence://job-1/${kind}`,
  sha256: HASH,
}));

export function binding(overrides: Partial<LegacyBinding> = {}): LegacyBinding {
  return {
    tenantId: TENANT,
    branch: 'sf-demo-job',
    baseCommitSha: SHA_A,
    specSha256: SPEC,
    scopeId: 'scope-1',
    budgetMaxCents: null,
    budgetSpentCents: null,
    evidence: [],
    importedAt: '2026-11-25T10:00:00Z',
    ...overrides,
  };
}

export function sf006Snapshot(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: 'job-a',
    repository: REPO,
    baseRef: SHA_A,
    specificationRef: 'docs/spec/job-a.md',
    status: 'queued',
    limits: { maxCostCents: 500, maxImplementationAttempts: 3 },
    spentCents: 0,
    implementationAttempts: 0,
    events: [],
    ...overrides,
  };
}

export function pr2346Snapshot(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: 'job-b',
    repository: REPO,
    branch: 'sf-demo-job',
    status: 'queued',
    scopeApproved: true,
    budget: { maxCostEur: 12.34, spentCostEur: 0.1, maxAttempts: 3, attempts: 1 },
    version: 4,
    history: [{ any: 'thing' }, { any: 'thing' }],
    ...overrides,
  };
}
