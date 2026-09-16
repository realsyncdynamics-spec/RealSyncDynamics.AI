import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('builder routes', () => {
  it('registers /builder/:slug/code before /builder/:slug', () => {
    const src = readFileSync(resolve(__dirname, '../../src/App.tsx'), 'utf8');
    const code = src.indexOf('path="/builder/:slug/code"');
    const puck = src.indexOf('path="/builder/:slug"');
    expect(code).toBeGreaterThan(-1);
    expect(puck).toBeGreaterThan(-1);
    expect(code).toBeLessThan(puck);
  });

  it('code page uses canonical canOpenAppBuilder only — no fail-open OR', () => {
    const src = readFileSync(resolve(__dirname, '../../src/features/app-builder/BoltCodeBuilderPage.tsx'), 'utf8');
    expect(src).not.toMatch(/canOpenAppBuilder\(snapshot\)\s*\|\|/);
    expect(src).toMatch(/canOpenAppBuilder\(snapshot\)/);
  });
});
