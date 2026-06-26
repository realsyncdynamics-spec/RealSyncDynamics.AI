import { describe, expect, it } from 'vitest';
import { ALL_SKILLS, SKILL_REGISTRY } from '../../src/lib/skills/registry';

describe('SKILL_REGISTRY', () => {
  it('exposes exactly 8 skills', () => {
    expect(ALL_SKILLS).toHaveLength(8);
  });

  it('includes the gdpr-audit skill with the no-legal-opinion guardrail', () => {
    const s = SKILL_REGISTRY['gdpr-audit'];
    expect(s).toBeTruthy();
    expect(s.guardrails.some((g) => g.includes('Rechtsberatung'))).toBe(true);
    expect(s.reviewRequired).toBe(true); // high-risk
  });

  it('does NOT contain a cx-ticket-triage duplicate', () => {
    expect(ALL_SKILLS.find((s) => (s.key as string) === 'cx-ticket-triage')).toBeUndefined();
  });

  it('has no duplicate keys', () => {
    const keys = ALL_SKILLS.map((s) => s.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('every skill has triggers, useCases, guardrails', () => {
    for (const s of ALL_SKILLS) {
      expect(s.triggers.length, s.key).toBeGreaterThan(0);
      expect(s.useCases.length, s.key).toBeGreaterThan(0);
      expect(s.guardrails.length, s.key).toBeGreaterThan(0);
    }
  });

  it('marks all high-risk skills as reviewRequired', () => {
    for (const s of ALL_SKILLS) {
      if (s.riskLevel === 'high') {
        expect(s.reviewRequired, `${s.key} is high-risk → must require review`).toBe(true);
      }
    }
  });

  it('legal skills carry the no-legal-opinion guardrail', () => {
    expect(SKILL_REGISTRY['legal-compliance'].guardrails.some((g) => g.includes('Rechtsberatung'))).toBe(true);
    expect(SKILL_REGISTRY['legal-contract-review'].guardrails.some((g) => g.includes('Rechtsberatung'))).toBe(true);
  });

  it('finance-audit-support carries the no-audit-opinion guardrail', () => {
    expect(SKILL_REGISTRY['finance-audit-support'].guardrails.some((g) => g.includes('Auditmeinung'))).toBe(true);
  });

  it('sales-draft-outreach forbids automatic sending', () => {
    expect(SKILL_REGISTRY['sales-draft-outreach'].guardrails.some((g) => g.includes('automatische Versendung'))).toBe(true);
  });
});
