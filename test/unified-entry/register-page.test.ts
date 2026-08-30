/**
 * Schritt 3 des Registrierungstrichters: `/unified-entry/register`.
 *
 * ## Zwei Befunde vom 2026-08-29
 *
 * **Die Seite rief zum Registrieren `login()` auf.** Der Kommentar daneben
 * behauptete „login will also register if needed" — das stimmt nicht:
 * `signInWithPassword` legt kein Konto an. Ein neuer Besucher bekam auf einer
 * Seite mit der Überschrift „Konto erstellen" die Meldung „Invalid login
 * credentials". Die richtige Funktion (`register`) lag im selben Context und
 * wurde nur von `/optimizer/auth` benutzt.
 *
 * **Der einzige funktionierende Weg fehlte.** Gegen die Live-Instanz gemessen:
 *
 *   POST /auth/v1/signup              400  email_provider_disabled
 *   POST /auth/v1/token?grant_type=…  422  email_provider_disabled
 *   POST /auth/v1/otp                 422  otp_disabled
 *   GET  /auth/v1/authorize?provider=google  → accounts.google.com, echte ID
 *
 * E-Mail-Anmeldung, E-Mail-Registrierung und Magic Link sind im Projekt
 * abgeschaltet; Google läuft. Diese Seite bot ausschließlich E-Mail an — also
 * ausschließlich den Weg, der nicht geht, während die Anbieter-Komponente im
 * Repo lag und auf drei anderen Seiten schon eingebunden war.
 *
 * Geprüft wird am Quelltext: Die Seite ist ohne laufende Supabase-Instanz
 * nicht sinnvoll auszuführen, und genau diese Eigenschaften sollen beim
 * nächsten Umbau nicht still verlorengehen.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const source = readFileSync(
  resolve(__dirname, '../../src/unified-entry/pages/RegisterPage.tsx'),
  'utf8'
);

/** Ohne Kommentare — dort steht die Begründung, nicht der Verstoß. */
const code = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

describe('Registrierung legt ein Konto an', () => {
  it('ruft register(), nicht login()', () => {
    expect(code).toContain('await register(');
    expect(
      code,
      'signInWithPassword erstellt kein Konto — auf einer Seite „Konto erstellen" ist das der falsche Aufruf.'
    ).not.toContain('await login(');
  });

  it('zieht register aus dem Auth-Context', () => {
    expect(code).toMatch(/const\s*\{[^}]*\bregister\b[^}]*\}\s*=\s*useSupabaseAuth\(\)/);
  });
});

describe('Der funktionierende Weg steht zur Wahl', () => {
  it('bietet die Anbieter-Anmeldung an', () => {
    expect(code).toContain('OAuthProviderButtons');
  });

  it('führt nach der Anmeldung in den nächsten Trichterschritt', () => {
    expect(code).toContain("redirectAfterAuthTo=\"/unified-entry/onboarding\"");
  });

  it('baut keine eigene Anbieter-Liste', () => {
    // Zweite Liste = zweite Wahrheit. Die Flag-Steuerung der Komponente
    // (nur eingerichtete Anbieter sichtbar) griffe hier sonst nicht.
    for (const own of ['signInWithOAuth', "'github'", "'azure'", "'google'"]) {
      expect(code).not.toContain(own);
    }
  });

  it('trennt Anbieter und Formular sichtbar', () => {
    expect(code).toContain('oder mit E-Mail');
  });
});

describe('Fehler benennen die Ursache', () => {
  it('übersetzt den abgeschalteten E-Mail-Anbieter', () => {
    // Der Rohtext „Email signups are disabled" stand als Fehlermeldung unter
    // einem deutschen Formular — das liest sich wie ein Eingabefehler des
    // Besuchers, ist aber eine Projekteinstellung.
    expect(code).toContain('email_provider_disabled');
    expect(code).toContain('otp_disabled');
    expect(code).toContain('explainAuthError');
  });

  it('nennt den Weg, der funktioniert', () => {
    expect(source).toContain('Anmeldung über einen Anbieter');
  });

  it('reicht unbekannte Fehler unverändert durch', () => {
    // Alles wegzuübersetzen wäre der nächste Fehler: Ein echter Fehlschlag
    // muss lesbar bleiben, sonst debuggt ihn niemand.
    expect(code).toMatch(/return raw \|\|/);
  });
});
