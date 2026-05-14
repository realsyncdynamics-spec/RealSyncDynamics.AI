import { describe, expect, it } from 'vitest';
import { buildPrompt } from '../../src/lib/skills/promptBuilder';
import { ALL_SKILLS } from '../../src/lib/skills/registry';

describe('buildPrompt', () => {
  it('includes label, every guardrail and the user input', () => {
    const preview = buildPrompt('legal-compliance', 'DSAR fuer EU-Kunde');
    expect(preview.system).toContain('Legal Compliance Support');
    expect(preview.system).toContain('Rechtsberatung');
    expect(preview.userPrompt).toBe('DSAR fuer EU-Kunde');
    expect(preview.guardrails.length).toBeGreaterThan(0);
  });

  it('flags reviewRequired skills with a review notice', () => {
    const preview = buildPrompt('sales-draft-outreach', 'kalt-mail an Acme');
    expect(preview.reviewRequired).toBe(true);
    expect(preview.system.toLowerCase()).toContain('mensch-review');
  });

  it('every registered skill yields a buildable prompt with its guardrails', () => {
    for (const skill of ALL_SKILLS) {
      const preview = buildPrompt(skill.key, 'sample input');
      for (const g of skill.guardrails) {
        expect(preview.system, `${skill.key} guardrail`).toContain(g);
      }
    }
  });
});
