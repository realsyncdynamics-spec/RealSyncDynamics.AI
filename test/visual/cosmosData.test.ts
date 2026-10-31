import { describe, expect, it } from 'vitest';
import {
  CELESTIAL_BODIES,
  clampSimulationSpeed,
  orbitPosition,
} from '../../src/components/visual/cosmosData';

describe('COSMOS visual orbit model', () => {
  it('contains eight uniquely identified planets with increasing visible orbit radii', () => {
    expect(CELESTIAL_BODIES).toHaveLength(8);
    expect(new Set(CELESTIAL_BODIES.map((body) => body.id)).size).toBe(8);
    expect(CELESTIAL_BODIES.map((body) => body.orbit))
      .toEqual([...CELESTIAL_BODIES.map((body) => body.orbit)].sort((a, b) => a - b));
  });
  it('keeps each planet on the XZ orbital plane', () => {
    for (const planet of CELESTIAL_BODIES) {
      const [x, y, z] = orbitPosition(planet.orbit, planet.phase, planet.speed, 42);
      expect(y).toBe(0);
      expect(Math.hypot(x, z)).toBeCloseTo(planet.orbit, 8);
    }
  });
  it('clamps invalid simulation-speed inputs', () => {
    expect(clampSimulationSpeed(-100)).toBe(0);
    expect(clampSimulationSpeed(Number.NaN)).toBe(0);
    expect(clampSimulationSpeed(Number.POSITIVE_INFINITY)).toBe(0);
    expect(clampSimulationSpeed(1.4)).toBe(1.4);
    expect(clampSimulationSpeed(50)).toBe(3);
  });
});
