import { describe, it, expect } from 'vitest';
import {
  recommendPacks,
  topRecommendations,
  deriveActiveFrameworks,
  RECOMMENDATION_TIER_LABEL,
  type PackForRecommend,
} from '../../src/lib/policy-packs/recommend';

// Katalog analog zur Migration 20260701150000_policy_packs.sql.
const CATALOG: PackForRecommend[] = [
  { id: 'dsgvo-essentials',     name: 'DSGVO – Vollständig',   industry: 'all',                     frameworks: ['GDPR'] },
  { id: 'eu-ai-act-high-risk',  name: 'EU AI Act – High-Risk', industry: 'ai',                      frameworks: ['EU_AI_ACT'] },
  { id: 'nis2-cybersecurity',   name: 'NIS2 Cybersicherheit',  industry: 'critical-infrastructure', frameworks: ['NIS2'] },
  { id: 'dora-financial',       name: 'DORA – Resilienz',      industry: 'fintech',                 frameworks: ['DORA'] },
  { id: 'iso-27001-foundation', name: 'ISO 27001 – Annex A (2022)', industry: 'all',                frameworks: ['ISO_27001'] },
  { id: 'tisax-automotive',     name: 'TISAX Automotive',      industry: 'automotive',              frameworks: ['TISAX'] },
  { id: 'fintech-compliance',   name: 'FinTech Compliance',    industry: 'fintech',                 frameworks: ['GDPR', 'NIS2', 'DORA'] },
];

describe('recommendPacks', () => {
  it('empfiehlt ohne jedes Signal nur die Fundament- und DSGVO-Packs', () => {
    const recs = recommendPacks(CATALOG, {});
    const ids = recs.map((r) => r.packId);
    // 'all'-Packs (Fundament) + DSGVO-haltige Packs bekommen eine Baseline.
    expect(ids).toContain('dsgvo-essentials');
    expect(ids).toContain('iso-27001-foundation');
    expect(ids).toContain('fintech-compliance'); // enthält GDPR
    // Reine Branchen-/Framework-Packs ohne Signal bleiben aus.
    expect(ids).not.toContain('tisax-automotive');
    expect(ids).not.toContain('nis2-cybersecurity');
    expect(ids).not.toContain('eu-ai-act-high-risk');
  });

  it('priorisiert das AI-Act-Pack bei Hochrisiko-KI', () => {
    const recs = recommendPacks(CATALOG, { hasHighRiskAI: true, highRiskCount: 2 });
    const ai = recs.find((r) => r.packId === 'eu-ai-act-high-risk');
    expect(ai).toBeDefined();
    expect(ai!.score).toBe(45);
    expect(ai!.reasons[0]).toContain('2 Hochrisiko-KI-Systeme');
  });

  it('formuliert die Singular-Begründung bei genau einem System', () => {
    const recs = recommendPacks(CATALOG, { hasHighRiskAI: true, highRiskCount: 1 });
    const ai = recs.find((r) => r.packId === 'eu-ai-act-high-risk')!;
    expect(ai.reasons[0]).toContain('1 Hochrisiko-KI-System ');
    expect(ai.reasons[0]).not.toContain('Systeme');
  });

  it('bewertet einen FinTech-Tenant mit Hochrisiko-KI korrekt', () => {
    const recs = recommendPacks(CATALOG, {
      industry: 'fintech',
      hasHighRiskAI: true,
      highRiskCount: 1,
      activeFrameworks: ['GDPR'],
    });
    const byId = Object.fromEntries(recs.map((r) => [r.packId, r]));
    // fintech-compliance: Branche +40, GDPR +25, GDPR in Nutzung +12 = 77 → essential
    expect(byId['fintech-compliance'].score).toBe(77);
    expect(byId['fintech-compliance'].tier).toBe('essential');
    // dora-financial: Branche +40 → recommended
    expect(byId['dora-financial'].tier).toBe('recommended');
    // eu-ai-act-high-risk: +45 → recommended
    expect(byId['eu-ai-act-high-risk'].tier).toBe('recommended');
    // Ranking absteigend nach Score.
    const scores = recs.map((r) => r.score);
    expect(scores).toEqual([...scores].sort((a, b) => b - a));
  });

  it('kappt den Score bei 100', () => {
    const recs = recommendPacks(
      [{ id: 'mega', name: 'Mega', industry: 'fintech', frameworks: ['GDPR', 'NIS2', 'DORA'] }],
      { industry: 'fintech', hasHighRiskAI: false, activeFrameworks: ['GDPR', 'NIS2', 'DORA'] },
    );
    // 40 (Branche) + 25 (GDPR) + 36 (3× in Nutzung) = 101 → 100
    expect(recs[0].score).toBe(100);
  });

  it('schließt bereits aktivierte Packs aus', () => {
    const recs = recommendPacks(CATALOG, { hasHighRiskAI: true }, { excludePackIds: ['eu-ai-act-high-risk'] });
    expect(recs.find((r) => r.packId === 'eu-ai-act-high-risk')).toBeUndefined();
  });

  it('addiert Framework-Overlap je Framework', () => {
    const recs = recommendPacks(CATALOG, { activeFrameworks: ['GDPR', 'NIS2', 'DORA'] });
    const fintech = recs.find((r) => r.packId === 'fintech-compliance')!;
    // GDPR-Baseline 25 + Fundament? nein (industry fintech) + 3× Overlap 36 = 61
    expect(fintech.score).toBe(61);
    expect(fintech.reasons.some((r) => r.includes('Bereits in Nutzung'))).toBe(true);
  });

  it('ist deterministisch bei Score-Gleichstand (Sortierung nach packId)', () => {
    const recs = recommendPacks(
      [
        { id: 'zeta', name: 'Z', industry: 'all', frameworks: [] },
        { id: 'alpha', name: 'A', industry: 'all', frameworks: [] },
      ],
      {},
    );
    expect(recs.map((r) => r.packId)).toEqual(['alpha', 'zeta']);
  });
});

describe('topRecommendations', () => {
  it('liefert nur essential/recommended und respektiert das Limit', () => {
    const top = topRecommendations(CATALOG, {
      industry: 'fintech',
      hasHighRiskAI: true,
      highRiskCount: 1,
      activeFrameworks: ['GDPR'],
    }, { limit: 2 });
    expect(top.length).toBe(2);
    expect(top.every((r) => r.tier !== 'optional')).toBe(true);
  });

  it('filtert Optional-Empfehlungen heraus', () => {
    // Nur Fundament-Signal → alle Baselines sind ≤ 45, aber iso ist optional (20).
    const top = topRecommendations(CATALOG, {});
    expect(top.find((r) => r.packId === 'iso-27001-foundation')).toBeUndefined();
  });
});

describe('deriveActiveFrameworks', () => {
  it('dedupliziert Frameworks aus Mappings', () => {
    const fw = deriveActiveFrameworks([
      { framework: 'GDPR' }, { framework: 'GDPR' }, { framework: 'NIS2' },
    ]);
    expect(fw.sort()).toEqual(['GDPR', 'NIS2']);
  });

  it('liefert bei leeren Mappings ein leeres Array', () => {
    expect(deriveActiveFrameworks([])).toEqual([]);
  });
});

describe('RECOMMENDATION_TIER_LABEL', () => {
  it('hat deutsche Labels für alle Tiers', () => {
    expect(RECOMMENDATION_TIER_LABEL.essential).toBe('Essenziell');
    expect(RECOMMENDATION_TIER_LABEL.recommended).toBe('Empfohlen');
    expect(RECOMMENDATION_TIER_LABEL.optional).toBe('Optional');
  });
});
