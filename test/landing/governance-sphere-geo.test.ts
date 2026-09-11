import { describe, expect, it } from 'vitest';
import {
  CAPITAL_ZOOM,
  WORLD_CAPITALS,
  capitalsVisibleAtZoom,
} from '../../src/components/governance-frontend/geo/capitals';
import { CONTINENT_LABELS } from '../../src/components/governance-frontend/geo/continents';
import { governanceGeoSummary } from '../../src/components/governance-frontend/SphereGeography';
import { DISTANT_PLANETS } from '../../src/components/governance-frontend/SphereSpaceBackground';

describe('Governance Sphere geography LOD', () => {
  it('exposes continents and a curated capital catalog', () => {
    expect(CONTINENT_LABELS.length).toBeGreaterThanOrEqual(6);
    expect(WORLD_CAPITALS.some((c) => c.name === 'Berlin')).toBe(true);
    expect(WORLD_CAPITALS.every((c) => c.iso2.length === 2)).toBe(true);
    expect(governanceGeoSummary().bordersUrl).toContain('earth-borders');
  });

  it('progressively discloses capitals by zoom (desktop)', () => {
    expect(capitalsVisibleAtZoom(1.0, false)).toHaveLength(0);
    const t1 = capitalsVisibleAtZoom(CAPITAL_ZOOM.tier1, false);
    expect(t1.length).toBeGreaterThan(10);
    expect(t1.every((c) => c.tier === 1)).toBe(true);
    const t2 = capitalsVisibleAtZoom(CAPITAL_ZOOM.tier2, false);
    expect(t2.length).toBeGreaterThan(t1.length);
    const t3 = capitalsVisibleAtZoom(CAPITAL_ZOOM.tier3, false);
    expect(t3.length).toBe(WORLD_CAPITALS.length);
  });

  it('keeps mobile capital density lower until closer zoom', () => {
    const desk = capitalsVisibleAtZoom(CAPITAL_ZOOM.tier2, false);
    const mobile = capitalsVisibleAtZoom(CAPITAL_ZOOM.tier2, true);
    expect(mobile.length).toBeLessThanOrEqual(desk.length);
  });

  it('places required distant planets far from Earth', () => {
    const ids = DISTANT_PLANETS.map((p) => p.id);
    for (const id of ['mars', 'jupiter', 'saturn', 'uranus', 'neptune', 'pluto']) {
      expect(ids).toContain(id);
    }
    for (const p of DISTANT_PLANETS) {
      const dist = Math.hypot(...p.position);
      expect(dist).toBeGreaterThan(15);
    }
    expect(DISTANT_PLANETS.find((p) => p.id === 'saturn')?.ring).toBeTruthy();
  });
});
