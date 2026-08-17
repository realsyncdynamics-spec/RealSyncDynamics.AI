/**
 * Wächter für die Hero-Headline-Invariante.
 *
 * FE-001 („Startseite lädt ohne Fehler") ist zwischen dem 13.08. und dem
 * 17.08. neunmal auf `main` gebrochen — immer über denselben Mechanismus:
 *
 *   1. Jemand baut die Landing um und schreibt die H1 hart ins JSX.
 *   2. hero-content.ts verliert damit seinen Produktions-Konsumenten und
 *      speist nur noch die Tests.
 *   3. FE-001 prüft gegen eine Headline, die die Seite nie rendert.
 *   4. `main` ist rot, und der Fehlschlag zeigt auf den Test statt auf die
 *      Ursache.
 *
 * Der Kommentar in hero-content.ts warnt davor — dreimal wirkungslos, weil
 * ein Kommentar nichts erzwingt. Diese Tests tun es. Sie brauchen weder
 * Browser noch Server und laufen in `npm test`, also lange bevor die
 * E2E-Suite überhaupt startet. Ein Fehlschlag hier nennt die Ursache
 * direkt statt eines nicht gefundenen Locators.
 */

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = resolve(__dirname, '../..');
const SRC = join(ROOT, 'src');

/** Alle .ts/.tsx unterhalb von src/ — das ist der Produktionscode. */
function sourceFiles(dir: string, acc: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) sourceFiles(full, acc);
    else if (/\.tsx?$/.test(entry)) acc.push(full);
  }
  return acc;
}

const HERO_CONTENT = join(SRC, 'components/governance-frontend/hero-content.ts');

describe('Hero-Headline — Single Source of Truth', () => {
  it('hero-content.ts hat mindestens einen Konsumenten im Produktionscode', () => {
    const consumers = sourceFiles(SRC)
      .filter((f) => f !== HERO_CONTENT)
      .filter((f) => /from\s+['"][^'"]*hero-content['"]/.test(readFileSync(f, 'utf8')))
      .map((f) => f.slice(ROOT.length + 1));

    expect(
      consumers,
      'hero-content.ts nennt sich Single Source of Truth der H1, wird aber von ' +
        'keinem Produktionscode importiert — nur noch von Tests. Damit prüft ' +
        'FE-001 gegen eine Headline, die die Seite nicht rendert. Die H1 der ' +
        'Startseite muss aus HERO_HEADLINE rendern.',
    ).not.toHaveLength(0);
  });

  it('die Startseite rendert ihre H1 aus HERO_HEADLINE, nicht hartkodiert', () => {
    // Die Route "/" wird in App.tsx gebunden; welche Komponente das ist, lesen
    // wir dort ab, statt einen Dateinamen zu raten — sonst prüft der Test nach
    // dem nächsten Umbau die falsche Datei und wiegt in Sicherheit.
    const app = readFileSync(join(SRC, 'App.tsx'), 'utf8');
    const route = app.match(/<Route\s+path="\/"\s+element=\{<(\w+)\s*\/>\}/);
    expect(route, 'Route path="/" in App.tsx nicht gefunden').not.toBeNull();

    const component = route![1];
    const importLine = app.match(
      new RegExp(`import\\s+\\{[^}]*\\b${component}\\b[^}]*\\}\\s+from\\s+['"]([^'"]+)['"]`),
    );
    expect(importLine, `Import von ${component} in App.tsx nicht gefunden`).not.toBeNull();

    const landing = join(SRC, importLine![1].replace(/^\.\//, '') + '.tsx');
    const source = readFileSync(landing, 'utf8');

    const h1 = source.match(/<h1[\s\S]*?<\/h1>/);
    expect(h1, `Kein <h1> in ${landing.slice(ROOT.length + 1)}`).not.toBeNull();

    expect(
      h1![0],
      `Die H1 in ${landing.slice(ROOT.length + 1)} rendert nicht aus HERO_HEADLINE. ` +
        'Hartkodierte Headlines haben FE-001 neunmal gebrochen — die Headline ' +
        'gehört nach src/components/governance-frontend/hero-content.ts.',
    ).toContain('HERO_HEADLINE');
  });

  it('der Prüf-Substring liegt vollständig in einer Headline-Zeile', async () => {
    // Doppelt gehalten: hero-content.ts wirft beim Import selbst, wenn das
    // verletzt ist. Hier steht es noch einmal als benannter Fall, damit der
    // Grund im Testbericht auftaucht und nicht als Import-Fehler.
    const { HERO_HEADLINE_LINES, HERO_HEADLINE_TEST_SUBSTRING } = await import(
      '@/src/components/governance-frontend/hero-content'
    );
    expect(
      HERO_HEADLINE_LINES.some((line: string) => line.includes(HERO_HEADLINE_TEST_SUBSTRING)),
      `"${HERO_HEADLINE_TEST_SUBSTRING}" kommt in keiner Zeile der HERO_HEADLINE vor`,
    ).toBe(true);
  });
});
