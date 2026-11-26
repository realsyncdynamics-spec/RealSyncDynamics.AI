/**
 * Regression: Die Auth-Callback-URL ist immer exakt `/welcome` (ohne Query),
 * damit sie zur Supabase-Allowlist passt. `?next=` wird separat gemerkt und auf
 * /welcome wieder aufgenommen; Tracking-Parameter gehen nie in den Rücksprung.
 */
import { afterEach, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  AUTH_RESUME_KEY,
  AUTH_RESUME_TTL_MS,
  authCallbackUrl,
  consumeAuthResumeTarget,
  storeAuthResumeTarget,
} from '../../src/lib/authResumeTarget';

const LOGIN = readFileSync(resolve('src/pages/LoginPage.tsx'), 'utf8');
const WELCOME = readFileSync(resolve('src/pages/Welcome.tsx'), 'utf8');

afterEach(() => {
  window.localStorage.clear();
});

describe('authCallbackUrl', () => {
  it('liefert exakt /welcome ohne Query', () => {
    expect(authCallbackUrl('https://realsyncdynamics-ai.pages.dev')).toBe(
      'https://realsyncdynamics-ai.pages.dev/welcome',
    );
    expect(authCallbackUrl('https://realsyncdynamics-ai.pages.dev/')).toBe(
      'https://realsyncdynamics-ai.pages.dev/welcome',
    );
    expect(authCallbackUrl()).not.toContain('?');
  });
});

describe('storeAuthResumeTarget / consumeAuthResumeTarget', () => {
  it('Standard-Login ohne next: kein Ziel gespeichert', () => {
    expect(storeAuthResumeTarget(null)).toBeNull();
    expect(window.localStorage.getItem(AUTH_RESUME_KEY)).toBeNull();
    expect(consumeAuthResumeTarget()).toBeNull();
  });

  it('?next=/app/dashboard wird gemerkt und genau einmal geliefert', () => {
    expect(storeAuthResumeTarget('/app/dashboard')).toBe('/app/dashboard');
    expect(consumeAuthResumeTarget()).toBe('/app/dashboard');
    expect(consumeAuthResumeTarget()).toBeNull();
  });

  it('behält interne Query im Ziel (z. B. Checkout-Plan)', () => {
    storeAuthResumeTarget('/checkout/starter?plan=starter');
    expect(consumeAuthResumeTarget()).toBe('/checkout/starter?plan=starter');
  });

  it('lehnt externe Ziele ab (kein offener Redirect)', () => {
    for (const bad of ['https://evil.example', '//evil.example', 'javascript:alert(1)', '']) {
      expect(storeAuthResumeTarget(bad)).toBeNull();
      expect(consumeAuthResumeTarget()).toBeNull();
    }
  });

  it('ein ungültiges next löscht ein altes gültiges Ziel', () => {
    storeAuthResumeTarget('/app/dashboard');
    storeAuthResumeTarget('https://evil.example');
    expect(consumeAuthResumeTarget()).toBeNull();
  });

  it('abgelaufene Einträge werden verworfen', () => {
    const t0 = 1_000_000;
    storeAuthResumeTarget('/app/dashboard', t0);
    expect(consumeAuthResumeTarget(t0 + AUTH_RESUME_TTL_MS + 1)).toBeNull();
  });

  it('manipulierte Einträge werden nicht ausgeführt', () => {
    window.localStorage.setItem(
      AUTH_RESUME_KEY,
      JSON.stringify({ path: '//evil.example', exp: Date.now() + 60_000 }),
    );
    expect(consumeAuthResumeTarget()).toBeNull();
    window.localStorage.setItem(AUTH_RESUME_KEY, 'kein json');
    expect(consumeAuthResumeTarget()).toBeNull();
  });

  it('speichert nur Pfad und Ablaufzeit, keine Tokens', () => {
    storeAuthResumeTarget('/app/dashboard');
    const stored = JSON.parse(window.localStorage.getItem(AUTH_RESUME_KEY) ?? '{}');
    expect(Object.keys(stored).sort()).toEqual(['exp', 'path']);
  });
});

describe('LoginPage — Callback ohne Query', () => {
  it('Magic Link nutzt die exakte Callback-URL', () => {
    expect(LOGIN).toContain('emailRedirectTo: authCallbackUrl()');
    // Früher: `/welcome${search}` — hängte utm_source & Co. an den Rücksprung.
    expect(LOGIN).not.toMatch(/emailRedirectTo:[^\n]*\$\{search\}/);
    expect(LOGIN).not.toContain('params.toString()');
  });

  it('Google/OAuth kehrt exakt auf /welcome zurück', () => {
    expect(LOGIN).toContain('<OAuthProviderButtons redirectAfterAuthTo="/welcome" />');
  });

  it('merkt ein gültiges next vor dem Login', () => {
    expect(LOGIN).toContain('storeAuthResumeTarget(safeNext)');
  });
});

describe('Welcome — gemerktes Ziel', () => {
  it('gemerktes Ziel wird immer verbraucht; URL-next hat Vorrang, nie im Post-Checkout', () => {
    expect(WELCOME).toContain('const storedNext = consumeAuthResumeTarget();');
    expect(WELCOME).toContain('urlNext ?? (sessionId ? null : storedNext)');
    // Löschen des Eintrags darf nicht von URL-Parametern abhängen (CodeQL).
    expect(WELCOME).not.toMatch(/if \(urlNext\) consumeAuthResumeTarget/);
  });

  it('Checkout- und Aktivierungspfade bleiben unverändert', () => {
    expect(WELCOME).toContain("navigate('/app/activation'");
    expect(WELCOME).toContain('isPostCheckoutWizard');
    expect(WELCOME).toContain('Boolean(sessionId)');
  });
});
