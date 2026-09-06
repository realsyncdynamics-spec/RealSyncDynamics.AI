/**
 * Ratsche: Die öffentliche Ebene hat genau einen Akzent.
 *
 * ## Der Zustand, den dieser Test festhält
 *
 * Gemessen am 2026-09-06 im Browser gegen den erzeugten Build: Die
 * Startseite trug 129 Elemente in Champagner (`#e8c98a`), `/audit` — das
 * Ziel des wichtigsten CTA — trug 7 in einem anderen Gold (`#f9c544`), und
 * `/pricing`, `/claude-code-optimizer` und `/sicherheit` trugen gar keinen.
 * Ein Besucher wechselte also beim Klick auf den Haupt-CTA die Farbwelt.
 *
 * Ursache war nicht Nachlässigkeit, sondern Benennung: Zwei verschiedene
 * Farben hiessen beide „Gold" (`--color-gold-500: #f5b324` gegen den
 * Champagner der Landing). Wer `text-gold-400` schrieb, hielt das für den
 * Marken-Akzent.
 *
 * Freigabe für die Vereinheitlichung: 2026-09-06, Frage 3 („Ja,
 * schrittweise"), CLAUDE.md §10.4.
 *
 * ## Warum eine Ratsche und kein Verbot
 *
 * `src/features/` ist ausdrücklich noch nicht dran — das Dashboard ist ein
 * eigener Schnitt. Der Test sperrt deshalb genau die Fläche, die umgestellt
 * ist, und nennt die drei Dateien, die bewusst offen sind. Wer sie
 * umstellt, streicht sie hier; wer eine neue öffentliche Datei mit
 * `gold-*` anlegt, läuft auf.
 */

import { readFileSync, readdirSync } from 'node:fs';
import { join, resolve, sep } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = resolve(__dirname, '../..');

/**
 * Bewusst offen — Welle 3 (Dashboard). Kein Versehen, sondern der
 * freigegebene Zuschnitt.
 */
const NOCH_OFFEN = [
  'src/features/ai-governance/RuntimeDashboard.tsx',
  'src/features/governance/GovernanceDashboardView.tsx',
];

/** Die Flächen, die ein nicht angemeldeter Besucher sieht. */
const OEFFENTLICHE_ORDNER = ['src/pages', 'src/components'];
const OEFFENTLICHE_EINZELDATEIEN = ['src/features/billing/CheckoutPage.tsx'];

/**
 * Rekursiver Baumlauf mit `readdirSync` statt `fs.globSync`.
 *
 * Die erste Fassung nutzte `globSync` — lokal grün auf Node 22, in CI rot:
 * `fs.globSync` gibt es erst ab Node 22, und alle Workflows dieses Repos
 * fahren `node-version: '20'`. Ein Fehler, den nur der CI-Lauf zeigen
 * konnte. `readdirSync` ist ausserdem das Muster, das die übrigen Tests
 * hier bereits verwenden (z. B. `test/edge/siteos-router.test.ts`).
 */
function tsxDateien(ordner: string): string[] {
  const gefunden: string[] = [];
  for (const eintrag of readdirSync(resolve(root, ordner), { withFileTypes: true })) {
    const pfad = join(ordner, eintrag.name);
    if (eintrag.isDirectory()) gefunden.push(...tsxDateien(pfad));
    else if (eintrag.name.endsWith('.tsx')) gefunden.push(pfad);
  }
  return gefunden;
}

describe('öffentliche Ebene: ein Akzent, nicht zwei', () => {
  const dateien = [
    ...OEFFENTLICHE_ORDNER.flatMap(tsxDateien),
    ...OEFFENTLICHE_EINZELDATEIEN,
  ]
    .map(f => f.split(sep).join('/'))
    .filter(f => !NOCH_OFFEN.includes(f));

  it('findet überhaupt Dateien', () => {
    // Ohne diese Prüfung wäre der Test bei einem kaputten Glob still grün.
    expect(dateien.length).toBeGreaterThan(100);
  });

  it('keine öffentliche Datei nutzt die gold-Skala', () => {
    const treffer: string[] = [];
    for (const datei of dateien) {
      const inhalt = readFileSync(resolve(root, datei), 'utf8');
      for (const m of inhalt.matchAll(/[\w:-]*gold-\d+[/\d]*/g)) {
        treffer.push(`${datei}: ${m[0]}`);
      }
    }
    expect(
      treffer,
      'Champagner ist der Akzent der öffentlichen Ebene — `gold-*` ist die andere Farbe (#f5b324, Hero-Pivot)',
    ).toEqual([]);
  });

  it('die noch offenen Dateien existieren und tragen tatsächlich gold', () => {
    // Sonst verrottet die Ausnahmeliste still: Ein Eintrag, der längst
    // umgestellt ist, würde eine Lücke offenhalten, die es nicht gibt.
    for (const datei of NOCH_OFFEN) {
      const inhalt = readFileSync(resolve(root, datei), 'utf8');
      expect(inhalt, `${datei} ist umgestellt — Eintrag aus NOCH_OFFEN streichen`).toMatch(/gold-\d/);
    }
  });
});
