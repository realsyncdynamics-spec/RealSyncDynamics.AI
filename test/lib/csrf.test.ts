import { describe, expect, it } from 'vitest';
import {
  CSRF_COOKIE,
  CSRF_HEADER,
  csrfSetCookie,
  evaluateCsrf,
  mintCsrfToken,
  originHostAllowed,
  readCookie,
  tokensMatch,
} from '../../src/lib/csrf';

function req(init: { method?: string; origin?: string | null; cookie?: string | null; csrf?: string | null }) {
  const headers = new Headers();
  if (init.origin) headers.set('origin', init.origin);
  if (init.cookie) headers.set('cookie', init.cookie);
  if (init.csrf) headers.set(CSRF_HEADER, init.csrf);
  return { method: init.method ?? 'POST', headers };
}

describe('originHostAllowed', () => {
  it('allows production and preview pages', () => {
    expect(originHostAllowed('https://realsyncdynamicsai.de')).toBe(true);
    expect(originHostAllowed('https://www.realsyncdynamicsai.de')).toBe(true);
    expect(originHostAllowed('https://fix-x.realsyncdynamics-ai.pages.dev')).toBe(true);
  });

  it('rejects other hosts and http on the apex', () => {
    expect(originHostAllowed('https://evil.example')).toBe(false);
    expect(originHostAllowed('http://realsyncdynamicsai.de')).toBe(false);
    expect(originHostAllowed('https://pages.dev')).toBe(false);
  });
});

describe('evaluateCsrf', () => {
  it('lets safe methods through', () => {
    expect(evaluateCsrf(req({ method: 'GET', origin: 'https://evil.example' })).ok).toBe(true);
  });

  it('lets bearer/curl POST without cookies through', () => {
    expect(evaluateCsrf(req({ method: 'POST' })).ok).toBe(true);
  });

  it('rejects cross-origin POST with cookies and no matching origin', () => {
    const v = evaluateCsrf(req({ cookie: 'consent=1', origin: 'https://evil.example' }));
    expect(v.ok).toBe(false);
    if (!v.ok) expect(v.code).toBe('CSRF_ORIGIN');
  });

  it('rejects cookie POST without origin', () => {
    const v = evaluateCsrf(req({ cookie: 'consent=1' }));
    expect(v.ok).toBe(false);
    if (!v.ok) expect(v.code).toBe('CSRF_ORIGIN');
  });

  it('allows same-origin POST with only non-csrf cookies', () => {
    expect(evaluateCsrf(req({ cookie: 'realsync.cookie-consent.v1=x', origin: 'https://realsyncdynamicsai.de' })).ok).toBe(true);
  });

  it('requires header when rsd_csrf is set', () => {
    const token = 'a'.repeat(32);
    const missing = evaluateCsrf(req({
      cookie: `${CSRF_COOKIE}=${token}`,
      origin: 'https://realsyncdynamicsai.de',
    }));
    expect(missing.ok).toBe(false);
    if (!missing.ok) expect(missing.code).toBe('CSRF_TOKEN');

    const ok = evaluateCsrf(req({
      cookie: `${CSRF_COOKIE}=${token}`,
      origin: 'https://realsyncdynamicsai.de',
      csrf: token,
    }));
    expect(ok.ok).toBe(true);
  });

  it('does not accept a truncated token', () => {
    const token = mintCsrfToken();
    expect(tokensMatch(token, token.slice(1))).toBe(false);
  });
});

describe('cookie helpers', () => {
  it('parses and formats the csrf cookie', () => {
    const token = 'tok_value';
    expect(readCookie(csrfSetCookie(token), CSRF_COOKIE)).toBe(token);
    expect(csrfSetCookie(token)).toContain('SameSite=Strict');
    expect(csrfSetCookie(token)).toContain('Secure');
    expect(csrfSetCookie(token)).not.toMatch(/httponly/i);
  });
});
