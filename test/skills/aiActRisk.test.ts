import { describe, expect, it } from 'vitest';
import {
  classifyUseCase,
  getAiActObligations,
  AI_ACT_TIERS,
} from '../../src/lib/skills/aiActRisk';

describe('classifyUseCase', () => {
  it('classifies a prohibited practice (Art. 5)', () => {
    const r = classifyUseCase('social_scoring');
    expect(r.tier).toBe('prohibited');
    expect(r.needsReview).toBe(false);
    expect(r.articleRef).toMatch(/Art\. 5/);
  });

  it('classifies an Annex-III high-risk use case', () => {
    expect(classifyUseCase('employment_screening').tier).toBe('high');
  });

  it('classifies a transparency (limited) use case', () => {
    expect(classifyUseCase('chatbot').tier).toBe('limited');
  });

  it('is separator/case tolerant', () => {
    expect(classifyUseCase('  Employment-Screening ').tier).toBe('high');
  });

  it('unknown categories are conservatively limited + needsReview (never silently minimal)', () => {
    const r = classifyUseCase('irgendwas_unbekanntes');
    expect(r.tier).toBe('limited');
    expect(r.needsReview).toBe(true);
  });
});

describe('getAiActObligations', () => {
  it('rejects unknown tiers', () => {
    expect(() => getAiActObligations('banana')).toThrow();
  });

  it('high-risk carries the full obligation set', () => {
    const o = getAiActObligations('high');
    expect(o.tier).toBe('high');
    expect(o.requirements.requiresHumanOversight).toBe(true);
    expect(o.requirements.requiresAuditTrail).toBe(true);
    expect(o.disclaimer).toMatch(/keine Rechtsberatung/i);
  });

  it('prohibited is flagged as a prohibited use case', () => {
    expect(getAiActObligations('prohibited').requirements.prohibitedUseCase).toBe(true);
  });

  it('every tier resolves', () => {
    for (const t of AI_ACT_TIERS) {
      expect(getAiActObligations(t).tier).toBe(t);
    }
  });
});
