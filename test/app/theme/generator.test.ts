import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { CSSProperties } from 'react';
import { previewStyle } from '../../../src/app/ThemeGeneratorPreview';
import { contrastRatio } from '../../../src/app/theme/contrast';
import { fixtureThemeCatalog, fingerprintFromVars } from '../../../src/app/theme/generator/catalog';
import { distanceVerdict, pairDistance, type ThemeAxes, type ThemeFingerprint } from '../../../src/app/theme/generator/distance';
import { generateTheme, hueOffsetDegrees, publishTheme, remixTheme, validateInput } from '../../../src/app/theme/generator/generate';
import { canonicalJson, sha256Hex } from '../../../src/app/theme/generator/hash';
import { deltaEOklch, hexToOklch } from '../../../src/app/theme/generator/oklch';
import { splitMotionStyle } from '../../../src/app/theme/motionStyle';
import { DIMENSION_WEIGHTS, DISTANCE_BLEND, MIN_ACCENT_DELTA_E, MIN_SURFACE_DELTA_L, PUBLISH_MIN_DISTANCE, SOFT_WARN_DISTANCE, passesBrandGuard } from '../../../src/app/theme/generator/weights';

const input = {
  industry: 'kanzlei-beratung' as const,
  tone: 'sachlich-formal' as const,
  primaryColor: '#1B3A4B',
};

function axesApart(count: number): ThemeAxes {
  return {
    'header-type': count >= 1 ? 'split' : 'solid',
    'card-style': count >= 2 ? 'glass' : 'raised',
    'sidebar-form': count >= 3 ? 'floating' : 'rail',
  };
}

function finger(id: string, axes: ThemeFingerprint['axes'], accent = '#111111', surface = '#FFFFFF'): ThemeFingerprint {
  return fingerprintFromVars(id, {
    '--color-accent-primary': accent,
    '--color-surface-default': surface,
    '--type-family-display': 'Inter',
    '--type-family-body': 'Inter',
    '--type-size-body': '16px',
    '--space-400': '24px',
    '--radius-md': '10px',
    '--motion-duration-base': '200ms',
    '--depth-2-y': '8px',
  }, axes, [0.5, 0.5, 0.5]);
}

