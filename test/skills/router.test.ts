import { describe, expect, it } from 'vitest';
import { routeSkill } from '../../src/lib/skills/router';
import { ALL_SKILLS } from '../../src/lib/skills/registry';

describe('routeSkill', () => {
  it('returns no skill for empty input', () => {
    const r = routeSkill('');
    expect(r.selectedSkill).toBeNull();
    expect(r.confidence).toBe(0);
  });

  it('returns no skill when no trigger matches', () => {
    const r = routeSkill('weather forecast for next week');
    expect(r.selectedSkill).toBeNull();
    expect(r.candidates).toHaveLength(0);
  });

  it('routes "DSAR plan" to legal-compliance', () => {
    const r = routeSkill('Bitte einen DSAR-Plan unter DSGVO');
    expect(r.selectedSkill).toBe('legal-compliance');
    expect(r.guardrails.some((g) => g.includes('Rechtsberatung'))).toBe(true);
    expect(r.confidence).toBeGreaterThan(0);
  });

  it('routes "Conversion-Rate" to marketing-performance-analytics', () => {
    const r = routeSkill('Berechne die Conversion-Rate und CTR');
    expect(r.selectedSkill).toBe('marketing-performance-analytics');
  });

  it('routes "Stichprobe / SOX" to finance-audit-support', () => {
    const r = routeSkill('Stichprobe fuer SOX Pruefung');
    expect(r.selectedSkill).toBe('finance-audit-support');
    expect(r.riskLevel).toBe('high');
  });

  it('every registered skill resolves on at least one of its triggers', () => {
    for (const skill of ALL_SKILLS) {
      const trigger = skill.triggers[0]!;
      const r = routeSkill(`Ich brauche etwas zu ${trigger}`);
      expect(r.selectedSkill, `${skill.key} via "${trigger}"`).toBe(skill.key);
    }
  });
});
