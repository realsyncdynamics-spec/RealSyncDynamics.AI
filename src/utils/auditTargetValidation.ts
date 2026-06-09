const FREE_EMAIL_DOMAINS = new Set([
  'gmail.com', 'yahoo.com', 'outlook.com', 'hotmail.com', 'gmx.de', 'gmx.net',
  'web.de', 'icloud.com', 'live.com', 'protonmail.com', 't-online.de',
]);

const LOCALHOST_PATTERNS = /^(localhost|127\.\d+\.\d+\.\d+|::1|0\.0\.0\.0)/i;
const IP_PATTERN = /^\d{1,3}(\.\d{1,3}){3}$/;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export interface AuditTargetResult {
  ok: boolean;
  url?: string;
  error?: string;
}

const ERROR_MSG =
  'Bitte geben Sie die Website Ihres Unternehmens ein, z. B. beispiel.de. E-Mail-Adressen können nicht geprüft werden.';

export function normalizeAuditTarget(input: string): AuditTargetResult {
  const trimmed = input.trim();

  if (!trimmed) {
    return { ok: false, error: 'Bitte geben Sie eine Website-Domain ein.' };
  }

  if (EMAIL_PATTERN.test(trimmed)) {
    return { ok: false, error: ERROR_MSG };
  }

  // Strip protocol for validation
  const withoutProtocol = trimmed.replace(/^https?:\/\//i, '').replace(/^www\./i, '');

  // Check if it looks like an email domain extracted from address
  const domainPart = withoutProtocol.split('/')[0].split('?')[0].toLowerCase();

  if (FREE_EMAIL_DOMAINS.has(domainPart)) {
    return { ok: false, error: ERROR_MSG };
  }

  if (LOCALHOST_PATTERNS.test(domainPart)) {
    return { ok: false, error: 'Lokale Adressen können nicht geprüft werden.' };
  }

  if (IP_PATTERN.test(domainPart)) {
    return { ok: false, error: 'IP-Adressen können nicht geprüft werden. Bitte Domain angeben.' };
  }

  if (!domainPart.includes('.') || domainPart.length < 4) {
    return { ok: false, error: 'Bitte geben Sie eine gültige Domain ein, z. B. beispiel.de.' };
  }

  const normalized = trimmed.match(/^https?:\/\//i) ? trimmed : `https://${trimmed}`;
  return { ok: true, url: normalized };
}
