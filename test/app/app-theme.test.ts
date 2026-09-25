/**
 * App-Raster — und die Grenze, an der es aufhoert.
 *
 * `app-theme.ts` traegt nur, was der Handoff-Entwurf beisteuert und im Repo
 * fehlte: Rastermasse, Radien, Bewegung. Farben kommen aus `osChrome.ts`.
 *
 * Handoff v2 Phase 2: Der Eigentümer hat den Wechsel des App-Chrome von Gold
 * auf die Handoff-Palette angeordnet — genau die „bewusste Entscheidung",
 * die dieser Test verlangt hat. Die Regel dahinter bleibt: EINE
 * Akzentpalette im App-Chrome. Geprüft wird deshalb jetzt umgekehrt, dass
 * kein Gold neben dem neuen Akzent stehen bleibt.
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

/** Goldwerte der Vorgaenger-Palette, die im App-Chrome nichts mehr zu suchen haben. */
const ALT_GOLD = ['#d6ad68', '#e4cfa2', '#e8c98a', '#e8ddc8', 'rgba(214, 173, 104'];

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

  it('die Seitenleiste traegt keine Hex-Werte — Farben kommen aus Tokens', () => {
    const hex = sidebar.match(/#[0-9A-Fa-f]{3,8}\b/g) ?? [];
    expect(
      hex,
      `GovernanceSidebar traegt Farbwerte (${hex.join(', ')}). Farben gehoeren in ` +
        'osChrome.ts bzw. die --color-rs-*-Tokens.',
    ).toEqual([]);
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
   * Die Handoff-v2-Werte (HANDOFF.md „Design Tokens"), eingefroren zum
   * Palettenwechsel in Phase 2. Ein spaeterer Farbwechsel soll wieder eine
   * bewusste Entscheidung sein, kein Nebeneffekt.
   */
  const HANDOFF_V2: Readonly<Record<string, string>> = {
    OS_GOLD: '#00B8D4',
    OS_BG: '#070B14',
    OS_CREAM: '#1E5AFF',
    OS_CREAM_ALT: '#1641C4',
    OS_CREAM_TEXT: '#FFFFFF',
    OS_H1: 'clamp(2.5rem, 1.2rem + 4.2vw, 4.25rem)',
    OS_H2: 'clamp(1.8125rem, 1.15rem + 2.3vw, 2.75rem)',
    OS_LINE: '#1F2B48',
    OS_MONO: "'JetBrains Mono', ui-monospace, 'SFMono-Regular', Menlo, monospace",
    OS_MUTED: '#8A95AC',
    OS_PANEL: '#0D1322',
    OS_SERIF: "'Newsreader', Georgia, 'Times New Roman', serif",
    OS_TEXT: '#F2F5FA',
  };

  it('traegt die Handoff-v2-Werte, unveraendert', () => {
    const werte: Record<string, unknown> = { ...osChrome };
    for (const [name, wert] of Object.entries(HANDOFF_V2)) {
      expect(werte[name], `${name} weicht von den Handoff-v2-Tokens ab.`).toBe(wert);
    }
  });

  it('das App-Chrome traegt kein Gold der Vorgaenger-Palette mehr', () => {
    for (const wert of ALT_GOLD) {
      expect(
        osChromeSrc.toLowerCase(),
        `osChrome.ts traegt ${wert} — zwei Akzente im App-Chrome.`,
      ).not.toContain(wert.toLowerCase());
    }
  });

  it('die Shell-Bausteine tragen kein Gold der Vorgaenger-Palette mehr', () => {
    for (const datei of [
      'BrowserTopBar.tsx',
      'GovernanceSidebar.tsx',
      'MobileBottomNavigation.tsx',
      'GovernanceBrowserShell.tsx',
      'GovernanceStatusBar.tsx',
      'GovernanceTabs.tsx',
      'CommandCenter.tsx',
    ]) {
      const src = readFileSync(resolve(root, 'src/components/governance-os', datei), 'utf8').toLowerCase();
      for (const wert of ALT_GOLD) {
        expect(src, `${datei} traegt ${wert}`).not.toContain(wert.toLowerCase());
      }
    }
  });
});
