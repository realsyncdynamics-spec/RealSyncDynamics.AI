/**
 * Grobe PII-Erkennung für Tool-Argumente.
 * Kein Ersatz für eine vollständige DSGVO-Klassifikation — nur der
 * Policy-Check "pii" im Prüfpfad. Excerpts werden maskiert.
 */

export interface VoicePiiFinding {
  type: 'email' | 'phone' | 'iban';
  excerpt: string;
}

const EMAIL = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i;
const PHONE_DE =
  /(?:\+49[\s./-]?)?(?:0?1[5-7]\d|0\d{2,4})[\s./-]?\d{3,12}\b/;
const IBAN = /\b[A-Z]{2}\d{2}[A-Z0-9]{10,30}\b/;

export function scanVoicePii(input: unknown): VoicePiiFinding[] {
  const text = flatten(input);
  const findings: VoicePiiFinding[] = [];
  const email = text.match(EMAIL);
  if (email) findings.push({ type: 'email', excerpt: mask(email[0]) });
  const phone = text.match(PHONE_DE);
  if (phone) findings.push({ type: 'phone', excerpt: mask(phone[0]) });
  const iban = text.match(IBAN);
  if (iban) findings.push({ type: 'iban', excerpt: mask(iban[0]) });
  return findings;
}

function flatten(value: unknown): string {
  if (typeof value === 'string') return value;
  if (value == null) return '';
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function mask(raw: string): string {
  if (raw.length < 6) return '•••';
  return `${raw.slice(0, 2)}•••${raw.slice(-2)}`;
}
