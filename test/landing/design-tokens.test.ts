import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  LANDING_ACCENT,
  LANDING_ACCENT_SOFT,
  LANDING_BG,
  LANDING_BUTTON_TEXT,
  LANDING_MUTED,
  LANDING_PANEL,
  LANDING_TEXT,
} from '../../src/components/landing/landing-theme';
import { CSS_VAR, PRIMITIVE, SEMANTIC } from '../../src/components/landing/token-architecture';

const css = readFileSync(
  resolve(__dirname, '../../src/styles/landing-tokens.css'),
  'utf8',
);

describe('design token architecture', () => {
  it('binds primitives into landing-tokens.css', () => {
    for (const hex of [
      LANDING_BG,
      LANDING_PANEL,
      LANDING_TEXT,
      LANDING_MUTED,
      LANDING_ACCENT,
      LANDING_ACCENT_SOFT,
      LANDING_BUTTON_TEXT,
    ]) {
      expect(css).toContain(hex);
    }
    expect(css).toContain('--rsd-accent:');
    expect(css).toContain('--rsd-bg:');
  });

  it('keeps semantic roles on primitives', () => {
    expect(SEMANTIC.surface.canvas).toBe(PRIMITIVE.color.void);
    expect(SEMANTIC.action.fill).toBe(PRIMITIVE.color.signal);
    expect(SEMANTIC.type.headline).toBe(PRIMITIVE.font.serif);
    expect(CSS_VAR.action.fill).toBe('--rsd-accent');
  });

  it('does not put plan prices in the token layer', () => {
    const arch = readFileSync(
      resolve(__dirname, '../../src/components/landing/token-architecture.ts'),
      'utf8',
    );
    expect(arch).not.toMatch(/79|249|699/);
  });
});
