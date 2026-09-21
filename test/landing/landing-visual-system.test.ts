/**
 * Enterprise Visual System — ein Token-System für Startseite und Globus.
 *
 * Ersetzt `landing-mode.test.ts` (zwei Paletten, ein Schalter). Geprueft
 * wird, dass es genau eine Quelle gibt und alle Lesestellen daran haengen:
 *
 *   1. `src/index.css` traegt die `--rs-*`-Token mit den Werten der
 *      Spezifikation (2026-09-21).
 *   2. `landing-theme.ts` spiegelt sie fest — three.js, SVG und die
 *      Schreibweise `${LANDING_ACCENT}47` koennen keine Variable lesen.
 *      Spiegel und Quelle duerfen nicht auseinanderlaufen.
 *   3. Die `--rsd-*`-Lesestellen (`landing-mode.ts`) leiten sich nur aus
 *      `--rs-*` ab; der Schalter und die Gold-Palette sind weg.
 *   4. Geist ist selbst gehostet und die einzige Display-Familie der Landing.
 *   5. Der Globus liest dieselben Werte und traegt kein eigenes Gold.
 */
import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import * as theme from '../../src/components/landing/landing-theme';
import {
  MODE_ACCENT,
  MODE_STEEL,
  modeAccent,
  modeSteel,
  modeVeil,
} from '../../src/components/landing/landing-mode';

const root = resolve(__dirname, '../..');
const read = (rel: string) => readFileSync(resolve(root, rel), 'utf8');

const css = read('src/index.css');
const landing = read('src/pages/MainLanding.tsx');
const header = read('src/components/landing/PublicDarkHeader.tsx');
const network = read('src/components/landing/EuropeNetworkHero.tsx');
const hero = read('src/components/landing/HeroTitanium.tsx');
const scene = read('src/components/governance-frontend/GovernanceSphereScene.tsx');
const geography = read('src/components/governance-frontend/SphereGeography.tsx');
const host = read('src/components/governance-frontend/GovernanceSphereHost.tsx');

/** Die Token der Spezifikation — Wert fuer Wert. */
const SPEC_TOKENS: Record<string, string> = {
  '--rs-bg-primary': '#080B0F',
  '--rs-bg-secondary': '#0D1218',
  '--rs-surface-primary': '#121922',
  '--rs-surface-elevated': '#18212B',
  '--rs-border-primary': '#26323D',
  '--rs-border-subtle': 'rgba(148, 163, 184, 0.16)',
  '--rs-text-primary': '#F2F5F7',
  '--rs-text-secondary': '#A8B3BD',
  '--rs-text-muted': '#707E8B',
  '--rs-cyan-primary': '#22D3EE',
  '--rs-cyan-hover': '#67E8F9',
  '--rs-cyan-deep': '#0891B2',
  '--rs-titanium-silver': '#CBD5DC',
  '--rs-success': '#34D399',
  '--rs-warning': '#F5B942',
  '--rs-critical': '#F06464',
};

function cssRootTokens(): Record<string, string> {
  const start = css.indexOf(':root {\n  --rs-bg-primary');
  expect(start, ':root-Block mit --rs-* fehlt in src/index.css').toBeGreaterThan(-1);
  const body = css.slice(start, css.indexOf('}', start));
  const out: Record<string, string> = {};
  for (const m of body.matchAll(/(--rs-[a-z-]+):\s*([^;]+);/g)) out[m[1]] = m[2].trim();
  return out;
}

/** Der `--rsd-*`-Block, aus dem Hero, Kopf und Netz lesen. */
function rsdBlock(): string {
  const start = css.indexOf('.landing-context,\n[data-landing-mode] {');
  expect(start, 'Ableitungsblock .landing-context, [data-landing-mode] fehlt').toBeGreaterThan(-1);
  return css.slice(start, css.indexOf('}', start));
}

