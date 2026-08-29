/**
 * Vertrag zwischen Oberfläche und Backend.
 *
 * Die Regel, die dieser Test durchsetzt: **Kein Bedienelement ohne Backend.**
 * Wer im Frontend eine Edge Function aufruft, die in Produktion nicht läuft,
 * baut eine Sackgasse, die weder `tsc` noch der Build sehen — Function-Namen
 * sind Strings.
 *
 * Der Test ist bewusst zweiseitig:
 *
 *  1. Jeder aufgerufene Slug ist entweder in Produktion **oder** steht mit
 *     Begründung in `UNBACKED_CALLERS`. Ein neuer unbelegter Knopf bricht die
 *     CI, statt still in Produktion zu gehen.
 *  2. Kein Eintrag in `UNBACKED_CALLERS` ist inzwischen deployt. Das ist der
 *     angenehme Fehlschlag: Er erinnert daran, die Notlösung im UI wieder
 *     abzubauen, wenn das Backend nachgezogen ist.
 */

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

import {
  EDGE_FUNCTIONS_OBSERVED_MAX,
  PRODUCTION_EDGE_FUNCTIONS,
  UNBACKED_CALLERS,
  isEdgeFunctionInProduction,
} from '../../src/config/production-edge-functions';

const SRC = resolve(__dirname, '../../src');

/** Nur ausgelieferter Code. Testdateien beschreiben keinen Nutzerpfad. */
const IGNORED_DIR = /(^|\/)(__tests__|__mocks__)$/;
const IGNORED_FILE = /\.(test|spec)\.[tj]sx?$/;

function collectSourceFiles(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      if (!IGNORED_DIR.test(full)) collectSourceFiles(full, out);
      continue;
    }
    if (/\.(ts|tsx)$/.test(entry) && !IGNORED_FILE.test(entry)) out.push(full);
  }
  return out;
}

/**
 * Die drei Aufrufwege, die im Repo tatsächlich vorkommen. Bewusst keine
 * Heuristik über beliebige Strings — sonst wird jedes Wort zum Function-Namen.
 *
 * Der Schrägstrich gehört ins Zeichenraster, seit Functions als **Router**
 * gebaut werden: `invoke('siteos/builder')` spricht den Slot `siteos` an.
 * Ohne ihn hätte die Umstellung auf einen Router jeden Aufruf unsichtbar
 * gemacht — der Scanner hätte nichts mehr gefunden und wäre grün geblieben,
 * also genau das Gegenteil von dem, wofür dieser Test da ist.
 *
 * ## Typargumente gehören mit ins Muster
 *
 * `postEdgeFunction` ist generisch, und die meisten Aufrufer nutzen das:
 * `postEdgeFunction<ScanResponse>('public-site-scan', …)`. Ein Muster, das
 * unmittelbar auf die Klammer zielt, übersieht genau diese Form — am
 * 2026-08-23 waren das 8 von 11 Aufrufstellen in `src/`. Der Scanner fand
 * damit nur die Minderheit und blieb trotzdem grün: derselbe Fehlertyp, den
 * der Router-Fall oben beschreibt, nur eine Ebene früher.
 */
