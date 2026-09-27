/**
 * Unit tests for Frontend-Builder step logic (no DOM).
 */
import { describe, expect, it } from 'vitest';
import {
  BUILDER_STEPS,
  TOTAL_STEP_COUNT,
  buildInquiryPayload,
  canAdvance,
  canAdvanceChoice,
  canAdvanceKontakt,
  isHoneypotTripped,
  labelForAnswer,
  progressPercent,
  type BuilderAnswers,
  type ChoiceStep,
  type KontaktForm,
} from '../../src/pages/frontend-builder/builderSteps';

const emptyKontakt = (): KontaktForm => ({
  name: '',
  email: '',
  company: '',
  websiteUrl: '',
  message: '',
  privacyAccepted: false,
  companyWebsite: '',
});

describe('frontend-builder steps', () => {
  it('defines 6 choice steps plus kontakt and summary', () => {
    expect(BUILDER_STEPS).toHaveLength(8);
    expect(TOTAL_STEP_COUNT).toBe(8);
    expect(BUILDER_STEPS.filter((s) => s.kind === 'choice')).toHaveLength(6);
    expect(BUILDER_STEPS.at(-1)?.id).toBe('zusammenfassung');
  });

  it('blocks Weiter until a choice is selected', () => {
    const step = BUILDER_STEPS[0] as ChoiceStep;
    const answers: BuilderAnswers = {};
    expect(canAdvanceChoice(step, answers)).toBe(false);
    expect(canAdvance(step, answers, emptyKontakt())).toBe(false);
    answers.projektart = 'landingpage';
    expect(canAdvanceChoice(step, answers)).toBe(true);
    expect(canAdvance(step, answers, emptyKontakt())).toBe(true);
  });

  it('requires name, email, company and privacy on kontakt', () => {
    const kontakt = BUILDER_STEPS.find((s) => s.id === 'kontakt')!;
    const form = emptyKontakt();
    expect(canAdvanceKontakt(form)).toBe(false);
    form.name = 'Ada';
    form.email = 'ada@example.com';
    form.company = 'RSD';
    expect(canAdvanceKontakt(form)).toBe(false);
    form.privacyAccepted = true;
    expect(canAdvanceKontakt(form)).toBe(true);
    expect(canAdvance(kontakt, {}, form)).toBe(true);
  });

  it('rejects invalid email on kontakt', () => {
    const form = emptyKontakt();
    form.name = 'Ada';
    form.email = 'not-an-email';
    form.company = 'RSD';
    form.privacyAccepted = true;
    expect(canAdvanceKontakt(form)).toBe(false);
  });

  it('detects honeypot without treating it as a valid advance', () => {
    const form = emptyKontakt();
    form.name = 'Bot';
    form.email = 'bot@example.com';
    form.company = 'Spam';
    form.privacyAccepted = true;
    form.companyWebsite = 'https://spam.example';
    expect(isHoneypotTripped(form)).toBe(true);
    expect(canAdvanceKontakt(form)).toBe(false);
  });

  it('computes progress across all steps', () => {
    expect(progressPercent(0)).toBe(13);
    expect(progressPercent(7)).toBe(100);
  });

  it('labels answers and builds inquiry payload without inventing plan_key', () => {
    expect(labelForAnswer('projektart', 'saas_dashboard')).toBe('SaaS-Dashboard');
    const form = emptyKontakt();
    form.name = 'TEST Frontend Builder';
    form.email = 'test+frontend-builder@realsyncdynamicsai.de';
    form.company = 'RSD Test';
    form.websiteUrl = 'https://www.example.com/path';
    form.privacyAccepted = true;
    form.message = 'Unit test';
    const payload = buildInquiryPayload({ projektart: 'landingpage', timing: 'sofort' }, form);
    expect(payload.source).toBe('frontend_builder');
    expect(payload.use_case).toBe('frontend_builder');
    expect(payload.path).toBe('/frontend-builder');
    expect(payload.company_domain).toBe('example.com');
    expect(payload.message).toContain('Frontend-Builder Anfrage');
    expect(payload.message).toContain('Landingpage');
    expect(payload).not.toHaveProperty('plan_key');
  });
});