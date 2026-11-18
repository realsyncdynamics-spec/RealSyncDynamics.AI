/**
 * Glaswürfel-Designsystem (Owner-Vorlage 18.11.2026).
 * Geprüft: Würfel ist dekorativ und ohne WebGL/three.js, statisch bei
 * reduzierter Bewegung, Tokens gescoped, Text-Tokens erfüllen WCAG-Kontrast.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { buildCells, CUBE_SPECTRUM, GlassCube } from '../../src/components/neon/GlassCube';
import { GlassPanel } from '../../src/components/neon/GlassPanel';

const root = resolve(__dirname, '../..');
const read = (p: string) => readFileSync(resolve(root, p), 'utf8');

function stubMotion(reduce: boolean, fine = true) {
  vi.stubGlobal('matchMedia', (q: string) => ({
    matches: (q.includes('reduce') && reduce) || (q.includes('pointer: fine') && fine),
    media: q,
    addEventListener() {},
    removeEventListener() {},
  }));
}

function luminance(hex: string): number {
  const n = parseInt(hex.replace('#', ''), 16);
  const ch = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * ch[0]! + 0.7152 * ch[1]! + 0.0722 * ch[2]!;
}
function contrast(a: string, b: string): number {
  const [x, y] = [luminance(a), luminance(b)].sort((p, q) => q - p);
  return (x! + 0.05) / (y! + 0.05);
}
function token(css: string, name: string): string {
  const m = css.match(new RegExp(`${name}:\\s*(#[0-9a-fA-F]{6})`));
  if (!m) throw new Error(`Token ${name} fehlt`);
  return m[1]!;
}

afterEach(() => vi.unstubAllGlobals());

describe('GlassCube', () => {
  it('ist dekorativ (aria-hidden) und bewegt sich ohne reduzierte Bewegung', () => {
    stubMotion(false);
    render(<GlassCube />);
    const cube = screen.getByTestId('glass-cube');
    expect(cube).toHaveAttribute('aria-hidden', 'true');
    expect(cube).toHaveAttribute('data-still', 'false');
    expect(cube.querySelector('.gc-lid')).not.toBeNull();
  });

  it('besteht aus 3×3×3 Teilwürfeln mit je sechs Flächen in kräftigen Farben', () => {
    stubMotion(false);
    render(<GlassCube />);
    const cells = screen.getByTestId('glass-cube').querySelectorAll('.gc-cell');
    expect(cells).toHaveLength(27);
    for (const c of cells) expect(c.querySelectorAll('.gc-cf')).toHaveLength(6);
    const colors = new Set(buildCells().map((c) => String((c.style as Record<string, unknown>)['--c'])));
    expect(colors.size).toBe(CUBE_SPECTRUM.length);
    // Farben nur als Token-Verweis, keine festen Hex-Werte in der Komponente.
    for (const col of colors) expect(col).toMatch(/^var\(--rs-g-spectrum-\d\)$/);
  });

  it('jeder Teilwürfel fliegt beim Zerfall von seiner Position weg (auch der mittlere)', () => {
    for (const c of buildCells()) {
      const st = c.style as Record<string, string | number>;
      const d = Math.hypot(Number(st['--dx']), Number(st['--dy']), Number(st['--dz']));
      expect(d, c.key).toBeGreaterThan(1);
    }
    const css = read('src/styles/glass-cube.css');
    expect(css).toContain('@keyframes gc-burst');
    expect(css).toContain('@property --ink');
  });

  it('bleibt bei prefers-reduced-motion statisch', () => {
    stubMotion(true);
    render(<GlassCube />);
    expect(screen.getByTestId('glass-cube')).toHaveAttribute('data-still', 'true');
    const css = read('src/styles/glass-cube.css');
    expect(css).toContain('@media (prefers-reduced-motion: reduce)');
    expect(css).toContain(".gc-stage[data-still='true'] .gc-cube");
    expect(css).toMatch(/\.gc-stage\[data-still='true'\] \.gc-cell \{ --ink: 0\.45; \}/);
  });

  it('kommt ohne WebGL/three.js aus und blockiert keine Eingaben außerhalb der Bühne', () => {
    const src = read('src/components/neon/GlassCube.tsx');
    expect(src).not.toMatch(/from 'three'|@react-three|getContext\(/);
    const css = read('src/styles/glass-cube.css');
    expect(css).not.toMatch(/position:\s*fixed/);
    expect(css).toMatch(/\.gc-stage \{[\s\S]*?overflow: hidden/);
  });
});

describe('GlassPanel', () => {
  it('rendert das gewünschte Element mit Glasklasse', () => {
    render(<GlassPanel as="section" aria-label="Test" glow>Inhalt</GlassPanel>);
    const el = screen.getByRole('region', { name: 'Test' });
    expect(el.tagName).toBe('SECTION');
    expect(el).toHaveClass('rs-g-panel');
    expect(el).toHaveAttribute('data-glow', 'true');
  });
});

describe('Glas-Tokens', () => {
  const css = read('src/styles/glass-tokens.css');

  it('sind gescoped (kein :root/body/html) und enthalten keine Statusfarben', () => {
    const rules = css.replace(/\/\*[\s\S]*?\*\//g, '');
    expect(rules).not.toMatch(/^\s*(:root|body|html)\b/m);
    expect(css).not.toMatch(/--rs-g-(success|warning|danger|error)\s*:/);
  });

  it('Text-Tokens erreichen mindestens 4,5:1 auf dem Hintergrund', () => {
    const bg = token(css, '--rs-g-bg');
    for (const name of ['--rs-g-fg', '--rs-g-fg-2', '--rs-g-cyan', '--rs-g-violet-ink']) {
      expect(contrast(token(css, name), bg), name).toBeGreaterThanOrEqual(4.5);
    }
    // Auch auf der Sekundärfläche (Midnight Navy).
    const bg2 = token(css, '--rs-g-bg-2');
    expect(contrast(token(css, '--rs-g-fg-2'), bg2)).toBeGreaterThanOrEqual(4.5);
  });
});
