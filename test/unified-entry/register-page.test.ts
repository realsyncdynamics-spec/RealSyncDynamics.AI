/**
 * `/unified-entry/register` — Weiterleitung auf die eine Anmeldung.
 *
 * Bis zum 2026-09-01 trug diese Seite ein eigenes Formular (E-Mail/Passwort
 * plus Anbieter) und schickte danach direkt nach `/unified-entry/onboarding`
 * — vorbei an `/welcome` und damit ohne Audit-Claim, Setup-Assistent und
 * `onboarded_at`-Prüfung. Zwei Anmeldungen, zwei Zustände. Der Eigentümer
 * hat am 2026-09-01 freigegeben, die Registrierung auf `/welcome?next=…` zu
 * legen (CLAUDE.md §10).
 *
 * Was hier geprüft wird: Die Seite ist nur noch eine Weiterleitung, sie
 * verliert den Weg zurück in den Unified-Entry-Pfad nicht, und sie baut
 * keinen zweiten Anmeldeweg auf.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { registerRedirectTarget } from '../../src/unified-entry/pages/RegisterPage';

const source = readFileSync(
  resolve(__dirname, '../../src/unified-entry/pages/RegisterPage.tsx'),
  'utf8',
);
const code = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

describe('registerRedirectTarget', () => {
  it('führt nach /welcome und zurück in den Unified-Entry-Pfad', () => {
    expect(registerRedirectTarget('')).toBe('/welcome?next=%2Funified-entry%2Fonboarding');
  });

  it('behält Abfrageparameter wie plan und track', () => {
    const ziel = registerRedirectTarget('?plan=growth&track=keep_frontend');
    const next = new URLSearchParams(ziel.split('?')[1]).get('next');
    expect(next).toBe('/unified-entry/onboarding?plan=growth&track=keep_frontend');
  });

  it('erzeugt ein next, das die Whitelist auf /welcome passiert', () => {
    // Welcome akzeptiert nur Pfade, die mit `/` beginnen und nicht mit `//`.
    const next = new URLSearchParams(registerRedirectTarget('?x=1').split('?')[1]).get('next')!;
    expect(next.startsWith('/')).toBe(true);
    expect(next.startsWith('//')).toBe(false);
  });

  it('behandelt ein leeres Fragezeichen wie keine Parameter', () => {
    expect(registerRedirectTarget('?')).toBe(registerRedirectTarget(''));
  });
});

describe('Die Seite ist eine Weiterleitung, kein zweiter Anmeldeweg', () => {
  it('rendert Navigate auf /welcome', () => {
    expect(code).toContain('<Navigate to={registerRedirectTarget(search)} replace />');
  });

  it('führt kein eigenes Formular und keine eigene Anbieter-Liste mehr', () => {
    for (const eigen of ['useSupabaseAuth', 'OAuthProviderButtons', 'signInWithOAuth', 'await register(', 'await login(']) {
      expect(code, `${eigen} gehört nach /welcome, nicht hierher`).not.toContain(eigen);
    }
  });
});
