import { describe, expect, it } from 'vitest';
import {
  clampPlanetScale, ORIGINAL_TEXTURE_ATTRIBUTION, originalTextureUrl, scaledRadius,
} from '../../src/components/visual/cosmosOriginalTextures';
import { CELESTIAL_BODIES } from '../../src/components/visual/cosmosData';

describe('COSMOS original planet textures and visual scaling', () => {
  it('provides a version-pinned, predictable original texture for all eight planets plus Sun and Moon', () => {
    for (const body of [
      'sun', 'moon', ...CELESTIAL_BODIES.map(x => x.id),
    ] as const) {
      const uri = originalTextureUrl(body);
      expect(uri).toMatch(/^https:\/\/cdn\.jsdelivr\.net\/gh\/Sanghel\/solar-system-3d@[a-f0-9]{40}\/public\/textures\//);
      expect(uri).toMatch(/\.jpg$/);
      expect(uri).not.toContain('..');
    }
    expect(ORIGINAL_TEXTURE_ATTRIBUTION.license)
      .toContain('creativecommons.org/licenses/by/4.0');
    expect(() => originalTextureUrl('pluto' as 'mercury')).toThrow(RangeError);
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
