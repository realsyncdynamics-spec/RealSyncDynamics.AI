import { describe, expect, it } from 'vitest';
import type { GovernanceProfile, ScanFinding, Sector } from '../../src/core/onboarding/types';
import {
  classifyAllFindings,
  groupFindingsByDimension,
  scoreDimensionCriticality,
} from '../../src/core/onboarding/findingClassifier';
import { recommendForProfile } from '../../src/core/onboarding/canonicalRecommendation';
import {
  expansionModules,
  nextBestOffer,
  recommendationConfidence,
  scanBackedModules,
} from '../../src/core/onboarding/nextBestAction';

function profileFrom(findings: ScanFinding[], sector: Sector = 'generic'): GovernanceProfile {
  const classified = classifyAllFindings(findings);
  const grouped = groupFindingsByDimension(classified);
  const dimensions = Array.from(grouped.keys()).map((dim) => {
    const score = scoreDimensionCriticality(classified, dim);
    return {
      dimension: dim,
      criticalityScore: score,
      needsAddressing: grouped.get(dim)!.some((f) => f.urgency !== 'eventual'),
      recommendedPlan: (score >= 70 ? 'agency' : score >= 40 ? 'growth' : 'starter') as GovernanceProfile['dimensions'][number]['recommendedPlan'],
    };
  });
  const riskLevel = classified.some((f) => f.original.severity === 'critical')
    ? 'critical'
    : classified.some((f) => f.original.severity === 'high')
      ? 'high'
      : 'medium';
  return {
    scanId: 'audit-1',
    domain: 'beispiel.de',
    sector,
    riskLevel,
    findings: classified,
    answers: [],
    dimensions,
  };
}

function finding(over: Partial<ScanFinding> & Pick<ScanFinding, 'id'>): ScanFinding {
  return {
    severity: 'high',
    title: over.id,
    detail: '',
    ...over,
  } as ScanFinding;
}

describe('recommendationConfidence', () => {
  it('ist hoch bei Scan-Belegen und hoher Dringlichkeit', () => {
    const rec = recommendForProfile(profileFrom([
      finding({ id: 'tracker_no_consent', severity: 'critical' }),
      finding({ id: 'cookies_pre_consent', severity: 'high' }),
    ]));
    expect(scanBackedModules(rec).length).toBeGreaterThan(0);
    expect(recommendationConfidence(rec)).toBe('high');
  });

  it('ist niedrig ohne scan-belegte Module', () => {
    const rec = recommendForProfile(profileFrom([]));
    expect(recommendationConfidence(rec)).toBe('low');
  });
});

describe('nextBestOffer', () => {
  it('führt bei hoher Confidence auf den Plan-Checkout, nicht auf 149 €', () => {
    const rec = recommendForProfile(profileFrom([
      finding({ id: 'tracker_no_consent', severity: 'critical' }),
      finding({ id: 'no_imprint_link', severity: 'high' }),
    ]));
    const offer = nextBestOffer({
      rec,
      currentPlan: 'free',
      auditId: 'audit-1',
      domain: 'beispiel.de',
    });
    expect(offer.mode).toBe('activate_plan');
    expect(offer.ctaHref).toContain('/checkout/');
    expect(offer.ctaHref).toContain('audit_id=audit-1');
    expect(offer.ctaHref).not.toMatch(/149/);
  });

  it('führt bei niedriger Confidence auf Onboarding statt Zwischenkauf', () => {
    const rec = recommendForProfile(profileFrom([]));
    const offer = nextBestOffer({
      rec,
      currentPlan: 'free',
      auditId: 'audit-1',
      domain: 'beispiel.de',
    });
    expect(offer.mode).toBe('review');
    expect(offer.ctaHref).toBe('/onboarding/audit-1');
  });

  it('wechselt nach getragenem Plan auf Expansion im Marketplace', () => {
    const rec = recommendForProfile(profileFrom([
      finding({ id: 'tracker_no_consent', severity: 'critical' }),
    ]));
    const offer = nextBestOffer({
      rec,
      currentPlan: 'enterprise',
      auditId: 'audit-1',
      domain: 'beispiel.de',
    });
    expect(offer.mode).toBe('expand');
    expect(offer.ctaHref).toBe('/app/marketplace');
    expect(expansionModules(rec, 'enterprise').length).toBeGreaterThanOrEqual(0);
  });
});
