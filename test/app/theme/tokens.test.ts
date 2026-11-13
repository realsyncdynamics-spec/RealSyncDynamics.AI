import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { PRIMARY_BUTTON } from '../../../src/app/theme/buttonVariants';
import { contrastGaps, contrastRatio, REPORTED_PAIRS, REQUIRED_TEXT_PAIRS } from '../../../src/app/theme/contrast';
import { assertDnaWithinBase, designDna, dnaOverlayStyle, parseDnaOverlay } from '../../../src/app/theme/dna';
import { resolveTheme } from '../../../src/app/theme/resolve';
import { semanticCssName, TokenSchemaError } from '../../../src/app/theme/schema';
import tokens from '../../../src/app/theme/tokens.json';

const shellSource = readFileSync('src/app/AppShell.tsx', 'utf8');
const button = (tokens as { component: { button: Record<string, { $value: string }> } }).component.button;

describe('Token-Schema und DNA-Overlay', () => {
  it('bildet den Primary-Button auf text/primary und text/inverse ab, nicht auf accent', () => {
    expect(button['bg-primary']?.$value).toBe('{semantic.color.text.primary}');
    expect(button['text-primary']?.$value).toBe('{semantic.color.text.inverse}');
    expect(button['bg-primary']?.$value).not.toContain('accent');
    expect(PRIMARY_BUTTON.backgroundToken).toBe('color/text/primary');
    expect(PRIMARY_BUTTON.labelToken).toBe('color/text/inverse');
    expect(PRIMARY_BUTTON.notBackgroundToken).toBe('color/accent/primary');
    for (const mode of ['light-cream', 'pure-white-silver', 'warm-graphite'] as const) {
      const css = resolveTheme(mode);
      expect(css['--button-bg-primary']).toBe(css['--color-text-primary']);
      expect(css['--button-text-primary']).toBe(css['--color-text-inverse']);
      expect(css['--button-bg-primary']).not.toBe(css['--color-accent-primary']);
      expect(contrastRatio(css['--color-text-inverse']!, css['--color-text-primary']!)).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('lässt DNA nur semantische Namen überschreiben und erbt den Rest', () => {
    expect(() => parseDnaOverlay({ primitives: {}, semantic: {} })).toThrow(TokenSchemaError);
    expect(() => semanticCssName('primitives.color.white')).toThrow(TokenSchemaError);
    assertDnaWithinBase();
    const leaves = designDna();
    expect(leaves).toHaveLength(63);
    const handwerk = dnaOverlayStyle('beispiel-handwerk') as Record<string, string>;
    expect(handwerk['--color-surface-default']).toBe('#F3E6D4');
    expect(handwerk['--color-status-success']).toBeUndefined();
    expect(shellSource.indexOf('tokens.shell.css')).toBeLessThan(shellSource.indexOf('dna-themes.shell.css'));
  });

  it('hält AA für die Textpaare der Hülle, inklusive der Beispiel-Overlays', () => {
    for (const mode of ['light-cream', 'pure-white-silver', 'warm-graphite'] as const) {
      expect(contrastGaps(resolveTheme(mode), REQUIRED_TEXT_PAIRS)).toEqual([]);
    }
    const base = resolveTheme('light-cream');
    for (const mode of ['beispiel-handwerk', 'beispiel-b2b-saas', 'beispiel-kanzlei'] as const) {
      const merged = { ...base, ...(dnaOverlayStyle(mode) as Record<string, string>) };
      expect(contrastGaps(merged, REQUIRED_TEXT_PAIRS), mode).toEqual([]);
      expect(contrastRatio(merged['--color-text-inverse']!, merged['--color-text-primary']!)).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('meldet Textpaare unter AA, ohne die Designer-Werte umzufärben', () => {
    const names = (mode: 'light-cream' | 'pure-white-silver' | 'warm-graphite') =>
      contrastGaps(resolveTheme(mode), REPORTED_PAIRS).map((gap) => gap.name);
    expect(names('light-cream')).toEqual([
      'text-muted/default',
      'text-micro/default',
      'kpi-label/metric',
      'footer/default',
      'hero-lead/default',
      'border/default',
      'sidebar-border',
    ]);
    const base = resolveTheme('light-cream');
    const overlayNames = (mode: 'beispiel-handwerk' | 'beispiel-b2b-saas' | 'beispiel-kanzlei') =>
      contrastGaps({ ...base, ...(dnaOverlayStyle(mode) as Record<string, string>) }, REPORTED_PAIRS).map((gap) => gap.name);
    expect(overlayNames('beispiel-handwerk')).toContain('text-micro/default');
    expect(overlayNames('beispiel-kanzlei')).toContain('text-micro/default');
    expect(overlayNames('beispiel-b2b-saas')).not.toContain('text-micro/default');
  });
});
