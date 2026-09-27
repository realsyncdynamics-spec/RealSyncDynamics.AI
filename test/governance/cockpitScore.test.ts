import { describe, it, expect } from 'vitest';
import {
  computeGovernanceScore,
  computeGovernanceScoreIfReliable,
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

describe('computeGovernanceScoreIfReliable', () => {
  const POSTURE: CockpitPosture = { policiesEnabledPercent: 50, assetEvidencePercent: 50, assetMappingsPercent: 40 };
  const WITH_DATA = { aiSystems: 2, controlMappings: 5 };
  const EMPTY = { aiSystems: 0, controlMappings: 0 };

  it('kein KPI-Snapshot ⇒ insufficient_data mit null (nicht 100, nicht 0)', () => {
    const r = computeGovernanceScoreIfReliable(true, ZERO, null, WITH_DATA);
    expect(r).toEqual({ score: null, status: 'insufficient_data' });
  });

  it('leerer Mandant (0 KI-Systeme und 0 Mappings) ⇒ insufficient_data mit null, auch mit Snapshot', () => {
    expect(computeGovernanceScoreIfReliable(true, ZERO, POSTURE, EMPTY)).toEqual({ score: null, status: 'insufficient_data' });
    expect(computeGovernanceScoreIfReliable(true, ZERO, null, EMPTY)).toEqual({ score: null, status: 'insufficient_data' });
  });

  it('nur KI-Systeme ODER nur Mappings reicht als Datenbasis', () => {
    expect(computeGovernanceScoreIfReliable(true, ZERO, POSTURE, { aiSystems: 1, controlMappings: 0 }).status).toBe('ok');
    expect(computeGovernanceScoreIfReliable(true, ZERO, POSTURE, { aiSystems: 0, controlMappings: 3 }).status).toBe('ok');
  });

  it('gültige Daten ⇒ ok mit Zahl (Normalfall)', () => {
    // penalty = 100 − 10 = 90, posture avg = 50 → 0.6·90 + 0.4·50 = 74
    expect(computeGovernanceScoreIfReliable(true, { ...ZERO, incidents: 1 }, POSTURE, WITH_DATA)).toEqual({ score: 74, status: 'ok' });
  });

  it('fehlgeschlagene Zähler / Snapshot-RPC / Datenbasis ⇒ unreliable mit null', () => {
    expect(computeGovernanceScoreIfReliable(false, ZERO, POSTURE, WITH_DATA)).toEqual({ score: null, status: 'unreliable' });
    expect(computeGovernanceScoreIfReliable(true, ZERO, null, WITH_DATA, false)).toEqual({ score: null, status: 'unreliable' });
    expect(computeGovernanceScoreIfReliable(true, ZERO, POSTURE, { aiSystems: null, controlMappings: 1 })).toEqual({ score: null, status: 'unreliable' });
    expect(computeGovernanceScoreIfReliable(true, ZERO, POSTURE, { aiSystems: 1, controlMappings: null })).toEqual({ score: null, status: 'unreliable' });
  });

  it('liefert für einen leeren Mandanten nie 100', () => {
    const r = computeGovernanceScoreIfReliable(true, ZERO, null, EMPTY);
    expect(r.score).not.toBe(100);
    expect(r.score).toBeNull();
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
