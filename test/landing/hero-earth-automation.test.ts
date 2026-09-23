import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('landing earth automation fallback', () => {
  const source = readFileSync(
    resolve(__dirname, '../../src/components/landing/HeroEarthBackdrop.tsx'),
    'utf8',
  );

  it('detects browser automation explicitly', () => {
    expect(source).toContain("Boolean(navigator.webdriver)");
  });

  it('renders the static earth instead of mounting the 3D scene in automation', () => {
    expect(source).toContain('reducedMotion || automation');
    expect(source).toMatch(/reducedMotion \|\| automation[\s\S]*?<StaticEarthPlane \/>/);
    expect(source).toMatch(/<Suspense[\s\S]*?<HeroEarthBackdropScene reducedMotion=\{false\} \/>/);
  });

  it('keeps the interactive earth path for normal browsers', () => {
    expect(source).toContain("const HeroEarthBackdropScene = lazy(() => import('./HeroEarthBackdropScene'))");
  });
});
