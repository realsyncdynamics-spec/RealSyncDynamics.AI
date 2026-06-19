import { describe, it, expect } from 'vitest';
import {
  computeGovernanceScore,
  computePenaltyScore,
  computeAuditReadiness,
  scoreLevel,
  scoreLabel,
  type CockpitCounts,
  type CockpitPosture,
} from '../../src/features/governance/cockpit/cockpitScore';

const ZERO: CockpitCounts = { incidents: 0, dpias: 0, dsr: { total: 0, overdue: 0 }, approvals: 0, vendorsNoDpa: 0 };

describe('computePenaltyScore', () => {
  it('returns 100 when nothing is open', () => {
    expect(computePenaltyScore(ZERO)).toBe(100);
  });

  it('weights overdue DSR (12) and incidents (10) most heavily', () => {
    expect(computePenaltyScore({ ...ZERO, dsr: { total: 1, overdue: 1 } })).toBe(88);
    expect(computePenaltyScore({ ...ZERO, incidents: 1 })).toBe(90);
    expect(computePenaltyScore({ ...ZERO, approvals: 1 })).toBe(97);
  });

  it('clamps at 0 for many open items', () => {
    expect(computePenaltyScore({ ...ZERO, incidents: 50 })).toBe(0);
  });
});

describe('computeGovernanceScore', () => {
  it('falls back to penalty score when no posture snapshot exists', () => {
    expect(computeGovernanceScore({ ...ZERO, incidents: 1 }, null)).toBe(90);
  });

  it('blends 60% penalty + 40% posture', () => {
    const posture: CockpitPosture = {
      policiesEnabledPercent: 50,
      assetEvidencePercent: 50,
      assetMappingsPercent: 0,
    };
    // penalty = 100, posture avg = 50 → 0.6*100 + 0.4*50 = 80
    expect(computeGovernanceScore(ZERO, posture)).toBe(80);
  });

  it('is deterministic for identical input', () => {
    const p: CockpitPosture = { policiesEnabledPercent: 73, assetEvidencePercent: 41, assetMappingsPercent: 60 };
    const c: CockpitCounts = { ...ZERO, incidents: 2, dpias: 1 };
    expect(computeGovernanceScore(c, p)).toBe(computeGovernanceScore(c, p));
  });
});

describe('computeAuditReadiness', () => {
  it('returns the mapping coverage proxy', () => {
    expect(computeAuditReadiness({ policiesEnabledPercent: 0, assetEvidencePercent: 0, assetMappingsPercent: 67 })).toBe(67);
  });
  it('returns null without a snapshot', () => {
    expect(computeAuditReadiness(null)).toBeNull();
  });
});

describe('scoreLevel / scoreLabel', () => {
  it('maps to gauge thresholds', () => {
    expect(scoreLevel(90)).toBe('passed');
    expect(scoreLevel(70)).toBe('low');
    expect(scoreLevel(50)).toBe('medium');
    expect(scoreLevel(20)).toBe('critical');
  });
  it('labels in German', () => {
    expect(scoreLabel(95)).toBe('Sehr gut');
    expect(scoreLabel(30)).toBe('Handlungsbedarf');
  });
});
