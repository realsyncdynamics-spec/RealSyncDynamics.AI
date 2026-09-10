import { describe, it, expect } from 'vitest';
import {
  computeEvidenceHealth,
  computeOpenMeasures,
  computeRiskIndex,
  HIGH_RISK_ASSET_THRESHOLD,
} from '../../src/features/governance/dashboard/complianceStatus';
import type { CockpitCounts } from '../../src/features/governance/cockpit/cockpitScore';

const ZERO: CockpitCounts = {
  incidents: 0,
  dpias: 0,
  dsr: { total: 0, overdue: 0 },
  approvals: 0,
  vendorsNoDpa: 0,
};

const HASH = 'a'.repeat(64);

describe('computeOpenMeasures', () => {
  it('sums all open buckets including DSR total', () => {
    const measures = computeOpenMeasures({
      incidents: 2,
      dpias: 1,
      dsr: { total: 4, overdue: 1 },
      approvals: 3,
      vendorsNoDpa: 2,
    });
    expect(measures.total).toBe(12);
    expect(measures.dsrOverdue).toBe(1);
    expect(measures.dsrOpen).toBe(4);
  });

  it('is zero when nothing is open', () => {
    expect(computeOpenMeasures(ZERO).total).toBe(0);
  });
});

describe('computeEvidenceHealth', () => {
  it('returns null percent for an empty tenant — not a fake 0%', () => {
    const health = computeEvidenceHealth({
      coveragePercent: null,
      evidence: [],
      newEvidence24h: 0,
      failedScans: 0,
    });
    expect(health.percent).toBeNull();
    expect(health.level).toBe('unknown');
    expect(health.label).toBe('Keine Evidence');
  });

  it('blends 70% coverage and 30% hash share', () => {
    const evidence = [
      { content_hash: HASH },
      { content_hash: HASH },
      { content_hash: null },
      { content_hash: null },
    ];
    // coverage 80, hashedShare 50 → 0.7*80 + 0.3*50 = 71
    const health = computeEvidenceHealth({
      coveragePercent: 80,
      evidence,
      newEvidence24h: 1,
      failedScans: 0,
    });
    expect(health.percent).toBe(71);
    expect(health.hashedCount).toBe(2);
    expect(health.totalCount).toBe(4);
    expect(health.level).toBe('low');
  });

  it('penalizes failed scans by 8 points each and clamps at 0', () => {
    // coverage 40, hashedShare 100 → 0.7*40 + 0.3*100 = 58; −16 = 42
    const withPenalty = computeEvidenceHealth({
      coveragePercent: 40,
      evidence: [{ content_hash: HASH }],
      newEvidence24h: 0,
      failedScans: 2,
    });
    expect(withPenalty.percent).toBe(42);
    expect(withPenalty.level).toBe('medium');

    const clamped = computeEvidenceHealth({
      coveragePercent: 10,
      evidence: [{ content_hash: null }],
      newEvidence24h: 0,
      failedScans: 20,
    });
    expect(clamped.percent).toBe(0);
  });

  it('treats short hashes as missing', () => {
    const health = computeEvidenceHealth({
      coveragePercent: 100,
      evidence: [{ content_hash: 'abc' }, { content_hash: HASH }],
      newEvidence24h: 0,
      failedScans: 0,
    });
    expect(health.hashedCount).toBe(1);
  });

  it('prefers exact aggregate counts over a truncated evidence page', () => {
    const health = computeEvidenceHealth({
      coveragePercent: 80,
      evidence: [{ content_hash: HASH }],
      totalCount: 400,
      hashedCount: 200,
      newEvidence24h: 0,
      failedScans: 0,
    });
    expect(health.totalCount).toBe(400);
    expect(health.hashedCount).toBe(200);
    // coverage 80, hashedShare 50 → 0.7*80 + 0.3*50 = 71
    expect(health.percent).toBe(71);
  });

  it('is deterministic', () => {
    const input = {
      coveragePercent: 55,
      evidence: [{ content_hash: HASH }, { content_hash: null }],
      newEvidence24h: 3,
      failedScans: 1,
    };
    expect(computeEvidenceHealth(input)).toEqual(computeEvidenceHealth(input));
  });
});

describe('computeRiskIndex', () => {
  it('returns null when no assets and no operational load', () => {
    const risk = computeRiskIndex({
      assetScores: [],
      newRisks24h: 0,
      openIncidents: 0,
      dsrOverdue: 0,
    });
    expect(risk.score).toBeNull();
    expect(risk.level).toBe('unknown');
    expect(risk.label).toBe('Kein Residualrisiko erfasst');
  });

  it('counts high-risk assets at the register threshold', () => {
    const risk = computeRiskIndex({
      assetScores: [20, HIGH_RISK_ASSET_THRESHOLD, 90],
      newRisks24h: 0,
      openIncidents: 0,
      dsrOverdue: 0,
    });
    expect(risk.highRiskAssets).toBe(2);
    expect(risk.avgAssetRisk).toBe(60);
    expect(risk.score).toBe(36); // 0.6*60 + 0.4*0
    expect(risk.level).toBe('medium');
  });

  it('uses operational load when no assets exist', () => {
    const risk = computeRiskIndex({
      assetScores: [],
      newRisks24h: 1,
      openIncidents: 2,
      dsrOverdue: 1,
    });
    // 2*15 + 1*18 + 1*8 = 56
    expect(risk.score).toBe(56);
    expect(risk.level).toBe('high');
    expect(risk.label).toBe('Erhöht');
  });

  it('blends asset average with operational load', () => {
    const risk = computeRiskIndex({
      assetScores: [80, 80],
      newRisks24h: 0,
      openIncidents: 1,
      dsrOverdue: 0,
    });
    // avg 80, operational 15 → 0.6*80 + 0.4*15 = 54
    expect(risk.score).toBe(54);
    expect(risk.avgAssetRisk).toBe(80);
  });

  it('does not invent a score from 24h zeros alone', () => {
    expect(
      computeRiskIndex({
        assetScores: [],
        newRisks24h: 0,
        openIncidents: 0,
        dsrOverdue: 0,
      }).score,
    ).toBeNull();
  });
});
