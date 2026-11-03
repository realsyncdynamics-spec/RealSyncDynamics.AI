// inbox-form-submit — reine Logik (kein Deno, kein jsr), vitest-importierbar.
//
// Eingabe eines öffentlichen Kontaktformulars auf einer veröffentlichten
// SiteOS-Seite. Das Formular kennt ausschliesslich `site_ref`; `tenant_id`,
// `bot_id` oder andere Client-Angaben zur Zuordnung werden hier nie gelesen.

export const BODY_MAX_BYTES = 16 * 1024;
export const SITE_REF_RE = /^[A-Za-z0-9_-]{24}$/;
export const NONCE_RE = /^[A-Za-z0-9_-]{16,64}$/;
const EMAIL_RE = /^[^\s@]{1,64}@[^\s@]{1,255}$/;
const PHONE_RE = /^[0-9+()\/\s.-]{5,50}$/;

/** Längen entsprechen den CHECKs von public.bot_conversation_intake. */
export const LIMITS = {
  anliegen: 4000,
  kontakt_name: 200,
  kontakt_telefon: 50,
  kontakt_email: 320,
  terminwunsch: 500,
} as const;

/** Honeypot-Feld (gleiche Konvention wie gdpr-audit/funnel-lead). */
export const HONEYPOT_FIELD = 'company_website';

export interface SubmitInput {
  site_ref: string;
  nonce: string;
  anliegen: string;
  kontakt_name: string | null;
  kontakt_telefon: string | null;
  kontakt_email: string | null;
  terminwunsch: string | null;
  einwilligung: true;
}

export type ParseResult =
  | { ok: true; input: SubmitInput }
  | { ok: false; code: 'BAD_REQUEST' | 'VALIDATION'; message: string };

function cap(v: unknown, max: number): string | null {
  if (typeof v !== 'string') return null;
  const s = v.replace(/\u0000/g, '').trim();
  if (!s) return null;
  return s.length > max ? s.slice(0, max) : s;
}

/** Honeypot: ein ausgefülltes, für Menschen unsichtbares Feld = Bot. */
export function isHoneypotTripped(body: Record<string, unknown>): boolean {
  const v = body[HONEYPOT_FIELD];
  return typeof v === 'string' && v.trim().length > 0;
}

/**
 * Validiert den Request-Body. Unbekannte Felder (auch tenant_id/bot_id)
 * werden ignoriert, nie übernommen.
 */
export function parseSubmit(raw: unknown): ParseResult {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return { ok: false, code: 'BAD_REQUEST', message: 'invalid body' };
  }
  const b = raw as Record<string, unknown>;

  const site_ref = typeof b.site_ref === 'string' ? b.site_ref : '';
  if (!SITE_REF_RE.test(site_ref)) {
    return { ok: false, code: 'BAD_REQUEST', message: 'invalid site_ref' };
  }
  const nonce = typeof b.nonce === 'string' ? b.nonce : '';
  if (!NONCE_RE.test(nonce)) {
    return { ok: false, code: 'BAD_REQUEST', message: 'invalid nonce' };
  }

  const anliegen = cap(b.anliegen, LIMITS.anliegen);
  if (!anliegen || anliegen.length < 3) {
    return { ok: false, code: 'VALIDATION', message: 'anliegen required' };
  }

  const kontakt_name = cap(b.kontakt_name ?? b.name, LIMITS.kontakt_name);
  const kontakt_email = cap(b.kontakt_email ?? b.email, LIMITS.kontakt_email);
  const kontakt_telefon = cap(b.kontakt_telefon ?? b.telefon ?? b.phone, LIMITS.kontakt_telefon);
  const terminwunsch = cap(b.terminwunsch, LIMITS.terminwunsch);

  if (kontakt_email && !EMAIL_RE.test(kontakt_email)) {
    return { ok: false, code: 'VALIDATION', message: 'invalid email' };
  }
  if (kontakt_telefon && !PHONE_RE.test(kontakt_telefon)) {
    return { ok: false, code: 'VALIDATION', message: 'invalid phone' };
  }
  if (!kontakt_email && !kontakt_telefon) {
    return { ok: false, code: 'VALIDATION', message: 'email or phone required' };
  }
  if (b.einwilligung !== true) {
    return { ok: false, code: 'VALIDATION', message: 'consent required' };
  }

  return {
    ok: true,
    input: { site_ref, nonce, anliegen, kontakt_name, kontakt_telefon, kontakt_email, terminwunsch, einwilligung: true },
  };
}

/** Deterministischer, je Bot eindeutiger Idempotenzschlüssel (uq_bot_conversations_bot_ref). */
export function externalRef(siteRef: string, nonce: string): string {
  return `form:${siteRef}:${nonce}`;
}

/** Anzeigename im Posteingang — kein Freitext aus dem Anliegen. */
export function contactLabel(i: SubmitInput): string {
  return i.kontakt_name ?? i.kontakt_email ?? i.kontakt_telefon ?? 'Formular';
}

/** Client-IP aus Proxy-Headern; nur für den Hash, nie gespeichert. */
export function clientIp(headers: Headers): string {
  const xff = headers.get('x-forwarded-for');
  if (xff) {
    const first = xff.split(',')[0]?.trim();
    if (first) return first;
  }
  return headers.get('cf-connecting-ip')?.trim() || 'unknown';
}

const enc = new TextEncoder();

/**
 * HMAC-SHA256(salt, ip) als Hex. Fail-closed: leeres Salt wirft, der Aufrufer
 * antwortet dann ohne zu schreiben. Rohe IPs werden nie persistiert.
 */
export async function hashIp(ip: string, salt: string): Promise<string> {
  if (!salt) throw new Error('INBOX_FORM_HASH_SALT missing');
  const key = await crypto.subtle.importKey('raw', enc.encode(salt), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(ip));
  return Array.from(new Uint8Array(sig), (b) => b.toString(16).padStart(2, '0')).join('');
}
