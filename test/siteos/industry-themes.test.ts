/**
 * Branchen-Themes: jede Branche startet mit eigenem, AA-konformem Erscheinungsbild;
 * Optionen und Vorlagen überschreiben es weiterhin.
 */
import { describe, expect, it } from 'vitest';
import {
  INDUSTRY_PRESETS,
  INDUSTRY_THEMES,
  analyzeBlueprint,
  meetsWcagAA,
  parseBrief,
  safeFontStack,
  synthesizeBlueprint,
  THEME_FALLBACK,
} from '../../packages/siteos-core/src/index';
import type { IndustryKey } from '../../packages/siteos-core/src/types';

const KEYS = Object.keys(INDUSTRY_PRESETS) as IndustryKey[];

describe('INDUSTRY_THEMES', () => {
  it.each(KEYS.filter((k) => INDUSTRY_THEMES[k]))('%s besteht WCAG AA und nutzt nur sichere Schriftstapel', (key) => {
    const t = INDUSTRY_THEMES[key]!;
    expect(meetsWcagAA(t.foreground!, t.surface!)).toBe(true);
    expect(meetsWcagAA(t.accent!, t.surface!)).toBe(true);
    expect(meetsWcagAA(t.surface!, t.accent!)).toBe(true);
    expect(safeFontStack(t.fontDisplay)).toBe(t.fontDisplay);
    expect(safeFontStack(t.fontBody)).toBe(t.fontBody);
  });

  it('gibt Restaurant, Handwerk und Zahnarzt unterschiedliche Akzente', () => {
    const accents = new Set(['gastronomie', 'handwerk', 'zahnarzt'].map((k) => INDUSTRY_THEMES[k as IndustryKey]!.accent));
    expect(accents.size).toBe(3);
  });

  it('synthetisiert das Branchen-Theme und meldet keinen Kontrastbefund', () => {
    for (const prompt of ['Restaurant in Erfurt', 'Dachdecker in Suhl', 'Zahnarzt in Jena', 'Kanzlei für Arbeitsrecht']) {
      const brief = parseBrief(prompt);
      const bp = synthesizeBlueprint(brief);
      expect(bp.theme.accent).toBe(INDUSTRY_THEMES[brief.industry]!.accent);
      expect(analyzeBlueprint(bp).some((f) => (f.locator ?? '').startsWith('theme.'))).toBe(false);
    }
  });

  it('lässt sonstige Branchen beim Plattform-Default und Optionen gewinnen', () => {
    expect(synthesizeBlueprint(parseBrief('Etwas völlig anderes')).theme.accent).toBe(THEME_FALLBACK.accent);
    const bp = synthesizeBlueprint(parseBrief('Restaurant in Erfurt'), { theme: { accent: '#000000' } });
    expect(bp.theme.accent).toBe('#000000');
  });
});
