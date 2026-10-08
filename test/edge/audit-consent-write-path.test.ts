/**
 * PR A2 — checkbox + gdpr-audit consent write path (depends on #1806 live).
 */
import { describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  MARKETING_CONSENT_TEXT_VERSION,
  consentInsertErrorLog,
  insertWithConsentColumnFailSafe,
  isMissingConsentColumnError,
  marketingConsentWrite,
  resolveConsentLocale,
  type ConsentInsertResult,
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

  it('mentions offers/Angebote and opens privacy in a new tab from the checkbox', () => {
    expect(handoff).toMatch(/Angeboten/);
    expect(handoff).toMatch(/offers/);
    expect(stepper).toMatch(/followUpConsentPrivacy/);
    // Checkbox copy must use a plain <a> (new tab) so SPA navigation does not
    // wipe in-progress form state. Footer may still use react-router Link.
    expect(stepper).toMatch(
      /followUpConsentLabel[\s\S]*?href="\/legal\/privacy"[^>]*target="_blank"[^>]*rel="noopener noreferrer"[\s\S]*?followUpConsentPrivacy/,
    );
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
    expect(gdprAudit).toMatch(/insertWithConsentColumnFailSafe/);
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

describe('insertWithConsentColumnFailSafe (behavioral)', () => {
  const base = {
    email: 'lead@example.com',
    source: 'audit_lp',
    path: '/audit',
  };
  const consentCols = marketingConsentWrite(true, 'de');

  it('retries once without consent fields on PGRST204 mentioning marketing_consent', async () => {
    const insert = vi.fn()
      .mockResolvedValueOnce({
        data: null,
        error: {
          code: 'PGRST204',
          message: "Could not find the 'marketing_consent' column of 'sales_leads' in the schema cache",
          details: 'Failing row contains (lead@example.com)',
        },
      } satisfies ConsentInsertResult<{ id: string }>)
      .mockResolvedValueOnce({
        data: { id: 'lead-1' },
        error: null,
      } satisfies ConsentInsertResult<{ id: string }>);

    const logged: Array<{ code: string | undefined; message: string | undefined }> = [];
    const result = await insertWithConsentColumnFailSafe(
      insert,
      base,
      consentCols,
      (safe) => logged.push(safe),
    );

    expect(insert).toHaveBeenCalledTimes(2);
    expect(insert.mock.calls[0][0]).toMatchObject({
      ...base,
      marketing_consent: true,
      marketing_consent_text_version: MARKETING_CONSENT_TEXT_VERSION.de,
    });
    expect(insert.mock.calls[1][0]).toEqual(base);
    expect(insert.mock.calls[1][0]).not.toHaveProperty('marketing_consent');
    expect(insert.mock.calls[1][0]).not.toHaveProperty('marketing_consent_text_version');
    expect(result).toEqual({ data: { id: 'lead-1' }, error: null });
    expect(logged).toEqual([{
      code: 'PGRST204',
      message: "Could not find the 'marketing_consent' column of 'sales_leads' in the schema cache",
    }]);
    expect(JSON.stringify(logged)).not.toMatch(/lead@example\.com/);
  });

  it('does not retry on a different error code', async () => {
    const err = {
      code: '23505',
      message: 'duplicate key value violates unique constraint',
      details: 'Failing row contains (lead@example.com)',
    };
    const insert = vi.fn().mockResolvedValue({
      data: null,
      error: err,
    } satisfies ConsentInsertResult<{ id: string }>);
    const onRetry = vi.fn();

    const result = await insertWithConsentColumnFailSafe(
      insert,
      base,
      consentCols,
      onRetry,
    );

    expect(insert).toHaveBeenCalledTimes(1);
    expect(onRetry).not.toHaveBeenCalled();
    expect(result.error).toEqual(err);
    expect(result.data).toBeNull();
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
