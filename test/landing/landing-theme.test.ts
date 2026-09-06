/**
 * Wächter: Die Gestaltungswerte der öffentlichen Ebene stehen an genau
 * einer Stelle.
 *
 * ## Warum es diesen Test gibt
 *
 * `src/components/landing/landing-theme.ts` behauptete in seinem eigenen
 * Kopfkommentar seit dem 2026-08-09, `test/scan/landing-theme.test.ts` halte
 * seine Werte mit `MainLanding.tsx` zusammen. Am 2026-09-06 nachgesehen:
 * Weder der Test noch das Verzeichnis `test/scan/` existierten. Eine Zusage
 * auf eine Absicherung, die es nicht gab — und genau in der Zeit lief die
 * Palette auseinander (zwei verschiedene Farben namens „Gold", eine verwaiste
 * `src/config/design-tokens.ts`, die auf Tailwind-Klassen zeigte, die nie
 * definiert waren).
 *
 * ## Was hier geprüft wird — und was nicht
 *
 * Geprüft wird die **Herkunft**, nicht das Aussehen. Ein Render-Test würde
 * den Fehler nicht finden, den dieser Test findet: Ein hartkodiertes
 * `#e8c98a` sieht exakt so aus wie `text-champagne` und ist trotzdem der
 * Zustand, der die Vereinheitlichung unmöglich macht. Deshalb wird am
 * Quelltext geprüft.
 *
 * Pixel prüft dieser Test bewusst nicht — das hinge an der Schriftart des
 * CI-Runners (siehe die Lehre zu `hero-longword` in CLAUDE.md §10).
 *
 * ## Warum gegen `src/index.css` und nicht gegen `tailwind.config.ts`
 *
 * Die erste Fassung dieses Tests prüfte `tailwind.config.ts` — und war
 * grün, während der erzeugte Build die Farbe verlor. Dieses Projekt läuft
 * auf Tailwind 4: Maßgeblich ist der `@theme`-Block in `src/index.css`,
 * und `tailwind.config.ts` wird mangels `@config`-Direktiv überhaupt nicht
 * geladen. Beide Dateien widersprechen sich sogar (`petrol` ist dort
 * `#0F766E`, in `@theme` `#14b8a6`).
 *
 * Aufgefallen ist das weder an der Typprüfung noch am Lint noch an 4473
 * grünen Tests, sondern erst beim Nachsehen im CSS-Bundle. Ein Test, der
 * die falsche Datei liest, ist schlimmer als kein Test: Er behauptet eine
 * Absicherung, die es nicht gibt. Deshalb prüft dieser hier die Datei, die
 * der Compiler tatsächlich verarbeitet.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

import {
  CHAMPAGNE_SCALE,
  LANDING_ACCENT,
  LANDING_BG,
  LANDING_BUTTON,
  LANDING_BUTTON_TEXT,
  LANDING_SERIF,
} from '../../src/components/landing/landing-theme';

const root = resolve(__dirname, '../..');
// Die Datei, aus der Tailwind 4 die Farben tatsächlich liest.
const themeCss = readFileSync(resolve(root, 'src/index.css'), 'utf8');
const tailwindConfig = readFileSync(resolve(root, 'tailwind.config.ts'), 'utf8');
const mainLanding = readFileSync(resolve(root, 'src/pages/MainLanding.tsx'), 'utf8');

describe('landing-theme ist die einzige Quelle der öffentlichen Palette', () => {
  it('jede Stufe der Champagner-Skala steht im @theme-Block', () => {
    for (const [step, hex] of Object.entries(CHAMPAGNE_SCALE)) {
      // Das Paar wird gesucht, nicht nur der Wert — damit eine verschobene
      // Stufe auffällt und nicht nur eine fehlende Farbe.
      // Ausrichtungs-Leerzeichen im CSS sind erlaubt, ein anderer Wert nicht.
      expect(themeCss, `champagne-${step} fehlt in @theme oder weicht ab`)
        .toMatch(new RegExp(`--color-champagne-${step}:\\s+${hex};`));
    }
  });

  it('die benannten Einzelwerte zeigen auf die richtige Stufe', () => {
    expect(LANDING_ACCENT).toBe(CHAMPAGNE_SCALE[500]);
    expect(LANDING_BUTTON).toBe(CHAMPAGNE_SCALE[200]);
    expect(LANDING_BUTTON_TEXT).toBe(CHAMPAGNE_SCALE[950]);
  });

  it('Hintergrund und Überschriften-Familie sind Tailwind-Tokens', () => {
    expect(themeCss).toMatch(new RegExp(`--color-obsidian-deep:\\s+${LANDING_BG.replace(/[()]/g, '\\$&')};`));
    // `--font-serif` steht in CSS-Schreibweise mit doppelten Anführungszeichen.
    const serifDeklaration = themeCss.match(/--font-serif:\s*([^;]+);/);
    expect(serifDeklaration, '--font-serif fehlt im @theme-Block').not.toBeNull();
    for (const family of LANDING_SERIF.split(',').map(part => part.trim().replace(/^'|'$/g, ''))) {
      expect(serifDeklaration![1], `Serif-Familie ${family} fehlt`).toContain(family);
    }
  });

  it('tailwind.config.ts wird als tote Quelle erkannt', () => {
    // Solange kein `@config`-Direktiv existiert, ist die Datei für Farben
    // wirkungslos. Käme eines dazu, wären plötzlich zwei widersprüchliche
    // Quellen aktiv — dann muss dieser Test neu entschieden werden.
    expect(themeCss).not.toContain('@config');
    expect(tailwindConfig, 'Champagner gehört in @theme, nicht hierher')
      .not.toContain('champagne:');
  });

  it('champagne und gold werden nicht verwechselt', () => {
    // `--color-gold-500: #f5b324` in src/index.css ist eine ANDERE Farbe und
    // gehört zum Hero-Pivot. Landet sie je in der Champagner-Skala, ist die
    // Trennung aufgehoben, die der Grund für den Namen `champagne` war.
    expect(Object.values(CHAMPAGNE_SCALE)).not.toContain('#f5b324');
  });
});

describe('MainLanding hält keine zweite Kopie der Palette', () => {
  // Genau die Literale, die bis zum 2026-09-06 in MainLanding.tsx standen.
  const migrierteLiterale = [
    '#e8c98a', '#f3d9a0', '#f0e6d2', '#1a1714', '#f6efe4', '#fff8ee', '#e8dcc4',
  ];

  it.each(migrierteLiterale)('%s steht nicht mehr als Hex in MainLanding.tsx', hex => {
    expect(mainLanding).not.toContain(hex);
  });

  it('die Überschriften-Familie ist nicht mehr inline gesetzt', () => {
    // Vorher: `style={{ fontFamily: SERIF, fontWeight: 500 }}` an fünf
    // Überschriften. Eine inline gesetzte Familie ist von aussen nicht
    // austauschbar — das war der Kern des Befundes.
    expect(mainLanding).not.toContain('fontFamily: SERIF');
    expect(mainLanding).toContain('font-serif');
  });

  it('der Hintergrund kommt aus der SSoT, nicht aus einer lokalen Konstante', () => {
    expect(mainLanding).toContain('LANDING_BG');
    expect(mainLanding).not.toMatch(/const BG\s*=/);
  });
});
