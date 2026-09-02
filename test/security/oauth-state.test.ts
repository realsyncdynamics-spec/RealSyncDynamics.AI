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
//
// Bewusst ohne reguläre Ausdrücke. Die erste Fassung zerlegte den Quelltext
// mit `[\s\S]*?`-Mustern; CodeQL hat das auf PR #1197 als zwei High-Befunde
// gemeldet — ein unbegrenzter Rückverfolgungs-Ausdruck auf Daten aus dem
// Dateisystem. Für das, was hier gebraucht wird, genügt `indexOf`/`slice`:
// gleiche Aussage, kein Rückverfolgen, keine Angriffsfläche.

import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const ROOT = resolve(__dirname, '../..');
const FILE = 'src/features/seo-marketing-dashboard/IntegrationSettings.tsx';
const source = readFileSync(resolve(ROOT, FILE), 'utf-8');

/** Blockkommentare entfernen — ohne Rückverfolgung, rein über `indexOf`. */
function withoutBlockComments(text: string): string {
  let out = '';
  let from = 0;
  for (;;) {
    const open = text.indexOf('/*', from);
    if (open === -1) return out + text.slice(from);
    out += text.slice(from, open);
    const close = text.indexOf('*/', open + 2);
    if (close === -1) return out;
    from = close + 2;
  }
}

/**
 * Quelltext ohne Kommentare.
 *
 * Nötig, weil der erklärende Kommentar am Helfer selbst `Math.random`
 * nennt — ohne diesen Schritt würde die Prüfung am eigenen Kommentar
 * anschlagen statt am Code.
 */
const code = withoutBlockComments(source)
  .split('\n')
  .map((line) => {
    const at = line.indexOf('//');
    return at === -1 ? line : line.slice(0, at);
  })
  .join('\n');

/** Der Rumpf von `oauthState`, von der Signatur bis zur schliessenden Klammer. */
function helperSource(): string {
  const start = code.indexOf('function oauthState');
  if (start === -1) return '';
  const end = code.indexOf('\n}', start);
  return end === -1 ? '' : code.slice(start, end + 2);
}

/** Die voreingestellte Byte-Zahl aus der Signatur, oder 0. */
function defaultByteLength(): number {
  const marker = 'function oauthState(byteLength = ';
  const at = code.indexOf(marker);
  if (at === -1) return 0;
  const close = code.indexOf(')', at + marker.length);
  if (close === -1) return 0;
  return Number(code.slice(at + marker.length, close));
}

describe('OAuth-state in IntegrationSettings', () => {
  it('nutzt kein Math.random', () => {
    expect(code).not.toContain('Math.random');
  });

  it('zieht den Zufall aus getRandomValues', () => {
    expect(code).toContain('getRandomValues');
  });

  it('bricht ab, statt auf schwachen Zufall auszuweichen', () => {
    // Ein Rückfall wäre hier schlimmer als ein Abbruch: Er sähe aus wie ein
    // funktionierender Flow und wäre doch ungesichert.
    const helper = helperSource();
    expect(helper, 'oauthState nicht gefunden').not.toBe('');
    expect(helper).toContain('throw new Error');
    expect(helper).not.toContain('Math.random');
  });

  it('liefert mindestens 32 Zeichen', () => {
    // Hex-Kodierung ergibt zwei Zeichen je Byte, also mindestens 16 Bytes.
    expect(defaultByteLength(), 'Voreingestellte Byte-Zahl nicht gefunden').toBeGreaterThanOrEqual(16);
    expect(code).toContain("padStart(2, '0')");
  });

  it('nutzt den Helfer in beiden OAuth-Pfaden', () => {
    // Stripe Connect und Google Analytics — beide, nicht nur einer.
    expect(code.split('const state = oauthState()').length - 1).toBe(2);
    expect(code).toContain('stripe_oauth_state');
    expect(code).toContain('ga_oauth_state');
  });
});
