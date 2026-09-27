/**
 * CSRF-Schutz für Cookie-Requests (Double-Submit + Origin).
 *
 * Bearer-JWT ohne Cookie: kein CSRF (Token liegt nicht automatisch am Request).
 * Sobald der Browser Cookies mitschickt (Session, Consent, rsd_csrf), gilt:
 * mutierende Methoden brauchen eine erlaubte Origin und — wenn rsd_csrf
 * gesetzt ist — denselben Wert im Header x-csrf-token.
 *
 * Die CSRF-Cookie ist bewusst NICHT HttpOnly (JS muss sie in den Header
 * kopieren). Die spätere Session-Cookie wäre HttpOnly; das hier schützt
 * deren Mitlaufen, nicht das Lesen.
 *
 * Edge-Functions auf *.supabase.co sehen SPA-Cookies nicht (andere Origin).
 * Dieser Guard gilt für die SPA-Origin (Pages Function / Middleware).
 */

export const CSRF_COOKIE = 'rsd_csrf';
export const CSRF_HEADER = 'x-csrf-token';

export const CSRF_ALLOWED_HOSTS = [
  'realsyncdynamicsai.de',
  'www.realsyncdynamicsai.de',
] as const;

export type CsrfResult =
  | { ok: true }
  | { ok: false; status: 403; code: 'CSRF_ORIGIN' | 'CSRF_TOKEN' };

const SAFE = new Set(['GET', 'HEAD', 'OPTIONS']);

export function originHostAllowed(origin: string): boolean {
  try {
    const { protocol, hostname } = new URL(origin);
    if (protocol !== 'https:' && hostname !== 'localhost' && hostname !== '127.0.0.1') {
      return false;
    }
    if ((CSRF_ALLOWED_HOSTS as readonly string[]).includes(hostname)) return true;
    if (hostname.endsWith('.realsyncdynamics-ai.pages.dev')) return true;
    if (hostname === 'localhost' || hostname === '127.0.0.1') return true;
    return false;
  } catch {
    return false;
  }
}

export function readCookie(header: string | null, name: string): string | null {
  if (!header) return null;
  for (const part of header.split(';')) {
    const trimmed = part.trim();
    const eq = trimmed.indexOf('=');
    if (eq <= 0) continue;
    if (trimmed.slice(0, eq) === name) return trimmed.slice(eq + 1);
  }
  return null;
}

export function tokensMatch(a: string, b: string): boolean {
  if (a.length === 0 || a.length !== b.length) return false;
  let acc = 0;
  for (let i = 0; i < a.length; i++) acc |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return acc === 0;
}

export function mintCsrfToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

export function csrfSetCookie(token: string): string {
  return `${CSRF_COOKIE}=${token}; Path=/; Secure; SameSite=Strict; Max-Age=43200`;
}

/**
 * Guard für mutierende Requests. Ohne Cookie-Header: durchlassen (Bearer/curl).
 */
export function evaluateCsrf(req: { method: string; headers: { get(name: string): string | null } }): CsrfResult {
  if (SAFE.has(req.method.toUpperCase())) return { ok: true };

  const cookie = req.headers.get('cookie') ?? req.headers.get('Cookie');
  const origin = req.headers.get('origin') ?? req.headers.get('Origin');
  const referer = req.headers.get('referer') ?? req.headers.get('Referer');

  if (!cookie) {
    if (origin && !originHostAllowed(origin)) return { ok: false, status: 403, code: 'CSRF_ORIGIN' };
    return { ok: true };
  }

  const originOrRef = origin || (referer ? originFromReferer(referer) : null);
  if (!originOrRef || !originHostAllowed(originOrRef)) {
    return { ok: false, status: 403, code: 'CSRF_ORIGIN' };
  }

  const fromCookie = readCookie(cookie, CSRF_COOKIE);
  if (!fromCookie) return { ok: true };

  const header = req.headers.get(CSRF_HEADER) ?? req.headers.get('X-CSRF-Token');
  if (!header || !tokensMatch(fromCookie, header)) {
    return { ok: false, status: 403, code: 'CSRF_TOKEN' };
  }
  return { ok: true };
}

function originFromReferer(referer: string): string | null {
  try {
    return new URL(referer).origin;
  } catch {
    return null;
  }
}

/** Nur same-origin: sonst würde ein Extra-Header das Supabase-CORS-Preflight sprengen. */
export function csrfHeadersFor(url: string, cookieHeader?: string | null): Record<string, string> {
  if (typeof window === 'undefined') return {};
  let target: URL;
  try {
    target = new URL(url, window.location.origin);
  } catch {
    return {};
  }
  if (target.origin !== window.location.origin) return {};
  const token = readCookie(cookieHeader ?? document.cookie, CSRF_COOKIE);
  if (!token) return {};
  return { [CSRF_HEADER]: token };
}

export async function ensureCsrfCookie(): Promise<string | null> {
  if (typeof window === 'undefined') return null;
  const existing = readCookie(document.cookie, CSRF_COOKIE);
  if (existing) return existing;
  try {
    const resp = await fetch('/csrf', { method: 'GET', credentials: 'same-origin', cache: 'no-store' });
    if (!resp.ok) return null;
    const body = (await resp.json()) as { token?: string };
    return typeof body.token === 'string' ? body.token : readCookie(document.cookie, CSRF_COOKIE);
  } catch {
    return null;
  }
}
