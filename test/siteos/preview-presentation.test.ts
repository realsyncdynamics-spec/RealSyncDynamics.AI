// Jede Vorschau rendert `showcase` — geprueft am Quelltext.
//
// ## Warum es diese Pruefung gibt
//
// `renderSite()` hat den Default `presentation: 'minimal'`, und der ist
// richtig so: Das Kern-Stylesheet ist byte-stabil und Grundlage der
// Artefakt-Hashes. Wer die Stufe nicht angibt, bekommt also stillschweigend
// ein Dokument mit Kontrast, Zeilenlaenge und Fokus — aber ohne Layout,
// Raster und Karten.
//
// Fuer ein Artefakt ist das gewollt. Fuer eine Vorschau ist es ein Fehler,
// und zwar ein unsichtbarer: Der Aufruf ist syntaktisch einwandfrei, die
// Typen stimmen, die Tests liefen gruen. Sichtbar wird er erst dort, wo ein
// Besucher unter der Ueberschrift „So kann Ihre Website aussehen" ein rohes
// HTML-Dokument sieht — graue Platzhalterflaeche, blau unterstrichene Links,
// eine 72ch-Textspalte. Genau das lief in Produktion.
//
// Verschaerfend: Der Vorlagenwechsler ueber der Vorschau tauscht nur
// Farb-Tokens (`applySiteDesignTemplate`). Ohne Layoutschicht gibt es nichts,
// worauf die wirken koennten — die Auswahl sieht bedienbar aus und tut fast
// nichts.
//
// Bauart wie die uebrigen Ehrlichkeits-Pruefungen im Repo
// (test/siteos/publish-gate-ui.test.ts): Der Unterschied steht im Quelltext,
// also wird er dort geprueft. Ein Render-Test wuerde ihn nicht fangen —
// ungestyltes HTML rendert genauso fehlerfrei wie gestyltes.

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';

const repoRoot = resolve(__dirname, '../..');

/**
 * Oberflaechen, die eine Vorschau *anzeigen*. Bewusst eine Liste und kein
 * Verzeichnis-Scan: Eine neue Vorschau-Seite soll hier eingetragen werden
 * muessen. Wer sie vergisst, faellt beim naechsten Blick auf die Liste auf —
 * ein Scan haette sie stillschweigend uebersehen.
 */
const PREVIEW_SURFACES = [
  'src/pages/WebsiteTransformationFlow.tsx',
  'src/unified-entry/pages/PreviewSelectionPage.tsx',
  'src/unified-entry/pages/DashboardPreviewPage.tsx',
  'src/unified-entry/pages/BuildStudioPage.tsx',
  'supabase/functions/siteos/preview.ts',
] as const;

/** Findet jeden `renderSite(...)`-Aufruf samt seinem Optionen-Objekt. */
function renderSiteCalls(source: string): string[] {
  const calls: string[] = [];
  const needle = 'renderSite(';

  for (let index = source.indexOf(needle); index !== -1; index = source.indexOf(needle, index + 1)) {
    // Klammern zaehlen statt Regex: Die Aufrufe enthalten verschachtelte
    // Aufrufe (`applySiteDesignTemplate(...)`) und Objektliterale, an denen
    // ein nicht-gieriger Ausdruck zu frueh abbricht.
    let depth = 0;
    let end = index + needle.length - 1;
    for (; end < source.length; end += 1) {
      if (source[end] === '(') depth += 1;
      else if (source[end] === ')') {
        depth -= 1;
        if (depth === 0) break;
      }
    }
    calls.push(source.slice(index, end + 1));
  }

  return calls;
}

describe('Vorschau-Rendering — Layoutschicht', () => {
  it.each(PREVIEW_SURFACES)('%s rendert jede Vorschau mit presentation: showcase', (file) => {
    const source = readFileSync(resolve(repoRoot, file), 'utf8');
    const calls = renderSiteCalls(source);

    // Ohne diese Zusicherung wuerde die Pruefung gruen, sobald jemand den
    // Aufruf umbenennt oder verschiebt — sie haette dann nichts mehr zu
    // pruefen und wuerde das nicht merken.
    expect(calls.length).toBeGreaterThan(0);

    for (const call of calls) {
      expect(call).toMatch(/presentation:\s*'showcase'/);
    }
  });

  it('kennt alle Oberflaechen, die renderSite aufrufen', () => {
    // Faengt den Fall, den die Liste allein nicht faengt: eine neue
    // Vorschau-Seite, die niemand eingetragen hat. `deploy/artifact.ts`
    // reicht die Stufe durch, statt sie zu setzen, und ist deshalb
    // ausgenommen — dort ist `minimal` der richtige Default.
    const known = new Set<string>([...PREVIEW_SURFACES, 'packages/siteos-core/src/deploy/artifact.ts']);

    const found = execFileSync('git', ['grep', '-l', 'renderSite(', '--', '*.ts', '*.tsx', ':!*.test.ts', ':!*.test.tsx'], {
      cwd: repoRoot,
      encoding: 'utf8',
    })
      .split('\n')
      .filter(Boolean)
      // Die Definition selbst und ihr eigener Test zaehlen nicht.
      .filter((path) => path !== 'packages/siteos-core/src/render/renderer.ts');

    expect(found.filter((path) => !known.has(path))).toEqual([]);
  });
});
