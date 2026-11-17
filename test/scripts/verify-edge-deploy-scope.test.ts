import { describe, expect, it } from 'vitest';
import { partitionByDeployment } from '../../scripts/verify-edge-deploy-scope.mjs';

describe('edge deploy production inventory preflight', () => {
  it('permits updates of genuinely deployed slugs', () => {
    expect(partitionByDeployment(['gdpr-audit', 'ai-gateway'], [
      { slug: 'gdpr-audit' }, { slug: 'ai-gateway' },
    ])).toEqual({ ready: ['gdpr-audit', 'ai-gateway'], missing: [] });
  });

  it('blocks the four not-deployed workspace slugs from November 16', () => {
    const plan = partitionByDeployment([
      'gdpr-audit', 'platform-intelligence-orchestrator',
      'workspace-approvals', 'workspace-events', 'workspace-execute',
    ], [{ slug: 'gdpr-audit' }]);
    expect(plan.ready).toEqual(['gdpr-audit']);
    expect(plan.missing).toEqual([
      'platform-intelligence-orchestrator', 'workspace-approvals',
      'workspace-events', 'workspace-execute',
    ]);
  });

  it('deduplicates changed slugs without changing their order', () => {
    expect(partitionByDeployment(['gdpr-audit', 'gdpr-audit', 'siteos'], [
      { name: 'gdpr-audit' }, { slug: 'siteos' },
    ])).toEqual({ ready: ['gdpr-audit', 'siteos'], missing: [] });
  });

  it('fails closed on malformed remote data or unsafe scopes', () => {
    expect(() => partitionByDeployment(['siteos'], { functions: [] })).toThrow();
    expect(() => partitionByDeployment(['siteos'], [{ unrelated: true }])).toThrow();
    expect(() => partitionByDeployment(['siteos;echo'], [])).toThrow();
  });
});
