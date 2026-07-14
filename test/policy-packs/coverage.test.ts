import { describe, it, expect } from 'vitest';
import { computeCoverage, coverageBand, frameworkLabel, type PackControlRef, type MappingStatus } from '../../src/lib/policy-packs/coverage';

const controls: PackControlRef[] = [
  { framework: 'GDPR', control_code: 'Art.5' },
  { framework: 'GDPR', control_code: 'Art.30' },
  { framework: 'GDPR', control_code: 'Art.32' },
  { framework: 'EU_AI_ACT', control_code: 'Art.9' },
];

describe('computeCoverage', () => {
  it('zählt fehlende Mappings als not_started', () => {
    const c = computeCoverage(controls, []);
    expect(c.total).toBe(4);
    expect(c.notStarted).toBe(4);
    expect(c.percent).toBe(0);
  });

  it('berechnet Prozent implementiert', () => {
    const m: MappingStatus[] = [
      { framework: 'GDPR', control_code: 'Art.5', status: 'implemented' },
      { framework: 'GDPR', control_code: 'Art.30', status: 'implemented' },
      { framework: 'GDPR', control_code: 'Art.32', status: 'in_progress' },
    ];
    const c = computeCoverage(controls, m);
    expect(c.implemented).toBe(2);
    expect(c.inProgress).toBe(1);
    expect(c.notStarted).toBe(1); // EU_AI_ACT Art.9
    expect(c.percent).toBe(50); // 2 von 4
  });

  it('rechnet not_applicable aus dem Nenner heraus', () => {
    const m: MappingStatus[] = [
      { framework: 'GDPR', control_code: 'Art.5', status: 'implemented' },
      { framework: 'GDPR', control_code: 'Art.30', status: 'not_applicable' },
      { framework: 'GDPR', control_code: 'Art.32', status: 'not_applicable' },
      { framework: 'EU_AI_ACT', control_code: 'Art.9', status: 'implemented' },
    ];
    const c = computeCoverage(controls, m);
    expect(c.notApplicable).toBe(2);
    expect(c.percent).toBe(100); // 2 implementiert / (4 - 2 na)
  });

  it('dedupliziert doppelte Control-Referenzen', () => {
    const dup = [...controls, { framework: 'GDPR', control_code: 'Art.5' }];
    const c = computeCoverage(dup, []);
    expect(c.total).toBe(4);
  });
});

describe('coverageBand / frameworkLabel', () => {
  it('teilt Ampel ein', () => {
    expect(coverageBand(90)).toBe('high');
    expect(coverageBand(50)).toBe('medium');
    expect(coverageBand(10)).toBe('low');
  });
  it('übersetzt Framework-Codes', () => {
    expect(frameworkLabel('GDPR')).toBe('DSGVO');
    expect(frameworkLabel('EU_AI_ACT')).toBe('EU AI Act');
    expect(frameworkLabel('TISAX')).toBe('TISAX');
  });
});
