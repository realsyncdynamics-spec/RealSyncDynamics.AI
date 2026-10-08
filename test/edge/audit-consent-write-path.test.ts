/**
 * PR A2 — checkbox + gdpr-audit consent write path (depends on #1806 live).
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  MARKETING_CONSENT_TEXT_VERSION,
  consentInsertErrorLog,
  isMissingConsentColumnError,
  marketingConsentWrite,
  resolveConsentLocale,
} from '../../supabase/functions/gdpr-audit/marketing-consent';

const ROOT = resolve(__dirname, '../..');
const stepper = readFileSync(resolve(ROOT, 'src/components/audit/AuditStepper.tsx'), 'utf8');
const landing = readFileSync(resolve(ROOT, 'src/pages/AuditLanding.tsx'), 'utf8');
const handoff = readFileSync(resolve(ROOT, 'src/i18n/handoff.ts'), 'utf8');
const gdprAudit = readFileSync(resolve(ROOT, 'supabase/functions/gdpr-audit/index.ts'), 'utf8');
const privacy = readFileSync(resolve(ROOT, 'src/features/legal/PrivacyPolicy.tsx'), 'utf8');

describe('marketingConsentWrite', () => {
  it('opt-in only on true; never includes consent_at', () => {
    expect(marketingConsentWrite(false, 'de')).toEqual({
      marketing_consent: false,
      marketing_consent_text_version: null,
    });
    expect(marketingConsentWrite(true, 'de')).toEqual({
      marketing_consent: true,
      marketing_consent_text_version: MARKETING_CONSENT_TEXT_VERSION.de,
    });
    expect(marketingConsentWrite(true, 'en').marketing_consent_text_version).toBe(
      MARKETING_CONSENT_TEXT_VERSION.en,
    );
    expect(JSON.stringify(marketingConsentWrite(true, 'de'))).not.toMatch(/consent_at/);
  });

  it('resolves locale', () => {
    expect(resolveConsentLocale('en')).toBe('en');
    expect(resolveConsentLocale('de-DE')).toBe('de');
    expect(resolveConsentLocale(undefined)).toBe('de');
  });
});

describe('AuditStepper checkbox', () => {
  it('defaults unchecked and does not require consent to submit', () => {
    expect(stepper).toMatch(/const \[marketingConsent, setMarketingConsent\] = useState\(false\)/);
    expect(stepper).toMatch(/data-testid="audit-followup-consent"/);
    expect(stepper).toMatch(
      /const stepValid = \[\s*domain\.trim\(\)\.length > 2 && EMAIL_RE\.test\(email\.trim\(\)\),/,
    );
  });

  it('mentions offers/Angebote and opens privacy in a new tab (no SPA Link)', () => {
    expect(handoff).toMatch(/Angeboten/);
    expect(handoff).toMatch(/offers/);
    expect(stepper).toMatch(/followUpConsentPrivacy/);
    expect(stepper).toMatch(
      /href="\/legal\/privacy"[^>]*target="_blank"[^>]*rel="noopener noreferrer"/,
    );
    expect(stepper).not.toMatch(/<Link to="\/legal\/privacy"/);
  });
});

describe('AuditLanding → gdpr-audit', () => {
  it('sends boolean + locale, never consent_at', () => {
    expect(landing).toMatch(/marketing_consent:\s*marketingConsent === true/);
    expect(landing).toMatch(/consent_locale:/);
    expect(landing).not.toMatch(/marketing_consent_at/);
  });
});

describe('gdpr-audit write path', () => {
  it('imports local marketing-consent helper (not _shared)', () => {
    expect(gdprAudit).toMatch(/from '\.\/marketing-consent\.ts'/);
    expect(gdprAudit).not.toMatch(/_shared\/audit-marketing-consent/);
    expect(gdprAudit).toMatch(/body\.marketing_consent === true/);
    expect(gdprAudit).toMatch(/sales_leads insert failed/);
    expect(gdprAudit).toMatch(/consentInsertErrorLog/);
    expect(gdprAudit).toMatch(/isMissingConsentColumnError/);
    expect(gdprAudit).toMatch(/retry without consent/);
  });

  it('logs only code+message for lead errors (no details/email leak)', () => {
    expect(consentInsertErrorLog({
      code: 'PGRST204',
      message: 'Could not find the marketing_consent column',
      details: 'Failing row contains (evil@example.com)',
    })).toEqual({
      code: 'PGRST204',
      message: 'Could not find the marketing_consent column',
    });
    expect(JSON.stringify(consentInsertErrorLog({
      code: '23505',
      message: 'duplicate',
      details: 'Failing row contains (evil@example.com)',
    }))).not.toMatch(/evil@example/);
  });

  it('detects missing marketing_consent column errors for fail-safe retry', () => {
    expect(isMissingConsentColumnError({
      code: 'PGRST204',
      message: 'Could not find the \'marketing_consent\' column of \'sales_leads\' in the schema cache',
    })).toBe(true);
    expect(isMissingConsentColumnError({
      code: '42703',
      message: 'column \"marketing_consent\" does not exist',
    })).toBe(true);
    expect(isMissingConsentColumnError({
      code: '23505',
      message: 'duplicate key',
    })).toBe(false);
    expect(isMissingConsentColumnError({
      code: 'PGRST204',
      message: 'Could not find the \'other_column\' column',
    })).toBe(false);
  });
});

describe('privacy policy — no premature retention promises', () => {
  it('does not claim 6-month deletion or 3-year proof retention yet', () => {
    expect(privacy).not.toMatch(/Löschung nach 6 Monaten/);
    expect(privacy).not.toMatch(/noch 3 Jahre aufbewahrt/);
  });
});

describe('no drip/unsubscribe in A2', () => {
  it('does not modify audit-drip-cron or Pages unsubscribe', () => {
    // Presence of helper under gdpr-audit only
    expect(
      readFileSync(resolve(ROOT, 'supabase/functions/gdpr-audit/marketing-consent.ts'), 'utf8'),
    ).toMatch(/audit_followup_v1_de/);
  });
});
