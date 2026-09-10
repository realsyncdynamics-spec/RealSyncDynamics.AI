import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * Smoke checks for the /welcome Earth panel wiring — keep auth flows intact
 * while ensuring the photoreal globe is mounted in the desktop layout.
 */
describe('Welcome Earth panel', () => {
  const welcome = readFileSync(resolve('src/pages/Welcome.tsx'), 'utf8');
  const host = readFileSync(resolve('src/components/visual/PhotorealEarthGlobe.tsx'), 'utf8');
  const scene = readFileSync(resolve('src/components/visual/PhotorealEarthScene.tsx'), 'utf8');

  it('mounts PhotorealEarthGlobe on /welcome', () => {
    expect(welcome).toContain("import { PhotorealEarthGlobe } from '../components/visual/PhotorealEarthGlobe'");
    expect(welcome).toContain('<PhotorealEarthGlobe />');
  });

  it('keeps Magic-Link + OAuth entry points', () => {
    expect(welcome).toContain('OAuthProviderButtons');
    expect(welcome).toContain('signInWithOtp');
    expect(welcome).toContain('Magic-Link senden');
  });

  it('lazy-loads 3D and falls back to europe-globe for reduced motion', () => {
    expect(host).toContain("lazy(() => import('./PhotorealEarthScene'))");
    expect(host).toContain('prefers-reduced-motion');
    expect(host).toContain('/europe-globe.webp');
    expect(host).toContain('hidden');
    expect(host).toContain('lg:block');
  });

  it('uses the local photoreal Earth day texture', () => {
    const mesh = readFileSync(resolve('src/components/visual/PhotorealEarthMesh.tsx'), 'utf8');
    expect(scene).toContain('PhotorealEarthMesh');
    expect(mesh).toContain('/textures/earth-day.jpg');
    expect(mesh).toContain('meshBasicMaterial');
  });
});