const CALL_PATTERNS: readonly RegExp[] = [
  /functions\.invoke\s*(?:<[^()]*>)?\(\s*['"]([a-z0-9/-]+)['"]/g,
  /(?:postEdgeFunction|getEdgeFunction|callEdgeFunction|invokeFunction)\s*(?:<[^()]*>)?\(\s*['"]([a-z0-9/-]+)['"]/g,
  /\/functions\/v1\/([a-z0-9/-]+)/g,
];

/**
 * Vom Aufrufpfad auf den Slot, der bezahlt wird.
 *
 * Gezählt werden Slots, nicht Endpunkte: `siteos/builder` und
 * `siteos/discover` kosten zusammen einen. Verglichen wird deshalb das erste
 * Segment.
 */
function slotOf(callPath: string): string {
  return callPath.split('/')[0];
}

interface Call {
  slug: string;
  file: string;
}

function collectCalls(): Call[] {
  const calls: Call[] = [];
  for (const file of collectSourceFiles(SRC)) {
    const content = readFileSync(file, 'utf8');
    for (const pattern of CALL_PATTERNS) {
      // Fabrik statt geteilter Instanz: `lastIndex` von /g-Regexen ist Zustand.
      const re = new RegExp(pattern.source, pattern.flags);
      let match: RegExpExecArray | null;
      while ((match = re.exec(content)) !== null) {
        calls.push({ slug: slotOf(match[1]), file: file.slice(SRC.length + 1) });
      }
    }
  }
  return calls;
}

const CALLS = collectCalls();
const CALLED_SLUGS = [...new Set(CALLS.map((c) => c.slug))].sort();

describe('Edge-Function-Vertrag: Oberfläche gegen Produktion', () => {
  it('findet überhaupt Aufrufe (Scanner nicht kaputt)', () => {
    // Ohne diese Zusicherung wäre ein defekter Scanner ein grüner Test.
    expect(CALLED_SLUGS.length).toBeGreaterThan(50);
  });

  it('hält Liste und beobachteten Höchststand beieinander', () => {
    // Früher stand hier `<= EDGE_FUNCTION_PLAN_LIMIT` (100) — eine Schranke,
    // die am 2026-08-19 fiel: Function 101 (`siteos`) deployte ohne 402. Ein
    // „kleiner-gleich" gegen eine erfundene Obergrenze prüft nichts; ein
    // „gleich" gegen den zuletzt gemessenen Stand schon. Wer neu misst,
    // zieht beide Zahlen mit — sonst beschreibt die Datei einen Stand, den
    // es nicht mehr gibt.
    expect(PRODUCTION_EDGE_FUNCTIONS.length).toBe(EDGE_FUNCTIONS_OBSERVED_MAX);
  });

  it('führt die Produktionsliste doppelfrei und sortiert', () => {
    const sorted = [...PRODUCTION_EDGE_FUNCTIONS].sort();
    expect(PRODUCTION_EDGE_FUNCTIONS).toEqual(sorted);
    expect(new Set(PRODUCTION_EDGE_FUNCTIONS).size).toBe(PRODUCTION_EDGE_FUNCTIONS.length);
  });

  it('kennt jeden aufgerufenen Slug — deployt oder ausdrücklich als unbelegt vermerkt', () => {
    const known = new Set([
      ...PRODUCTION_EDGE_FUNCTIONS,
      ...UNBACKED_CALLERS.map((c) => c.slug),
    ]);

    const surprises = CALLS.filter((c) => !known.has(c.slug));
    const detail = [...new Set(surprises.map((c) => `${c.slug}  ←  ${c.file}`))].sort();

    expect(
      detail,
      'Neuer Aufruf einer Function, die weder in Produktion läuft noch in ' +
        'UNBACKED_CALLERS steht. Entweder deployen oder dort mit Oberfläche ' +
        'eintragen — ein Knopf ohne Backend geht nicht still in Produktion.'
    ).toEqual([]);
  });

  it('meldet Einträge in UNBACKED_CALLERS, die inzwischen deployt sind', () => {
    const resolved = UNBACKED_CALLERS.filter((c) => isEdgeFunctionInProduction(c.slug)).map(
      (c) => `${c.slug} (${c.surface})`
    );

    expect(
      resolved,
      'Diese Functions laufen inzwischen in Produktion. Eintrag aus ' +
        'UNBACKED_CALLERS entfernen und den Hinweis im UI abbauen.'
    ).toEqual([]);
  });

  it('hält UNBACKED_CALLERS frei von Karteileichen ohne Aufrufer', () => {
    const called = new Set(CALLED_SLUGS);
    const orphans = UNBACKED_CALLERS.filter((c) => !called.has(c.slug)).map((c) => c.slug);

    expect(
      orphans,
      'Kein Aufrufer mehr im Frontend — Eintrag entfernen, sonst beschreibt ' +
        'die Liste einen Zustand, den es nicht gibt.'
    ).toEqual([]);
  });

  it('beschreibt jeden unbelegten Aufruf vollständig', () => {
    for (const caller of UNBACKED_CALLERS) {
      expect(caller.slug, 'Slug fehlt').toMatch(/^[a-z0-9-]+$/);
      expect(caller.surface.length, `${caller.slug}: Oberfläche zu knapp`).toBeGreaterThan(8);
    }
  });
});

describe('Öffentlicher Trichter', () => {
  const publicUnbacked = UNBACKED_CALLERS.filter((c) => c.publicPath);

  it('kennzeichnet öffentliche Sackgassen als solche', () => {
    // Kein Grenzwert, sondern eine Zusicherung: Die öffentlichen Fälle sind
    // benannt. Wer sie behebt, entfernt hier Zeilen — das ist der Fortschritt.
    expect(publicUnbacked.every((c) => c.surface.length > 0)).toBe(true);
  });
});
