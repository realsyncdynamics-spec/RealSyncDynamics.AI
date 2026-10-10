import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const css = readFileSync(join(__dirname, '../../../src/styles/command-center.css'), 'utf8');

describe('command-center.css', () => {
  it.each([
    '.cc-page', '.cc-page__head', '.cc-page__title', '.cc-page__meta',
    '.cc-split', '.cc-intent', '.cc-intent__field', '.cc-intent__go',
    '.cc-chain-row', '.cc-chain-row__type', '.cc-chain-row__title', '.cc-chain-row__time',
    '.cc-panel__error', '.cc-panel__empty', '.cc-finding--link',
  ])('defines %s', (cls) => {
    expect(css).toMatch(new RegExp(`\\${cls}[\\s{:,.]`));
  });

  it('uses only --brand-* custom properties', () => {
    const vars = [...css.matchAll(/var\((--[a-z0-9-]+)/g)].map((m) => m[1]);
    expect(vars.length).toBeGreaterThan(0);
    expect(vars.filter((v) => !v.startsWith('--brand-'))).toEqual([]);
  });

  it('has focus-visible rings for intent and link rows', () => {
    expect(css).toContain('.cc-intent__go:focus-visible');
    expect(css).toContain('.cc-finding--link:focus-visible');
  });
});
