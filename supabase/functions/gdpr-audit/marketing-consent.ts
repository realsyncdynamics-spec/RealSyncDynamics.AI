/**
 * Free-Audit marketing / follow-up consent write helpers.
 *
 * Lives next to gdpr-audit (not in `_shared/`) so only this function redeploys.
 * Server trigger owns `marketing_consent_at` — never send it from the client.
 */

export type ConsentLocale = 'de' | 'en';

export const MARKETING_CONSENT_TEXT_VERSION = {
  de: 'audit_followup_v1_de',
  en: 'audit_followup_v1_en',
} as const;

export type MarketingConsentWrite = {
  marketing_consent: boolean;
  marketing_consent_text_version: string | null;
};

export function resolveConsentLocale(raw: unknown): ConsentLocale {
  if (typeof raw !== 'string') return 'de';
  const v = raw.trim().toLowerCase();
  if (v.startsWith('en')) return 'en';
  return 'de';
}

/** Build insert fields. Opt-in only when `marketing_consent === true`. */
export function marketingConsentWrite(
  optedIn: boolean,
  locale: ConsentLocale,
): MarketingConsentWrite {
  if (!optedIn) {
    return {
      marketing_consent: false,
      marketing_consent_text_version: null,
    };
  }
  return {
    marketing_consent: true,
    marketing_consent_text_version: MARKETING_CONSENT_TEXT_VERSION[locale],
  };
}
