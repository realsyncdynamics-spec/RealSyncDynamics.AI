import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const css = readFileSync('src/styles/landing-v8/landing-v8.css', 'utf8');
const tokens = readFileSync('src/styles/landing-v8/tokens.css', 'utf8');

describe('Landing v8 Rahmen', () => {
  it('führt control und focus als eigene Tokens, default als Alias des Dividers', () => {
    expect(tokens).toContain('--color-border-control: #7F8186');
    expect(tokens).toContain('--color-border-focus: #7F8186');
    expect(tokens).toContain('--color-border-divider: #E6E9EE');
    expect(tokens).toContain('--color-border-default: var(--color-border-divider)');
  });

  it('nutzt control und focus für Secondary-Button, Felder und Fokus-Ring', () => {
    expect(css).toContain('border-color: var(--color-border-control)');
    expect(css).toContain('outline: 2px solid var(--color-border-focus)');
    expect(css).toContain('border: 1px solid var(--color-border-control)');
    expect(css).not.toMatch(/#[0-9A-Fa-f]{3,8}/);
  });
});
