/**
 * App-Tokens — Cyan/Blau, getrennt von der Gold-Landing.
 *
 * Der Test haelt zwei Dinge fest, die beim naechsten Umbau sonst still
 * verrutschen: dass die App-Palette nicht in die Marketing-Palette laeuft
 * (und umgekehrt), und dass jede Durchsetzbarkeits-Klasse genau eine Farbe
 * hat — auf dem Dashboard, in der Systemliste und in der Klassifizierung
 * dieselbe, sonst liest man drei verschiedene Aussagen.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  APP_BG,
  APP_CLASS_COLORS,
  APP_CYAN,
  APP_DISPLAY,
  APP_HEADER_HEIGHT,
  APP_MONO,
  APP_PRIMARY,
  APP_SIDEBAR_WIDTH,
  APP_SURFACE,
} from '../../src/components/governance-os/app-theme';
import { ENFORCEMENT_CLASSES } from '../../shared/enforcement-classes';

const root = resolve(__dirname, '../..');
const appTheme = readFileSync(
  resolve(root, 'src/components/governance-os/app-theme.ts'),
  'utf8',
);
const landingTheme = readFileSync(
  resolve(root, 'src/components/landing/landing-theme.ts'),
  'utf8',
);

describe('App-Tokens', () => {
  it('traegt die Farbwerte des Entwurfs', () => {
    expect(APP_BG).toBe('#070B14');
    expect(APP_SURFACE).toBe('#0D1322');
    expect(APP_PRIMARY).toBe('#1E5AFF');
    expect(APP_CYAN).toBe('#00B8D4');
  });

  it('traegt die Rastermasse der Shell', () => {
    expect(APP_SIDEBAR_WIDTH).toBe(248);
    expect(APP_HEADER_HEIGHT).toBe(56);
  });

  it('nennt die Schriftfamilien des Entwurfs', () => {
    expect(APP_DISPLAY).toContain('Inter Tight');
    expect(APP_MONO).toContain('JetBrains Mono');
  });

  it('jede Durchsetzbarkeits-Klasse hat genau eine Farbe', () => {
    const klassen = Object.keys(ENFORCEMENT_CLASSES).sort();
    expect(Object.keys(APP_CLASS_COLORS).sort()).toEqual(klassen);

    const farben = Object.values(APP_CLASS_COLORS);
    expect(
      new Set(farben).size,
      'Zwei Klassen teilen sich eine Farbe — dann ist die Klasse am Balken nicht mehr ablesbar.',
    ).toBe(farben.length);

    for (const [klasse, farbe] of Object.entries(APP_CLASS_COLORS)) {
      expect(farbe, `Klasse ${klasse} hat keinen Hex-Wert`).toMatch(/^#[0-9A-Fa-f]{6}$/);
    }
  });

  it('App- und Landing-Palette bleiben getrennt', () => {
    // Gold gehoert der oeffentlichen Seite, Blau/Cyan der App. Wer hier
    // mischt, hebt die Trennung auf, die den beiden Flaechen ihre Rolle gibt.
    for (const gold of ['#d6ad68', '#e8c98a', '#e4cfa2']) {
      expect(appTheme.toLowerCase(), `Goldwert ${gold} in den App-Tokens`).not.toContain(gold);
    }
    for (const blau of ['#1e5aff', '#00b8d4']) {
      expect(
        landingTheme.toLowerCase(),
        `App-Akzent ${blau} in den Landing-Tokens`,
      ).not.toContain(blau);
    }
  });
});
