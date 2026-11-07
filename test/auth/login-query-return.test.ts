import { beforeEach, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  LOGIN_RETURN_TTL_MS,
  clearLoginReturn,
  consumeLoginReturn,
  rememberLoginReturn,
  validLoginReturn,
} from '../../src/lib/loginReturn';

beforeEach(() => window.localStorage.clear());

describe('short-lived /login return target', () => {
  it('stores only a safe same-origin next and consumes it once', () => {
    rememberLoginReturn('/app/dashboard?plan=starter', 1_000);
    expect(consumeLoginReturn(1_001)).toBe('/app/dashboard?plan=starter');
    expect(consumeLoginReturn(1_002)).toBeNull();
  });

  it('works with percent-encoded next supplied by an external 302', () => {
    const next = new URLSearchParams('utm_source=probe&next=%2Fapp%2Fdashboard').get('next');
    rememberLoginReturn(next, 1_000);
    expect(consumeLoginReturn(1_001)).toBe('/app/dashboard');
  });

  it('does not save UTM-only sign-ins or reuse a previous next', () => {
    rememberLoginReturn('/checkout/starter', 1_000);
    rememberLoginReturn(new URLSearchParams('utm_source=probe').get('next'), 1_001);
    expect(consumeLoginReturn(1_002)).toBeNull();
  });

  it('expires at 30 minutes even if the magic link remains valid', () => {
    rememberLoginReturn('/app/dashboard', 1_000);
    expect(consumeLoginReturn(1_000 + LOGIN_RETURN_TTL_MS)).toBeNull();
  });

  it('accepts a target shortly before expiry', () => {
    rememberLoginReturn('/app/activation', 1_000);
    expect(consumeLoginReturn(1_000 + LOGIN_RETURN_TTL_MS - 1)).toBe('/app/activation');
  });

  it('rejects external, protocol-relative, encoded slash and backslash redirects', () => {
    const invalid = [
      'https://evil.example', '//evil.example/path', 'javascript:alert(1)',
      '/\\evil.example', '/%5Cevil.example', '/%2F%2Fevil.example',
      '/%0A//evil.example', '/%incomplete',
    ];
    for (const path of invalid) {
      expect(validLoginReturn(path), path).toBeNull();
      rememberLoginReturn(path, 1_000);
      expect(consumeLoginReturn(1_001), path).toBeNull();
    }
  });

  it('rejects malformed, future-dated and stale persisted records', () => {
    window.localStorage.setItem('rsd:login-next:v1', '{broken');
    expect(consumeLoginReturn(100)).toBeNull();
    window.localStorage.setItem(
      'rsd:login-next:v1',
      JSON.stringify({ path: '/app/dashboard', expiresAt: 100 + LOGIN_RETURN_TTL_MS + 1 }),
    );
    expect(consumeLoginReturn(100)).toBeNull();
    window.localStorage.setItem(
      'rsd:login-next:v1',
      JSON.stringify({ path: '/app/dashboard', expiresAt: 100 }),
    );
    expect(consumeLoginReturn(100)).toBeNull();
  });

  it('can clear an abandoned login return explicitly', () => {
    rememberLoginReturn('/app/dashboard', 1_000);
    clearLoginReturn();
    expect(consumeLoginReturn(1_001)).toBeNull();
  });
});

describe('auth callback contracts', () => {
  const page = readFileSync(resolve('src/pages/LoginPage.tsx'), 'utf8');
  const oauth = readFileSync(resolve('src/features/auth/OAuthProviderButtons.tsx'), 'utf8');
  const welcome = readFileSync(resolve('src/pages/Welcome.tsx'), 'utf8');

  it('always sends Magic Link to an exact /welcome callback, without query', () => {
    expect(page).toMatch(/emailRedirectTo:\s*`\$\{window\.location\.origin\}\/welcome`/);
    expect(page).not.toMatch(/emailRedirectTo:\s*`\$\{window\.location\.origin\}\$\{welcomePath\}`/);
    expect(page).toContain('rememberLoginReturn(safeNext)');
  });

  it('always sends /login Google OAuth to the same exact callback', () => {
    expect(page).toContain('redirectAfterAuthTo="/welcome"');
    expect(page).toContain('onBeforeRedirect={() => rememberLoginReturn(safeNext)}');
    expect(oauth).toContain('onBeforeRedirect?.();');
    expect(oauth).toContain('redirectTo: target');
  });

  it('never lets pending state override an explicit next or Stripe checkout session', () => {
    const resume = welcome.slice(welcome.indexOf('const resumeAfterAuth ='), welcome.indexOf('sb.auth.getSession()'));
    const nextIdx = resume.indexOf('if (nextParam)');
    const checkoutIdx = resume.indexOf('if (sessionId)');
    const storedIdx = resume.indexOf('consumeLoginReturn()');
    expect(nextIdx).toBeGreaterThan(0);
    expect(checkoutIdx).toBeGreaterThan(nextIdx);
    expect(storedIdx).toBeGreaterThan(checkoutIdx);
    expect(resume).toContain('clearLoginReturn()');
    expect(welcome).toContain('let resumed = false;');
    expect(resume).toContain('if (cancelled || resumed) return;');
  });

  it('preserves the existing tenant activation and dashboard fallback', () => {
    expect(welcome).toContain("navigate('/app/activation'");
    expect(welcome).toContain("navigate('/app/dashboard'");
    expect(welcome).toContain('isPostCheckoutWizard');
    expect(welcome).toContain('claimPendingAudit()');
  });
});
