/**
 * Welche Anmelde-Anbieter die Oberfläche zeigen darf.
 *
 * ## Der Befund vom 2026-08-19
 *
 * Am Live-Projekt gemessen, nicht vermutet — `/auth/v1/authorize?provider=…`
 * leitet weiter, und in der Ziel-URL steht die konfigurierte Client-ID:
 *
 *   google    → accounts.google.com          client_id 285969423992-…googleusercontent.com
 *   github    → github.com                   client_id 1036000996285-…googleusercontent.com
 *   azure     → login.microsoftonline.com    client_id 1036000996285-…googleusercontent.com
 *   facebook  → facebook.com                 client_id 1036000996285-…googleusercontent.com
 *
 * Dreimal dieselbe **Google**-Client-ID. Eine Google-ID funktioniert weder bei
 * GitHub noch bei Microsoft — die Buttons führten auf die Fehlerseite des
 * jeweiligen Anbieters. Nur Google trägt eine eigene, echte ID.
 *
 * Bis die Konfiguration in Supabase steht, sind GitHub und Microsoft deshalb
 * **opt-IN**: unsichtbar, sofern nicht ausdrücklich eingeschaltet. Das ist
 * dieselbe Behandlung, die LinkedIn schon hatte.
 *
 * Dieser Test hält die Unterscheidung fest, weil sie sonst beim nächsten
 * Aufräumen als Inkonsistenz „geglättet" wird: Vier Provider, drei davon
 * opt-in — das sieht nach Versehen aus und ist eine Messung.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = (p: string) => resolve(__dirname, '../..', p);

const BUTTONS = readFileSync(root('src/features/auth/OAuthProviderButtons.tsx'), 'utf8');
const AUTH_PAGE = readFileSync(root('src/enterprise-os/pages/AuthPage.tsx'), 'utf8');

/** Ohne Kommentare — dort steht die Begründung, nicht der Verstoß. */
const code = BUTTONS.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

/** Zuordnung Provider → Flag-Funktion aus dem PROVIDER_ENABLED-Block. */
function flagFor(provider: string): string | null {
  const block = /const PROVIDER_ENABLED[^{]*\{([\s\S]*?)\n\};/.exec(code)?.[1];
  if (!block) return null;
  const line = new RegExp(`${provider}:\\s*(flagOn|flagOptIn)\\(`).exec(block);
  return line ? line[1] : null;
}

describe('Sichtbarkeit der Anmelde-Anbieter', () => {
  it('liest den Konfigurationsblock überhaupt', () => {
    // Ohne diese Zusicherung prüfte alles Folgende gegen null.
    expect(flagFor('google')).not.toBeNull();
  });

  it('zeigt Google standardmäßig — der einzige mit echter Client-ID', () => {
    expect(flagFor('google')).toBe('flagOn');
  });

  for (const provider of ['github', 'azure', 'linkedin_oidc']) {
    it(`zeigt ${provider} nur nach ausdrücklicher Freischaltung`, () => {
      expect(
        flagFor(provider),
        `${provider} ist in Supabase nicht mit einer eigenen Client-ID hinterlegt. ` +
          'Mit flagOn erscheint ein Button, der auf eine Fehlerseite des Anbieters führt. ' +
          'Erst die Client-ID eintragen, dann hier auf flagOn stellen — nicht umgekehrt.'
      ).toBe('flagOptIn');
    });
  }

  it('rendert nichts, wenn kein Anbieter übrig bleibt', () => {
    // Eine leere Box mit Trennlinie darüber wäre schlimmer als kein Block.
    expect(code).toContain('if (visibleProviders.length === 0) return null;');
  });

  it('nennt Facebook nicht als Anbieter', () => {
    // Meta-Login auf einer Datenschutz-Plattform ist eine Positionsfrage,
    // keine technische. In Supabase ist der Provider aktiv — hier nicht.
    expect(code).not.toContain("'facebook'");
  });
});

describe('Anmeldeseite /os/login · /os/signup', () => {
  it('bietet die Anbieter-Anmeldung an', () => {
    // Die Komponente lag im Repo und hing an /welcome, Checkout und
    // /optimizer/auth — an der Anmeldeseite selbst fehlte sie.
    expect(AUTH_PAGE).toContain("import { OAuthProviderButtons }");
    expect(AUTH_PAGE).toContain('<OAuthProviderButtons');
  });

  it('trennt Anbieter und Formular sichtbar', () => {
    expect(AUTH_PAGE).toContain('oder mit E-Mail');
  });

  it('baut keine eigene Anbieter-Liste', () => {
    // Zweite Liste = zweite Wahrheit. Die Seite darf die Anbieter nicht
    // selbst aufzählen, sonst greift die Flag-Steuerung dort nicht.
    for (const provider of ['signInWithOAuth', "'github'", "'azure'"]) {
      expect(AUTH_PAGE).not.toContain(provider);
    }
  });
});
