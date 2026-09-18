import { describe, expect, it } from 'vitest';
import {
  AUTH_URL_SECRET_PARAMS,
  SPA_AUTH_OPTIONS,
  redactAuthInUrl,
  stripSensitiveAuthFromLocation,
} from '../../src/lib/auth-session';

describe('SPA auth options', () => {
  it('forces PKCE and keeps session persistence + refresh', () => {
    expect(SPA_AUTH_OPTIONS.flowType).toBe('pkce');
    expect(SPA_AUTH_OPTIONS.persistSession).toBe(true);
    expect(SPA_AUTH_OPTIONS.autoRefreshToken).toBe(true);
    expect(SPA_AUTH_OPTIONS.detectSessionInUrl).toBe(true);
  });
});

describe('stripSensitiveAuthFromLocation', () => {
  it('is a no-op when nothing sensitive is present', () => {
    const replaced: string[] = [];
    const out = stripSensitiveAuthFromLocation(
      { pathname: '/welcome', search: '?next=/app', hash: '' },
      (url) => replaced.push(url),
    );
    expect(out).toBeNull();
    expect(replaced).toEqual([]);
  });

  it('drops implicit hash tokens and PKCE code without touching next=', () => {
    const replaced: string[] = [];
    const out = stripSensitiveAuthFromLocation(
      {
        pathname: '/welcome',
        search: '?code=SECRET&next=/app/dashboard',
        hash: '#access_token=AT&refresh_token=RT&token_type=bearer',
      },
      (url) => replaced.push(url),
    );
    expect(out).toBe('/welcome?next=/app/dashboard');
    expect(replaced).toEqual(['/welcome?next=/app/dashboard']);
  });

  it('does not delete error params used by the welcome page', () => {
    const replaced: string[] = [];
    stripSensitiveAuthFromLocation(
      { pathname: '/welcome', search: '?error=access_denied', hash: '' },
      (url) => replaced.push(url),
    );
    expect(replaced).toEqual([]);
  });
});

describe('redactAuthInUrl', () => {
  it('masks secrets in query and hash', () => {
    const out = redactAuthInUrl(
      'https://realsyncdynamicsai.de/welcome?code=abc#refresh_token=xyz',
    );
    expect(out).toContain('code=%5Bredacted%5D');
    expect(out).toContain('refresh_token=%5Bredacted%5D');
    expect(out).not.toContain('abc');
    expect(out).not.toContain('xyz');
  });

  it('covers the known secret param set', () => {
    expect(AUTH_URL_SECRET_PARAMS).toContain('refresh_token');
    expect(AUTH_URL_SECRET_PARAMS).toContain('access_token');
    expect(AUTH_URL_SECRET_PARAMS).toContain('code');
  });
});
