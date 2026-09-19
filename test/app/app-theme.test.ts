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
import * as osChrome from '../../src/components/governance-os/osChrome';

const root = resolve(__dirname, '../..');
const appTheme = readFileSync(
  resolve(root, 'src/components/governance-os/app-theme.ts'),
  'utf8',
);
const sidebar = readFileSync(
  resolve(root, 'src/components/governance-os/GovernanceSidebar.tsx'),
  'utf8',
);
const osChromeSrc = readFileSync(
  resolve(root, 'src/components/governance-os/osChrome.ts'),
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

describe('osChrome — entkoppelt von der Marketing-Palette', () => {
  it('importiert nichts aus landing-theme', () => {
    // Geprueft wird die Modulkante, nicht das Wort: Der Kopf von osChrome.ts
    // erklaert die Entkopplung und nennt `landing-theme` dabei zwangslaeufig.
    const kanten = osChromeSrc.match(/\bfrom\s+['"][^'"]*landing-theme[^'"]*['"]/g) ?? [];
    expect(
      kanten,
      'osChrome.ts haengt wieder an landing-theme. Dann zieht jede Farbaenderung ' +
        'auf `/` die App mit — und zwar nur zur Haelfte, weil die Tailwind-Fragmente ' +
        'hartkodiert sind.',
    ).toEqual([]);
  });

  /**
   * Die Werte, die vor der Entkopplung per Re-Export aus `landing-theme`
   * kamen. Der Test friert sie zum Zeitpunkt des Schnitts ein: Die
   * Entkopplung sollte die Darstellung nicht veraendern, und ein spaeterer
   * Farbwechsel soll eine bewusste Entscheidung sein, kein Nebeneffekt.
   */
  const VOR_DER_ENTKOPPLUNG: Readonly<Record<string, string>> = {
    OS_GOLD: '#d6ad68',
    OS_BG: '#0a0a0b',
    OS_CREAM: '#d6ad68',
    OS_CREAM_ALT: '#e8c98a',
    OS_CREAM_TEXT: '#0a0a0b',
    OS_H1: 'clamp(2.5rem, 1.2rem + 4.2vw, 4.25rem)',
    OS_H2: 'clamp(1.8125rem, 1.15rem + 2.3vw, 2.75rem)',
    OS_LINE: 'rgba(214, 173, 104, 0.22)',
    OS_MONO: "'DM Mono', 'JetBrains Mono', ui-monospace, monospace",
    OS_MUTED: '#9a9aa1',
    OS_PANEL: '#121214',
    OS_SERIF: "'Playfair Display', Georgia, 'Times New Roman', serif",
    OS_TEXT: '#f2eee6',
  };

  it('traegt die Werte von vor dem Schnitt, unveraendert', () => {
    const werte: Record<string, unknown> = { ...osChrome };
    for (const [name, wert] of Object.entries(VOR_DER_ENTKOPPLUNG)) {
      expect(
        werte[name],
        `${name} weicht vom Stand vor der Entkopplung ab — der Schnitt sollte ` +
          'verhaltensgleich sein.',
      ).toBe(wert);
    }
  });

  it('das App-Chrome bleibt frei von Cyan', () => {
    for (const wert of ENTWURF_CYAN) {
      expect(
        osChromeSrc.toLowerCase(),
        `osChrome.ts traegt ${wert}. Die Regel im Kopf dieser Datei sagt ` +
          '„No cyan/purple product chrome".',
      ).not.toContain(wert.toLowerCase());
    }
  });
});