function verdictNear(
  target: number,
  gate: { deltaE: number; deltaL: number; distinctAxes: number },
): { pair: ReturnType<typeof pairDistance>; result: ReturnType<typeof distanceVerdict> } {
  const other = {
    ...finger('bestand', axesApart(0)),
    accent: { l: 0, c: 0, h: 0 },
    surfaceL: 40,
    density: 0,
  };
  let lo = 0;
  let hi = 1;
  let candidate: ThemeFingerprint = {
    ...finger('kandidat', axesApart(gate.distinctAxes)),
    accent: { l: gate.deltaE, c: 0, h: 0 },
    surfaceL: 40 + gate.deltaL,
    density: 0,
  };
  for (let step = 0; step < 48; step += 1) {
    const mid = (lo + hi) / 2;
    candidate = { ...candidate, density: mid };
    const current = pairDistance(candidate, other);
    if (current.d < target) lo = mid;
    else hi = mid;
  }
  const pair = pairDistance(candidate, other);
  return { pair, result: distanceVerdict(candidate, [other]) };
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

  it('blockt nur den Abstand, wenn Farbe und Achsen reichen', () => {
    const verdict = verdictNear(PUBLISH_MIN_DISTANCE - 0.01, { deltaE: MIN_ACCENT_DELTA_E, deltaL: 0, distinctAxes: 3 });
    expect(verdict.pair.deltaE).toBeGreaterThanOrEqual(MIN_ACCENT_DELTA_E);
    expect(verdict.pair.distinctAxes).toBe(3);
    expect(verdict.pair.d).toBeLessThan(PUBLISH_MIN_DISTANCE);
    expect(verdict.result.hardPass).toBe(false);
    expect(verdict.result.reasons).toEqual(['Abstand unter 0,34']);
  });

  it('lässt Abstand 0,34 durch und warnt unter 0,42', () => {
    const gate = { deltaE: MIN_ACCENT_DELTA_E, deltaL: 0, distinctAxes: 3 };
    const at = verdictNear(PUBLISH_MIN_DISTANCE, gate);
    const under = verdictNear(SOFT_WARN_DISTANCE - 0.01, gate);
    const on = verdictNear(SOFT_WARN_DISTANCE, gate);
    const over = verdictNear(SOFT_WARN_DISTANCE + 0.01, gate);
    expect(at.pair.d).toBeGreaterThanOrEqual(PUBLISH_MIN_DISTANCE);
    expect(at.pair.d).toBeLessThan(PUBLISH_MIN_DISTANCE + 0.005);
    expect(at.result.hardPass).toBe(true);
    expect(at.result.remix).toBe(true);
    expect(under.result.hardPass).toBe(true);
    expect(under.result.remix).toBe(true);
    expect(on.pair.d).toBeGreaterThanOrEqual(SOFT_WARN_DISTANCE);
    expect(on.result.remix).toBe(false);
    expect(over.result.hardPass).toBe(true);
    expect(over.result.remix).toBe(false);
  });

  it('grenzt ΔE 12 und |ΔL| 18 unabhängig vom Abstand', () => {
    const passE = verdictNear(0.5, { deltaE: MIN_ACCENT_DELTA_E, deltaL: 0, distinctAxes: 3 });
    const failE = verdictNear(0.5, { deltaE: MIN_ACCENT_DELTA_E - 0.01, deltaL: 0, distinctAxes: 3 });
    const passL = verdictNear(0.5, { deltaE: 0, deltaL: MIN_SURFACE_DELTA_L, distinctAxes: 3 });
    const failL = verdictNear(0.5, { deltaE: 0, deltaL: MIN_SURFACE_DELTA_L - 0.01, distinctAxes: 3 });
    expect(passE.pair.deltaE).toBeCloseTo(MIN_ACCENT_DELTA_E, 2);
    expect(passE.result.hardPass).toBe(true);
    expect(failE.result.hardPass).toBe(false);
    expect(failE.result.reasons).toContain('Accent und Surface zu nah');
    expect(passL.pair.deltaL).toBeCloseTo(MIN_SURFACE_DELTA_L, 2);
    expect(passL.result.hardPass).toBe(true);
    expect(failL.result.hardPass).toBe(false);
    expect(failL.result.reasons).toEqual(['Accent und Surface zu nah']);
  });

  it('blockt nur die Achsen, wenn Abstand und Farbe reichen', () => {
    const verdict = verdictNear(0.5, { deltaE: 20, deltaL: 20, distinctAxes: 1 });
    expect(verdict.pair.d).toBeGreaterThanOrEqual(PUBLISH_MIN_DISTANCE);
    expect(verdict.result.hardPass).toBe(false);
    expect(verdict.result.reasons).toEqual(['Weniger als zwei Achsen verschieden']);
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
    expect(result.iterations).toBeLessThanOrEqual(8);
    expect(result.iterations).toBeGreaterThan(0);
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

  it('grenzt den Brand-Guard bei 24° und ΔE 10', () => {
    expect(passesBrandGuard(24, 0)).toBe(true);
    expect(passesBrandGuard(24.1, 0)).toBe(false);
    expect(passesBrandGuard(0, 10)).toBe(true);
    expect(passesBrandGuard(0, 10.01)).toBe(false);
    expect(passesBrandGuard(24, 10)).toBe(true);
    expect(passesBrandGuard(24, 10.01)).toBe(false);
  });

  it('dreht die Hue relativ zum Original: +12, −12, +24, −24, +36', () => {
    expect(hueOffsetDegrees(0)).toBe(12);
    expect(hueOffsetDegrees(1)).toBe(-12);
    expect(hueOffsetDegrees(2)).toBe(24);
    expect(hueOffsetDegrees(3)).toBe(-24);
    expect(hueOffsetDegrees(4)).toBe(36);
    expect(hueOffsetDegrees(4)).not.toBe(0);
  });

  it('lehnt eine Hauptfarbe ab, die kein Hex ist', () => {
    expect(() => validateInput({ industry: 'kanzlei-beratung', tone: 'sachlich-formal', primaryColor: 'navy' })).toThrow(/Hex/);
    expect(() => generateTheme({ industry: 'kanzlei-beratung', tone: 'sachlich-formal', primaryColor: '#12345' })).toThrow(/Hex/);
  });

  it('veröffentlicht den Preview-Default und die vier Branchen gegen den Fixture-Katalog', () => {
    const catalog = fixtureThemeCatalog();
    const cases = [
      { name: 'preview', industry: 'handwerk-regional' as const, tone: 'warm-nahbar' as const, primaryColor: '#C45C26' },
      { name: 'b2b-saas', industry: 'b2b-saas' as const, tone: 'technisch-praezise' as const, primaryColor: '#2457E6' },
      { name: 'kanzlei', industry: 'kanzlei-beratung' as const, tone: 'sachlich-formal' as const, primaryColor: '#1B3A4B' },
      { name: 'gesundheit', industry: 'gesundheit' as const, tone: 'ruhig-vertrauensvoll' as const, primaryColor: '#0E7C66' },
    ];
    for (const item of cases) {
      const result = generateTheme(item, catalog);
      const published = publishTheme(result, catalog);
      expect(result.iterations, item.name).toBeLessThanOrEqual(8);
      expect(result.wcag.ok, item.name).toBe(true);
      expect(result.status, `${item.name} ${result.reasons.join('; ')}`).not.toBe('needs-editor');
      expect(published.status, item.name).toBe(result.status);
      expect(published.wcag.ok, item.name).toBe(true);
      for (const pair of result.distance.pairs) {
        const again = published.distance.pairs.find((entry) => entry.id === pair.id);
        expect(again?.d, pair.id).toBeCloseTo(pair.d, 2);
      }
      if (item.name === 'preview' || item.name === 'kanzlei') {
        const fixtureId = item.name === 'preview' ? 'beispiel-handwerk' : 'beispiel-kanzlei';
        const fixture = catalog.list().find((theme) => theme.id === fixtureId);
        const accent = hexToOklch(result.overlay['color/accent/primary']!);
        const surfaceL = hexToOklch(result.overlay['color/surface/default']!).l;
        const deltaE = deltaEOklch(accent, fixture!.accent);
        const deltaL = Math.abs(surfaceL - fixture!.surfaceL);
        const inputAccent = hexToOklch(item.primaryColor);
        const shift = Math.abs((((accent.h - inputAccent.h + 540) % 360) - 180));
        const brandDelta = deltaEOklch(accent, inputAccent);
        expect(shift, item.name).toBeLessThanOrEqual(24);
        expect(brandDelta, item.name).toBeLessThanOrEqual(10);
        if (item.name === 'preview') expect(result.overlay['color/accent/primary']).not.toBe('#9D7A00');
        if (item.name === 'kanzlei') expect(result.overlay['color/accent/primary']).toBe('#1B3A4B');
        if (deltaE < 12) expect(deltaL, `${item.name} Hex-Roundtrip |ΔL|`).toBeGreaterThanOrEqual(18);
      }
      if (item.name === 'preview') {
        const meta = (result.document.$extensions as {
          'com.rsd.meta': { axes_not_in_semantic_111: unknown; axes_not_in_semantic_109: unknown };
        })['com.rsd.meta'];
        expect(meta.axes_not_in_semantic_111).toEqual(meta.axes_not_in_semantic_109);
      }
    }
  });

  it('hält AA im Remix und übernimmt keinen Kontrastbruch', () => {
    const catalog = fixtureThemeCatalog();
    const preview = generateTheme({
      industry: 'handwerk-regional',
      tone: 'warm-nahbar',
      primaryColor: '#C45C26',
    }, catalog);
    const remixed = remixTheme(preview, catalog);
    expect(remixed.wcag.ok).toBe(true);
    expect(remixed.status).not.toBe('needs-editor');
    const broken = remixTheme({
      ...preview,
      overlay: { ...preview.overlay, 'color/text/primary': preview.overlay['color/surface/default']! },
    }, catalog);
    expect(broken.wcag.ok).toBe(false);
    expect(broken.status).toBe('needs-editor');
    expect(broken.remixOffer).toBe(false);
  });

  it('setzt Motion-Dauern nicht inline auf die Hülle', () => {
    const catalog = fixtureThemeCatalog();
    const preview = generateTheme({
      industry: 'handwerk-regional',
      tone: 'warm-nahbar',
      primaryColor: '#C45C26',
    }, catalog);
    const painted = previewStyle(preview.overlay);
    expect(painted.style).not.toHaveProperty('--motion-duration-base');
    expect(painted.motionCss).toContain('prefers-reduced-motion: no-preference');
    expect(painted.motionCss).toContain('--motion-duration-base');
    const shell = readFileSync('src/app/shell.css', 'utf8');
    expect(shell).toMatch(/prefers-reduced-motion: reduce[\s\S]*animation-duration:\s*0\.01ms/);
    const inline = splitMotionStyle({
      '--color-surface-default': '#F7F3EB',
      '--motion-duration-base': '240ms',
    } as CSSProperties, 'beispiel-handwerk');
    expect(inline.style).not.toHaveProperty('--motion-duration-base');
    expect(inline.motionCss).toContain('prefers-reduced-motion: no-preference');
    expect(inline.motionCss).toContain('--motion-duration-base: 240ms;');
    expect(readFileSync('src/app/AppShell.tsx', 'utf8')).toContain('theme.motionCss');
  });

  it('nutzt den Akzent nicht als Text- oder Linkfarbe', () => {
    const catalog = fixtureThemeCatalog();
    const preview = generateTheme({
      industry: 'handwerk-regional',
      tone: 'warm-nahbar',
      primaryColor: '#C45C26',
    }, catalog);
    const accent = preview.overlay['color/accent/primary']!;
    const surface = preview.overlay['color/surface/default']!;
    expect(contrastRatio(accent, surface)).toBeLessThan(4.5);
    const files = ['src/app/shell.css', 'src/app/theme/tokens.shell.css', 'src/app/theme/dna-themes.shell.css'];
    for (const file of files) {
      const withoutProps = readFileSync(file, 'utf8').replace(/--[\w-]+\s*:\s*[^;]+;/g, '');
      expect(withoutProps, file).not.toMatch(/color:\s*var\(--color-accent-primary\)/);
    }
  });
});
