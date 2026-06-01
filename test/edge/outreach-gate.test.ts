// Unit-Tests für das DSGVO-Outreach-Compliance-Gate.
//
// Reine Logik (kein Deno-Runtime nötig) — importiert die .ts-Quelle direkt,
// gleicher Stil wie test/edge/scan-pipeline.test.ts.

import { describe, it, expect } from 'vitest';
import {
  evaluateOutreachGate,
  isFreemailDomain,
  isRoleBasedLocalPart,
  hasOptOutNotice,
  OPT_OUT_FOOTER_DE,
  type OutreachCandidate,
} from '../../supabase/functions/_shared/outreach-gate.ts';

const validB2B: OutreachCandidate = {
  company_name: 'Muster GmbH',
  domain: 'muster-gmbh.de',
  contact_email: 'info@muster-gmbh.de',
  source_url: 'https://muster-gmbh.de/impressum',
  source_type: 'imprint',
  legal_basis: 'legitimate_interest',
  legitimate_interest_note: 'Anbieter von DSGVO-Audits; Unternehmen betreibt Tracker ohne Consent — sachlicher Bezug.',
  opt_out: false,
};

describe('outreach gate — helpers', () => {
  it('detects freemail domains', () => {
    expect(isFreemailDomain('gmail.com')).toBe(true);
    expect(isFreemailDomain('GMX.de')).toBe(true);
    expect(isFreemailDomain('muster-gmbh.de')).toBe(false);
  });

  it('detects role-based local parts incl. tagged variants', () => {
    expect(isRoleBasedLocalPart('info')).toBe(true);
    expect(isRoleBasedLocalPart('info+leads')).toBe(true);
    expect(isRoleBasedLocalPart('datenschutz')).toBe(true);
    expect(isRoleBasedLocalPart('max.mustermann')).toBe(false);
  });

  it('recognises an opt-out notice in a message body', () => {
    expect(hasOptOutNotice(OPT_OUT_FOOTER_DE)).toBe(true);
    expect(hasOptOutNotice('Bitte mit STOPP antworten.')).toBe(true);
    expect(hasOptOutNotice('Kaufen Sie jetzt!')).toBe(false);
  });
});

describe('outreach gate — decisions', () => {
  it('allows a fully documented B2B contact', () => {
    const res = evaluateOutreachGate(validB2B);
    expect(res.allowed).toBe(true);
    expect(res.violations).toHaveLength(0);
    expect(res.evidence.decision).toBe('allow');
    expect(res.evidence.passed_checks).toContain('legitimate_interest_documented');
    expect(res.evidence.passed_checks).toContain('role_based_mailbox');
  });

  it('blocks when opt_out is set', () => {
    const res = evaluateOutreachGate({ ...validB2B, opt_out: true });
    expect(res.allowed).toBe(false);
    expect(res.violations.map((v) => v.code)).toContain('OPT_OUT');
  });

  it('blocks freemail / private addresses', () => {
    const res = evaluateOutreachGate({ ...validB2B, contact_email: 'max.mustermann@gmail.com' });
    expect(res.allowed).toBe(false);
    expect(res.violations.map((v) => v.code)).toContain('PERSONAL_EMAIL');
  });

  it('blocks when the source is undocumented', () => {
    const res = evaluateOutreachGate({ ...validB2B, source_url: '   ' });
    expect(res.allowed).toBe(false);
    expect(res.violations.map((v) => v.code)).toContain('MISSING_SOURCE');
  });

  it('blocks legitimate_interest without a documented note', () => {
    const res = evaluateOutreachGate({ ...validB2B, legitimate_interest_note: '' });
    expect(res.allowed).toBe(false);
    expect(res.violations.map((v) => v.code)).toContain('MISSING_LEGITIMATE_INTEREST_NOTE');
  });

  it('blocks consent basis without a consent_ref', () => {
    const res = evaluateOutreachGate({
      ...validB2B,
      legal_basis: 'consent',
      legitimate_interest_note: null,
      consent_ref: null,
    });
    expect(res.allowed).toBe(false);
    expect(res.violations.map((v) => v.code)).toContain('MISSING_CONSENT_REF');
  });

  it('flags special-category (Art. 9) signals for manual review', () => {
    const res = evaluateOutreachGate({ ...validB2B, contact_role: 'Leitung Gesundheit & Patienten' });
    expect(res.allowed).toBe(false);
    expect(res.violations.map((v) => v.code)).toContain('SENSITIVE_DATA');
  });

  it('blocks when neither domain nor business email establishes B2B context', () => {
    const res = evaluateOutreachGate({
      company_name: 'Solo',
      source_url: 'https://example.com/x',
      legitimate_interest_note: 'note',
      // no domain, no email
    });
    expect(res.allowed).toBe(false);
    expect(res.violations.map((v) => v.code)).toContain('MISSING_BUSINESS_CONTEXT');
  });
});
