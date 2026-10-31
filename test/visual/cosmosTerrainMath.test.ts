import { describe, expect, it } from 'vitest';
import { terrainHeight, treeLocations } from '../../src/components/visual/cosmosTerrainMath';

describe('COSMOS fictional landscape', () => {
  it('produces finite elevations throughout the demo bounds', () => {
    for (let x = -50; x <= 50; x += 10) {
      for (let z = -50; z <= 50; z += 10) {
        expect(Number.isFinite(terrainHeight(x, z))).toBe(true);
      }
    }
  });

  it('is deterministic and keeps tree positions on the same terrain', () => {
    const first = treeLocations();
    expect(first.length).toBeGreaterThan(80);
    expect(first).toEqual(treeLocations());
    for (const [x, y, z] of first) {
      expect(y).toBeCloseTo(terrainHeight(x, z), 8);
      expect(Math.hypot(x + 18, z + 14)).toBeGreaterThanOrEqual(13);
    }
  });

  it('models a lowered fictional lake basin', () => {
    expect(terrainHeight(-18, -14))
      .toBeLessThan(terrainHeight(-18, 15));
  });
});
