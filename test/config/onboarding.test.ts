import { describe, expect, it } from 'vitest';
import { ONBOARDING_QUESTIONS, recommendFromAnswers } from '../../shared/onboarding';

describe('Onboarding Q&A', () => {
  it('stellt genau sechs Fragen mit Vorgaben', () => {
    expect(ONBOARDING_QUESTIONS).toHaveLength(6);
    for (const q of ONBOARDING_QUESTIONS) {
      expect(q.options.length).toBeGreaterThanOrEqual(3);
    }
  });

  it('empfiehlt Starter fuer eine Domain ohne Umbau', () => {
    const rec = recommendFromAnswers(['keep_frontend', 'channel_none', 'domains_1', 'fw_dsgvo', 'role_solo']);
    expect(rec.planId).toBe('starter');
    expect(rec.track).toBe('keep_frontend');
    expect(rec.modules).toContain('governance_core');
  });

  it('hebt Chat und Builder in die Modul-Liste', () => {
    const rec = recommendFromAnswers(['modernize_frontend', 'channel_web', 'domains_3', 'fw_iso', 'role_team']);
    expect(rec.track).toBe('modernize_frontend');
    expect(rec.modules).toEqual(expect.arrayContaining(['ai_frontend', 'website_chat', 'advanced_ai_governance']));
    expect(rec.planId).toBe('growth');
  });

  it('legt Agenturen auf Agency', () => {
    expect(recommendFromAnswers(['role_agency', 'domains_10']).planId).toBe('agency');
  });
});
