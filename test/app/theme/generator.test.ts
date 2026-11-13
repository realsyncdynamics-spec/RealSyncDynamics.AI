import { describe, expect, it } from 'vitest';
import { fingerprintFromVars } from '../../../src/app/theme/generator/catalog';
import { distanceVerdict, pairDistance, type ThemeFingerprint } from '../../../src/app/theme/generator/distance';
import { generateTheme, publishTheme } from '../../../src/app/theme/generator/generate';
import { canonicalJson, sha256Hex } from '../../../src/app/theme/generator/hash';
import { deltaEOklch, hexToOklch } from '../../../src/app/theme/generator/oklch';
import { DIMENSION_WEIGHTS, DISTANCE_BLEND } from '../../../src/app/theme/generator/weights';

const input = {
  industry: 'kanzlei-beratung' as const,
  tone: 'sachlich-formal' as const,
  primaryColor: '#1B3A4B',
};

function finger(id: string, axes: ThemeFingerprint['axes']): ThemeFingerprint {
  return fingerprintFromVars(id, {
    '--color-accent-primary': '#111111',
    '--color-surface-default': '#FFFFFF',
    '--type-family-display': 'Inter',
    '--type-family-body': 'Inter',
    '--type-size-body': '16px',
    '--space-400': '24px',
    '--radius-md': '10px',
    '--motion-duration-base': '200ms',
    '--depth-2-y': '8px',
  }, axes, [0.5, 0.5, 0.5]);
}

describe('Theme-Generator', () => {
  it('hashes the empty string with SHA-256', () => {
    expect(sha256Hex('')).toBe('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
    expect(sha256Hex('abc')).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  });

  it('rechnet D aus kontinuierlichem Anteil und Achsen', () => {
    const left = finger('a', { 'header-type': 'solid', 'card-style': 'raised', 'sidebar-form': 'rail' });
    const right = finger('b', { 'header-type': 'split', 'card-style': 'glass', 'sidebar-form': 'floating' });
    const pair = pairDistance(left, right);
    const continuous = Math.sqrt(Object.values(DIMENSION_WEIGHTS).reduce((sum, weight) => sum + weight * 0 ** 2, 0));
    expect(pair.distinctAxes).toBe(3);
    expect(pair.d).toBeCloseTo(DISTANCE_BLEND.continuous * continuous + DISTANCE_BLEND.axes * 1, 6);
    expect(deltaEOklch(left.accent, left.accent)).toBe(0);
    expect(pairDistance(left, { ...right, id: 'c', axes: left.axes, accent: hexToOklch('#00FF00') }).distinctAxes).toBe(0);
  });

  it('blockt unter 0,34 und bei weniger als zwei Achsen', () => {
    const left = finger('a', { 'header-type': 'solid', 'card-style': 'raised', 'sidebar-form': 'rail' });
    const close = finger('b', { 'header-type': 'solid', 'card-style': 'raised', 'sidebar-form': 'floating' });
    const verdict = distanceVerdict(left, [close]);
    expect(verdict.hardPass).toBe(false);
    expect(verdict.reasons.join(' ')).toMatch(/Achsen|Abstand/);
  });

  it('liefert bei gleicher Eingabe denselben Hash und höchstens 8 Iterationen', () => {
    const catalog = { list: () => [] as ThemeFingerprint[] };
    const first = generateTheme(input, catalog);
    const second = generateTheme(input, catalog);
    expect(first.hash).toBe(second.hash);
    expect(first.hash).toBe(sha256Hex(canonicalJson({ overlay: first.overlay, axes: first.axes, modules: first.modules })));
    expect(first.iterations).toBeLessThanOrEqual(8);
    expect(first.wcag.ok).toBe(true);
    expect(publishTheme(first, catalog).status).not.toBe('needs-editor');
  });

  it('stoppt nach 8 Iterationen, wenn die Achsen gesperrt zu nah bleiben', () => {
    const axes = { 'header-type': 'solid', 'card-style': 'raised', 'sidebar-form': 'rail' } as const;
    const catalog = { list: () => [finger('nachbar', axes)] };
    const result = generateTheme({
      ...input,
      industry: 'handwerk-regional',
      locks: { axes: ['header-type', 'card-style', 'sidebar-form'] },
    }, catalog);
    expect(result.iterations).toBe(8);
    expect(result.status).toBe('needs-editor');
  });

  it('lehnt einen Publish ab, dessen Overlay AA verfehlt', () => {
    const catalog = { list: () => [] as ThemeFingerprint[] };
    const result = generateTheme(input, catalog);
    const broken = {
      ...result,
      overlay: { ...result.overlay, 'color/text/primary': result.overlay['color/surface/default']! },
    };
    const published = publishTheme(broken, catalog);
    expect(published.wcag.ok).toBe(false);
    expect(published.status).toBe('needs-editor');
    expect(published.reasons.join(' ')).toMatch(/WCAG/);
  });
});
