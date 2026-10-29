import { describe, expect, it } from 'vitest';
import { PLANS, moduleById } from '../../shared/pricing';
import { matrixStatusSuffix } from '../../src/components/pricing/GovernanceModuleMatrix';

describe('UX-004 plan claims honesty', () => {
  it('keine Plan-Überschrift verspricht Selbstüberwachung als live', () => {
    for (const p of PLANS) expect(p.outcomeHeadline).not.toMatch(/sich selbst überwacht/);
    expect(PLANS.find((p) => p.id === 'growth')?.outcomeHeadline).toBe(
      'KI-Governance mit Risk Register und Policy Engine — tägliche Selbstüberwachung folgt (Beta).',
    );
  });

  it('Monitoring/Alerts Beta, Drift Detection Roadmap', () => {
    expect(moduleById('monitoring')?.availability).toBe('preview');
    expect(moduleById('alerts')?.availability).toBe('preview');
    expect(moduleById('drift_detection')?.availability).toBe('coming-soon');
    expect(matrixStatusSuffix('monitoring')).toBe('(Beta)');
    expect(matrixStatusSuffix('alerts')).toBe('(Beta)');
    expect(matrixStatusSuffix('drift_detection')).toBe('(Roadmap)');
    expect(matrixStatusSuffix('risks')).toBeNull();
  });
});
