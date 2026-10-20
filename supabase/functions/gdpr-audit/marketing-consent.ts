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

/** Safe fields for console.error — never log PostgREST `details` (may include email). */
export function consentInsertErrorLog(err: {
  code?: string;
  message?: string;
  details?: string;
  hint?: string;
}): {
  code: string | undefined;
  message: string | undefined;
} {
  return { code: err.code, message: err.message };
}

export type ConsentInsertError = {
  code?: string;
  message?: string;
  details?: string;
  hint?: string;
};

export type ConsentInsertResult<T> = {
  data: T | null;
  error: ConsentInsertError | null;
};

/**
 * True when the schema cache / DB lacks marketing_consent columns
 * (deploy-order skew: A2 before PR A migration).
 */
export function isMissingConsentColumnError(
  err: { code?: string; message?: string } | null | undefined,
): boolean {
  if (!err) return false;
  const code = err.code ?? '';
  const message = (err.message ?? '').toLowerCase();
  if (!message.includes('marketing_consent')) return false;
  // PGRST204: column not found in schema cache; 42703: undefined_column
  return code === 'PGRST204' || code === '42703';
}

/**
 * Insert with consent columns; on missing-column error retry once without them
 * so a wrong deploy order (A2 before PR A) does not 500 the free audit.
 *
 * `insert` is the chainable PostgREST call (or a test mock). `onMissingColumnRetry`
 * receives only the safe `{ code, message }` log payload.
 */
export async function insertWithConsentColumnFailSafe<T>(
  insert: (row: Record<string, unknown>) => Promise<ConsentInsertResult<T>>,
  base: Record<string, unknown>,
  consentCols: MarketingConsentWrite,
  onMissingColumnRetry: (safe: ReturnType<typeof consentInsertErrorLog>) => void,
): Promise<ConsentInsertResult<T>> {
  let result = await insert({ ...base, ...consentCols });
  if (result.error && isMissingConsentColumnError(result.error)) {
    onMissingColumnRetry(consentInsertErrorLog(result.error));
    result = await insert(base);
  }
  return result;
}