describe('Token-Quelle: src/index.css', () => {
  it('traegt jeden Token der Spezifikation mit exakt dem Wert', () => {
    const tokens = cssRootTokens();
    for (const [name, value] of Object.entries(SPEC_TOKENS)) {
      expect(tokens[name], `${name} fehlt`).toBeDefined();
      expect(tokens[name].toLowerCase(), name).toBe(value.toLowerCase());
    }
  });

  it('leitet die --rsd-Lesestellen nur aus --rs-Token ab — keine zweite Palette', () => {
    const block = rsdBlock();
    for (const name of ['accent', 'accent-soft', 'accent-lite', 'steel', 'bg', 'panel', 'btn-ink', 'line', 'veil']) {
      const m = block.match(new RegExp(`--rsd-${name}:\\s*([^;]+);`));
      expect(m, `--rsd-${name} fehlt`).not.toBeNull();
      expect(m![1], `--rsd-${name} traegt einen festen Wert statt eines Tokens`).toMatch(/^var\(--rs-/);
    }
    // Der Schalter ist weg: kein zweiter Block, kein Gold-Rueckfall.
    expect(css).not.toContain("[data-landing-mode='cyan']");
    expect(css).not.toContain("[data-landing-mode='gold']");
    expect(css).not.toMatch(/--rsd-accent:\s*#d6ad68/i);
  });

  it('haelt den Akzent-Schein zurueck: Kontur plus Tiefe, kein Dauerleuchten', () => {
    const glow = rsdBlock().match(/--rsd-glow:\s*([^;]+);/)?.[1] ?? '';
    // Kein Blur-Radius ueber 24 px in einem Cyan-Schatten.
    for (const m of glow.matchAll(/0 0 (\d+)px rgba\(34, 211, 238/g)) {
      expect(Number(m[1]), `Cyan-Schein ${m[0]} zu breit`).toBeLessThan(2);
    }
    expect(glow).toContain('0 0 0 1px rgba(34, 211, 238');
  });

  it('daempft die Hero-Aufnahme zu Graphit statt sie zu saettigen', () => {
    const filter = rsdBlock().match(/--rsd-shot-filter:\s*([^;]+);/)?.[1] ?? '';
    expect(filter).toMatch(/grayscale\(0\.[2-9]\)/);
    expect(filter).toMatch(/saturate\(0\.[0-9]+\)/);
    expect(filter).not.toMatch(/sepia|hue-rotate/);
  });
});

describe('TS-Spiegel: landing-theme.ts = CSS-Token', () => {
  const pairs: [keyof typeof theme, string][] = [
    ['LANDING_BG', '--rs-bg-primary'],
    ['LANDING_BG_SECONDARY', '--rs-bg-secondary'],
    ['LANDING_PANEL', '--rs-surface-primary'],
    ['LANDING_PANEL_ELEVATED', '--rs-surface-elevated'],
    ['LANDING_BORDER', '--rs-border-primary'],
    ['LANDING_LINE', '--rs-border-subtle'],
    ['LANDING_TEXT', '--rs-text-primary'],
    ['LANDING_MUTED', '--rs-text-secondary'],
    ['LANDING_MUTED_DEEP', '--rs-text-muted'],
    ['LANDING_ACCENT', '--rs-cyan-primary'],
    ['LANDING_ACCENT_SOFT', '--rs-cyan-hover'],
    ['LANDING_ACCENT_DEEP', '--rs-cyan-deep'],
    ['LANDING_SILVER', '--rs-titanium-silver'],
    ['LANDING_GREEN', '--rs-success'],
    ['LANDING_WARNING', '--rs-warning'],
    ['LANDING_CRITICAL', '--rs-critical'],
  ];

  it('jede Spiegelkonstante traegt den Wert ihres Tokens', () => {
    const tokens = cssRootTokens();
    for (const [constant, token] of pairs) {
      expect(String(theme[constant]).toLowerCase(), `${constant} ≠ ${token}`).toBe(
        tokens[token].toLowerCase(),
      );
    }
  });

  it('Schaltflaeche und Akzent sind dieselbe Farbe; Schrift auf Cyan ist der Grund', () => {
    expect(theme.LANDING_BUTTON).toBe(theme.LANDING_ACCENT);
    expect(theme.LANDING_BUTTON_TEXT).toBe(theme.LANDING_BG);
    expect(theme.LANDING_ACCENT_LITE).toBe(theme.LANDING_SILVER);
  });

  it('die var()-Rueckfaelle in landing-mode.ts sind die Spiegelwerte', () => {
    expect(MODE_ACCENT).toBe(`var(--rsd-accent, ${theme.LANDING_ACCENT})`);
    expect(MODE_STEEL).toBe(`var(--rsd-steel, ${theme.LANDING_SILVER})`);
    expect(modeAccent(40)).toBe(`color-mix(in srgb, ${MODE_ACCENT} 40%, transparent)`);
    expect(modeSteel(28)).toBe(`color-mix(in srgb, ${MODE_STEEL} 28%, transparent)`);
    expect(modeVeil(100)).toContain('color-mix(in srgb, var(--rsd-veil');
  });

  it('keine Ueberschrift mit Gewicht ueber 600', () => {
    expect(theme.LANDING_H1_WEIGHT).toBeLessThan(601);
    expect(theme.LANDING_H2_WEIGHT).toBeLessThan(601);
    expect(theme.LANDING_H1).toMatch(/^clamp\(/);
    expect(theme.LANDING_H1).not.toContain('88px');
  });
});

describe('Typografie: Geist, selbst gehostet, eine Familie', () => {
  it('die drei Schnitte liegen unter public/fonts mit Lizenztext', () => {
    for (const file of [
      'geist-latin-400-normal.woff2',
      'geist-latin-500-normal.woff2',
      'geist-latin-600-normal.woff2',
      'OFL-Geist.txt',
    ]) {
      expect(existsSync(resolve(root, 'public/fonts', file)), file).toBe(true);
    }
    expect(read('public/fonts/OFL-Geist.txt')).toContain('SIL Open Font License');
  });

  it('index.css deklariert Geist 400/500/600 aus /fonts', () => {
    for (const weight of ['400', '500', '600']) {
      expect(css).toMatch(
        new RegExp(
          `font-family: 'Geist';\\n\\s*font-style: normal;\\n\\s*font-weight: ${weight};[^}]*url\\('/fonts/geist-latin-${weight}-normal\\.woff2'\\)`,
        ),
      );
    }
  });

  it('Landing-Schriftstapel beginnt mit Geist und faellt auf Inter zurueck', () => {
    expect(theme.LANDING_SANS).toMatch(/^'Geist', 'Inter'/);
    expect(theme.LANDING_DISPLAY).toBe(theme.LANDING_SANS);
    expect(theme.LANDING_SERIF).toBe(theme.LANDING_DISPLAY);
    expect(css).toMatch(/--ga-display:\s*var\(--rs-font-sans\)/);
  });
});

describe('Lesestellen: Hero, Kopf, Netz', () => {
  it('der Schalter ist entfernt und die Startseite traegt kein Modus-Attribut mehr', () => {
    expect(existsSync(resolve(root, 'src/components/landing/LandingModeSwitch.tsx'))).toBe(false);
    expect(landing).not.toContain('useLandingMode');
    expect(landing).not.toContain('data-landing-mode');
    expect(landing).toContain('className="landing-context');
    expect(header).not.toContain('modeSwitch');
  });

  it('der Hero traegt keinen Farbwert und kein Leuchten am hervorgehobenen Plan', () => {
    expect(hero).not.toMatch(/#[0-9a-f]{6}\b/i);
    expect(hero).toContain("'--landing-ring': MODE_ACCENT");
    expect(hero).toContain('borderColor: chip.featured ? MODE_ACCENT : modeSteel(28)');
    expect(hero).not.toMatch(/boxShadow: chip\.featured/);
    expect(hero).toContain('fontWeight: LANDING_H1_WEIGHT');
  });

  it('die Netzgrafik ist Stahl mit Cyan-Knoten, Farben als style nicht als Attribut', () => {
    expect(network).toContain('style={{ stroke: MODE_STEEL }}');
    expect(network).toContain('style={{ fill: MODE_ACCENT }}');
    expect(network).not.toMatch(/\bfill=\{MODE_/);
    expect(network).not.toMatch(/\bstroke=\{MODE_/);
    expect(network).toContain('MODE_SHOT_FILTER');
    expect(network).not.toContain('${MODE_ACCENT}');
  });

  it('der Kopf setzt Navigation in Geist und den Fokusring auf den Token', () => {
    expect(header).toContain('fontSize: LANDING_NAV');
    expect(header).toContain('fontFamily: LANDING_SANS');
    expect(header).not.toMatch(/d6ad68/i);
  });
});

describe('Globus: dieselben Token, kein eigenes Gold', () => {
  it('Szene und Geographie lesen landing-theme.ts', () => {
    expect(scene).toContain("from '../landing/landing-theme'");
    expect(geography).toContain("from '../landing/landing-theme'");
    for (const file of [scene, geography, host]) {
      expect(file).not.toMatch(/e8c98a|f3d9a0|d4a574|e4cfa2|e2bf78|a8956f/i);
    }
  });

  it('Knoten sind klein, Halo nur bei Auswahl oder Aufmerksamkeit', () => {
    expect(scene).toContain('sphereGeometry args={[0.07, 16, 16]}');
    expect(scene).toContain('{(active || attention) && !reducedMotion && (');
    expect(scene).toMatch(/const color = attention \? NODE_ATTENTION : active \? NODE_SELECTED : NODE_GOVERNED;/);
  });

  it('Bahnen und Partikel sind Stahl mit niedriger Deckung', () => {
    expect(scene).toContain('color={STEEL} transparent opacity={0.14}');
    expect(scene).toContain('new Float32Array(48 * 3)');
    expect(scene).not.toMatch(/opacity=\{0\.4\}\s*\n\s*depthWrite/);
  });

  it('Landesgrenzen sind Stahl, nicht Weiss', () => {
    expect(geography).toContain("ctx.strokeStyle = 'rgba(148, 163, 184, 0.85)'");
    expect(geography).not.toContain('rgba(230, 245, 255, 0.98)');
  });

  it('der unbenutzte Neon-Globus (CSS) ist entfernt', () => {
    expect(existsSync(resolve(root, 'src/components/governance-frontend/GovernanceGlobe.css'))).toBe(false);
  });
});
