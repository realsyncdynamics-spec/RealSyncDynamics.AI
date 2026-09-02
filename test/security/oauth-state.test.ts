// Der OAuth-`state` muss aus einer kryptografischen Quelle stammen.
//
// `IntegrationSettings.tsx` startet zwei echte OAuth-Flows — Stripe Connect
// und Google Analytics. Der `state`-Parameter ist dort die CSRF-Absicherung:
// Er wird in `sessionStorage` hinterlegt und beim Rücksprung verglichen. Ist
// er vorhersagbar, lässt sich der Rücksprung fälschen und ein fremdes Konto
// mit dem Mandanten verknüpfen.
//
// Vorher stand an beiden Stellen:
//
//     const state = Math.random().toString(36).substring(7);
//
// Zwei Mängel auf einmal. `Math.random()` ist kein CSPRNG — der interne
// Zustand lässt sich aus Ausgaben rekonstruieren. Und `.substring(7)` lässt
// vom Base36-String kaum etwas übrig: über 20.000 Ziehungen gemessen
// zwischen 3 und 9 Zeichen (Beispiele: wqvl4, o3d2s8, uscing).
//
// Geprüft wird die Bauform, nicht das Verhalten: `oauthState` ist bewusst
// modul-lokal, und der Flow endet in `window.location.href` — beides lässt
// sich im Test nicht sinnvoll ausführen.

import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const ROOT = resolve(__dirname, '../..');
const FILE = 'src/features/seo-marketing-dashboard/IntegrationSettings.tsx';
const source = readFileSync(resolve(ROOT, FILE), 'utf-8');

/** Quelltext ohne Kommentare — der erklärende Kommentar nennt `Math.random`. */
const code = source
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .split('\n')
  .map((line) => line.replace(/\/\/.*$/, ''))
  .join('\n');

describe('OAuth-state in IntegrationSettings', () => {
  it('nutzt kein Math.random', () => {
    expect(code).not.toContain('Math.random');
  });

  it('zieht den Zufall aus getRandomValues', () => {
    expect(code).toContain('getRandomValues');
  });

  it('bricht ab, statt auf schwachen Zufall auszuweichen', () => {
    // Ein Rückfall waere hier schlimmer als ein Abbruch: Er saehe aus wie
    // ein funktionierender Flow und waere doch ungesichert.
    const helper = /function oauthState[\s\S]*?\n}/.exec(code)?.[0] ?? '';
    expect(helper, 'oauthState nicht gefunden').not.toBe('');
    expect(helper).toContain('throw new Error');
    expect(helper).not.toContain('Math.random');
  });

  it('liefert mindestens 32 Zeichen', () => {
    // Hex-Kodierung ergibt zwei Zeichen je Byte, also mindestens 16 Bytes.
    const bytes = Number(/function oauthState\(byteLength = (\d+)\)/.exec(code)?.[1] ?? 0);
    expect(bytes, 'Voreingestellte Byte-Zahl nicht gefunden').toBeGreaterThanOrEqual(16);
    expect(code).toContain("padStart(2, '0')");
  });

  it('nutzt den Helfer in beiden OAuth-Pfaden', () => {
    // Stripe Connect und Google Analytics — beide, nicht nur einer.
    expect(code.match(/const state = oauthState\(\)/g) ?? []).toHaveLength(2);
    expect(code).toContain('stripe_oauth_state');
    expect(code).toContain('ga_oauth_state');
  });
});
