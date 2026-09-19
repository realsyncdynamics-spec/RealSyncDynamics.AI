/**
 * App-Raster — und die Grenze, an der es aufhoert.
 *
 * `app-theme.ts` traegt nur, was der Handoff-Entwurf beisteuert und im Repo
 * fehlte: Rastermasse, Radien, Bewegung. Farben kommen aus `osChrome.ts`.
 * Der Test haelt genau das fest, weil es sonst beim naechsten Griff zum
 * Entwurf wieder verrutscht: Dort ist alles Cyan, und eine zweite
 * Akzentpalette im App-Chrome laesst sich in zwei Minuten einbauen und in
 * zwei Monaten nicht mehr herausloesen.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  APP_CLASS_STYLES,
  APP_DURATION_MS,
  APP_EASING,
  APP_HEADER_HEIGHT,
  APP_NAV_ITEM_HEIGHT,
  APP_RADIUS_MD,
  APP_SIDEBAR_WIDTH,
} from '../../src/components/governance-os/app-theme';
import { ENFORCEMENT_CLASSES } from '../../shared/enforcement-classes';

const root = resolve(__dirname, '../..');
const appTheme = readFileSync(
  resolve(root, 'src/components/governance-os/app-theme.ts'),
  'utf8',
);
const sidebar = readFileSync(
  resolve(root, 'src/components/governance-os/GovernanceSidebar.tsx'),
  'utf8',
);

/** Farbwerte des Entwurfs, die im App-Chrome nichts zu suchen haben. */
const ENTWURF_CYAN = ['#00B8D4', '#4FD4E8', '#1E5AFF', '#1641C4', '#7FA0FF'];

describe('App-Raster', () => {
  it('traegt die Rastermasse des Entwurfs', () => {
    expect(APP_SIDEBAR_WIDTH).toBe(248);
    expect(APP_NAV_ITEM_HEIGHT).toBe(38);
    expect(APP_HEADER_HEIGHT).toBe(56);
    expect(APP_RADIUS_MD).toBe(8);
  });

  it('traegt die Bewegungskurve des Entwurfs', () => {
    expect(APP_EASING).toBe('cubic-bezier(.2,.8,.2,1)');
    expect(APP_DURATION_MS).toBe(200);
  });
});

describe('Farbgrenze — osChrome bleibt SSoT', () => {
  it('app-theme definiert ueberhaupt keine Farbwerte', () => {
    // Kein Hex, nirgends. Die Regel ist absichtlich haerter als noetig:
    // „nur ein Akzent" waere Auslegungssache, „kein Hex" ist es nicht.
    const hex = appTheme.match(/#[0-9A-Fa-f]{3,8}\b/g) ?? [];
    expect(
      hex,
      `app-theme.ts definiert Farbwerte (${hex.join(', ')}). Farben gehoeren in osChrome.ts.`,
    ).toEqual([]);
  });

  it('die Seitenleiste traegt keine Cyan-Werte des Entwurfs', () => {
    for (const wert of ENTWURF_CYAN) {
      expect(
        sidebar.toLowerCase(),
        `GovernanceSidebar traegt ${wert} — das App-Chrome ist auf Gold festgelegt ` +
          '(osChrome.ts, index.css).',
      ).not.toContain(wert.toLowerCase());
    }
  });

  it('die Seitenleiste liest ihre Akzente aus osChrome', () => {
    expect(sidebar).toContain("from './osChrome'");
    expect(sidebar).toContain('OS_ACCENT_TEXT');
  });
});

describe('Durchsetzbarkeits-Klassen', () => {
  it('jede Klasse aus der SSoT hat genau einen Stil', () => {
    expect(Object.keys(APP_CLASS_STYLES).sort()).toEqual(Object.keys(ENFORCEMENT_CLASSES).sort());
  });

  it('die Klassen sind voneinander unterscheidbar', () => {
    const balken = Object.values(APP_CLASS_STYLES).map((s) => s.bar);
    expect(
      new Set(balken).size,
      'Zwei Klassen teilen sich eine Farbe — dann ist die Klasse am Balken nicht ablesbar.',
    ).toBe(balken.length);
  });

  it('die Stile sind Tailwind-Klassen, keine Hex-Werte', () => {
    // Folgt `lib/governance/severityPalette.ts`: „Tailwind-Klassen, nicht Hex
    // — die Plattform nutzt ausschliesslich bg-*-500/10, border-*-500/40,
    // text-*-200 Patterns."
    for (const [klasse, stil] of Object.entries(APP_CLASS_STYLES)) {
      for (const [feld, wert] of Object.entries(stil)) {
        expect(wert, `Klasse ${klasse}, Feld ${feld} ist leer`).not.toBe('');
        expect(wert, `Klasse ${klasse}, Feld ${feld} enthaelt einen Hex-Wert`).not.toMatch(/#[0-9A-Fa-f]{3,8}/);
      }
      expect(stil.badge, `Klasse ${klasse}: Badge ohne Rahmen`).toMatch(/\bborder-/);
      expect(stil.badge, `Klasse ${klasse}: Badge ohne Flaeche`).toMatch(/\bbg-/);
      expect(stil.text, `Klasse ${klasse}: Textfarbe fehlt`).toMatch(/\btext-/);
      expect(stil.bar, `Klasse ${klasse}: Balkenflaeche fehlt`).toMatch(/\bbg-/);
    }
  });
});
