import { describe, expect, it } from 'vitest';
import {
  clampPlanetScale, ORIGINAL_TEXTURE_ATTRIBUTION, originalTextureUrl, scaledRadius,
} from '../../src/components/visual/cosmosOriginalTextures';
import { CELESTIAL_BODIES } from '../../src/components/visual/cosmosData';

describe('COSMOS same-origin original planet maps and size scaling', () => {
  it('resolves all eight planets, Sun and Moon to local image assets', () => {
    for (const body of ['sun', 'moon', ...CELESTIAL_BODIES.map(x => x.id)] as const) {
      const url = originalTextureUrl(body);
      expect(url).toMatch(/^\/textures\//);
      expect(url).not.toContain('://');
      expect(url).not.toContain('..');
      expect(url).toMatch(/\.(webp|jpg)$/);
    }
    expect(originalTextureUrl('earth')).toBe('/textures/earth-day-2k.webp');
    expect(originalTextureUrl('moon')).toBe('/textures/cosmos/moon.jpg');
    expect(ORIGINAL_TEXTURE_ATTRIBUTION.license)
      .toContain('creativecommons.org/licenses/by/4.0');
    expect(() => originalTextureUrl('pluto' as 'mercury')).toThrow(RangeError);
    expect(() => originalTextureUrl('__proto__' as 'sun')).toThrow(RangeError);
  });

  it('clamps the schematic 3D scale to a safe visual range', () => {
    expect(clampPlanetScale(0.2)).toBe(0.6);
    expect(clampPlanetScale(99)).toBe(1.8);
    expect(clampPlanetScale(NaN)).toBe(1);
    expect(clampPlanetScale(1.33)).toBe(1.35);
    expect(scaledRadius(2, 1.5)).toBe(3);
    expect(() => scaledRadius(0, 1)).toThrow(RangeError);
  });
});
