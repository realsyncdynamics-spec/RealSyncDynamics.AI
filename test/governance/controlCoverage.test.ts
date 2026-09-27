import { describe, expect, it } from 'vitest';
import {
  buildControlCoverage,
  conservativeStatus,
} from '../../src/features/governance/controlCoverage';
import type { PolicyPack } from '../../src/features/policy-packs/policyPacksApi';

const packs: PolicyPack[] = [
  {
    id: 'pack-a',
    name: 'A',
    description: null,
    industry: 'general',
    frameworks: ['GDPR', 'EU_AI_ACT'],
    controls: [
      { framework: 'GDPR', control_code: '32' },
      { framework: 'EU_AI_ACT', control_code: '9' },
    ],
  },
  {
    id: 'pack-b',
    name: 'B',
    description: null,
    industry: 'general',
    frameworks: ['GDPR'],
    controls: [
      { framework: 'GDPR', control_code: '32' },
      { framework: 'GDPR', control_code: '30' },
    ],
  },
];

describe('buildControlCoverage', () => {
  it('returns no numeric coverage when no policy pack is active', () => {
    const result = buildControlCoverage(packs, new Set(), []);
    expect(result.activePackCount).toBe(0);
    expect(result.controls).toEqual([]);
    expect(result.coverage).toBeNull();
  });

  it('deduplicates controls across active packs and treats unmapped controls as not started', () => {
    const result = buildControlCoverage(
      packs,
      new Set(['pack-a', 'pack-b']),
      [{ framework: 'GDPR', control_code: '32', status: 'implemented' }],
    );

    expect(result.controls).toHaveLength(3);
    expect(result.coverage).toMatchObject({
      total: 3,
      implemented: 1,
      notStarted: 2,
      percent: 33,
    });
  });

  it('reduces duplicate asset mappings conservatively instead of taking the optimistic status', () => {
    const result = buildControlCoverage(
      packs,
      new Set(['pack-a']),
      [
        { framework: 'GDPR', control_code: '32', status: 'implemented' },
        { framework: 'GDPR', control_code: '32', status: 'gap' },
        { framework: 'EU_AI_ACT', control_code: '9', status: 'implemented' },
      ],
    );

    expect(result.coverage).toMatchObject({
      total: 2,
      implemented: 1,
      gap: 1,
      percent: 50,
    });
  });

  it('removes not-applicable controls from the denominator', () => {
    const result = buildControlCoverage(
      packs,
      new Set(['pack-a']),
      [
        { framework: 'GDPR', control_code: '32', status: 'not_applicable' },
        { framework: 'EU_AI_ACT', control_code: '9', status: 'implemented' },
      ],
    );

    expect(result.coverage).toMatchObject({
      total: 2,
      implemented: 1,
      notApplicable: 1,
      percent: 100,
    });
  });
});

describe('conservativeStatus', () => {
  it('prefers gaps and work in progress over an implemented status', () => {
    expect(conservativeStatus(['implemented', 'gap'])).toBe('gap');
    expect(conservativeStatus(['implemented', 'in_progress'])).toBe('in_progress');
    expect(conservativeStatus(['implemented', 'not_started'])).toBe('not_started');
  });

  it('returns not applicable only when every mapping is not applicable', () => {
    expect(conservativeStatus(['not_applicable', 'not_applicable'])).toBe('not_applicable');
    expect(conservativeStatus(['not_applicable', 'implemented'])).toBe('implemented');
  });
});
