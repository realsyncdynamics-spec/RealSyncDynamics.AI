/**
 * Wächter: Eine Champagner-Fläche trägt dunkle Schrift.
 *
 * ## Der Fehler, den dieser Test verhindert
 *
 * Champagner ist ein **heller** Akzent. Die Farben, die er im Dashboard
 * abgelöst hat, waren dunkel: `security-blue` (#0052FF) und `petrol-700`
 * (#0F766E) trugen hellen Text — `text-titanium-50` bzw. `text-white`.
 *
 * Wer beim Umstellen nur die Farbe tauscht und die Schrift stehen lässt,
 * erzeugt hellen Text auf heller Fläche. Gerechnet (WCAG 2.1):
 *
 *   weiss auf champagne-200      1,24:1   durchgefallen
 *   champagne-950 auf 200       14,41:1   AAA
 *
 * Der Knopf sieht dabei nicht kaputt aus — er ist nur unlesbar. Genau
 * deshalb prüft dieser Test die Paarung und nicht das Aussehen.
 *
 * ## Was er nicht prüft
 *
 * Er sagt nichts über helle Hintergründe. `champagne-500` auf Weiss ergibt
 * 1,60:1 und ist damit für die Light-Theme-Flächen (`text-petrol-700` &c.)
 * keine Option — dort fehlt ein dunkler Champagner-Ton. Das ist eine
 * offene Entscheidung, kein Versehen; siehe CLAUDE.md §10.
 */

import { readFileSync, readdirSync } from 'node:fs';
import { join, resolve, sep } from 'node:path';
import { describe, expect, it } from 'vitest';

import { CHAMPAGNE_SCALE } from '../../src/components/landing/landing-theme';

const root = resolve(__dirname, '../..');

/** Relative Leuchtdichte nach WCAG 2.1. */
function leuchtdichte(hex: string): number {
  const teile = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255);
  const [r, g, b] = teile.map(x => (x <= 0.04045 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function kontrast(vordergrund: string, hintergrund: string): number {
  const a = leuchtdichte(vordergrund);
  const b = leuchtdichte(hintergrund);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

function tsxDateien(ordner: string): string[] {
  const gefunden: string[] = [];
  for (const eintrag of readdirSync(resolve(root, ordner), { withFileTypes: true })) {
    const pfad = join(ordner, eintrag.name);
    if (eintrag.isDirectory()) gefunden.push(...tsxDateien(pfad));
    else if (eintrag.name.endsWith('.tsx')) gefunden.push(pfad);
  }
  return gefunden;
}

describe('Champagner-Flächen sind lesbar', () => {
  it('das Paar aus der Landing erfüllt AA für Fliesstext', () => {
    expect(kontrast(CHAMPAGNE_SCALE[950], CHAMPAGNE_SCALE[200])).toBeGreaterThanOrEqual(4.5);
  });

  it('der naive Tausch — weisse Schrift auf Champagner — fällt durch', () => {
    // Festgehalten, damit die Zahl nicht in Vergessenheit gerät: Sie ist der
    // Grund für die paarweise Abbildung statt eines Farbtauschs.
    expect(kontrast('#ffffff', CHAMPAGNE_SCALE[200])).toBeLessThan(3);
  });

  it('der Akzent auf dunklem Grund ist besser als der abgelöste', () => {
    const obsidian = '#050506';
    expect(kontrast(CHAMPAGNE_SCALE[500], obsidian)).toBeGreaterThan(kontrast('#0052ff', obsidian));
    expect(kontrast(CHAMPAGNE_SCALE[500], obsidian)).toBeGreaterThanOrEqual(7);
  });

  /**
   * Schriftklassen, die auf einer Champagner-Fläche nicht lesbar sind —
   * aus zwei verschiedenen Gründen.
   *
   * **Hell**: `text-white` &c. sind schlicht zu hell (1,24:1).
   *
   * **Tot**: `text-obsidian`, `text-titanium` und `text-petrol` OHNE Stufe
   * erzeugen gar kein CSS. `tailwind.config.ts` definiert diese Namen, wird
   * von Tailwind 4 mangels `@config` aber nicht geladen; `@theme` führt nur
   * nummerierte Stufen. Das Element erbt dann die Schriftfarbe des
   * Elternknotens — auf dunklen Oberflächen also eine helle. Im Repo stehen
   * **487 solcher Klassen in 46 Dateien** (gemessen 2026-09-06).
   *
   * Der Unterschied ist für den Leser keiner: In beiden Fällen steht heller
   * Text auf heller Fläche. Genau dieser Fall ist am 2026-09-06 auf
   * `/flow/start` aufgetreten — die statische Prüfung sah ein `text-obsidian`
   * und hielt es für dunkel, der Browser rendert `rgb(237,237,238)`.
   */
  const UNBRAUCHBARE_SCHRIFT = [
    'text-white', 'text-titanium-50', 'text-titanium-100', 'text-champagne-50',
    'text-obsidian', 'text-titanium', 'text-petrol',
  ];

  it('keine Champagner-Fläche trägt helle Schrift', () => {
    const dateien = ['src/features', 'src/components', 'src/pages'].flatMap(tsxDateien);
    const treffer: string[] = [];

    for (const datei of dateien) {
      const inhalt = readFileSync(resolve(root, datei), 'utf8');
      for (const m of inhalt.matchAll(/className=(?:"([^"]*)"|\{`([^`]*)`\})/g)) {
        // Ein Ternär im Template ist KEIN Klassensatz, sondern zwei. Die
        // erste Fassung las beide zusammen und meldete deshalb vier
        // Fehlalarme — die gefüllte Variante trug dunkle Schrift, die
        // Umriss-Variante daneben helle. Geprüft wird jetzt je Zweig:
        // statischer Teil plus genau eine Alternative.
        const roh = m[1] ?? m[2] ?? '';
        const statisch = roh.replace(/\$\{[^}]*\}/g, ' ');
        const zweige = [...roh.matchAll(/\$\{[^}]*\}/g)]
          .flatMap(a => [...a[0].matchAll(/'([^']*)'/g)].map(b => b[1]));
        const saetze = zweige.length > 0 ? zweige.map(z => `${statisch} ${z}`) : [statisch];

        for (const satz of saetze) {
          if (!/\bbg-champagne(-100|-200)?(?![\w/-])/.test(satz)) continue;
          // `\\b` reicht nicht: `text-titanium-300` enthaelt `text-titanium`.
          const hell = UNBRAUCHBARE_SCHRIFT.find(k => new RegExp(`(?:^|\\s)${k}(?![\\w-])`).test(satz));
          if (hell) treffer.push(`${datei.split(sep).join('/')}: ${hell} auf Champagner-Fläche`);
        }
      }
    }

    expect(treffer, 'Champagner ist hell — die Schrift darauf muss dunkel sein').toEqual([]);
  });
});
