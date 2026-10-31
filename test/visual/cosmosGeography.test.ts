import { describe, expect, it } from 'vitest';
import {
  GEO_DESTINATIONS, globePoint, validCoordinates, formatCoordinates,
} from '../../src/components/visual/cosmosGeography';

describe('COSMOS geographic globe', () => {
  it('provides unique real-world location targets in valid WGS84 ranges', () => {
    expect(GEO_DESTINATIONS.length).toBeGreaterThanOrEqual(5);
    expect(new Set(GEO_DESTINATIONS.map((x) => x.id)).size)
      .toBe(GEO_DESTINATIONS.length);
    for (const location of GEO_DESTINATIONS) {
      expect(validCoordinates(location)).toBe(true);
      expect(Math.hypot(...globePoint(location))).toBeCloseTo(1, 10);
    }
  });

  it('uses equirectangular sphere coordinates consistently', () => {
    const origin = globePoint({ latitude: 0, longitude: 0 });
    expect(origin[0]).toBeCloseTo(1, 9);
    expect(origin[1]).toBeCloseTo(0, 9);
    expect(origin[2]).toBeCloseTo(0, 9);
    const east = globePoint({ latitude: 0, longitude: 90 }, 2);
    expect(east[0]).toBeCloseTo(0, 9);
    expect(east[2]).toBeCloseTo(-2, 9);
    const north = globePoint({ latitude: 90, longitude: 0 });
    expect(north[1]).toBeCloseTo(1, 9);
  });

  it('formats hemispheres without ambiguous signs', () => {
    expect(formatCoordinates({ latitude: 52.52, longitude: 13.405 }))
      .toBe('52.5200° N · 13.4050° E');
    expect(formatCoordinates({ latitude: -33.9, longitude: -70.6 }))
      .toBe('33.9000° S · 70.6000° W');
  });

  it('rejects invalid or non-finite coordinates', () => {
    expect(validCoordinates({ latitude: 91, longitude: 0 })).toBe(false);
    expect(validCoordinates({ latitude: 0, longitude: -181 })).toBe(false);
    expect(validCoordinates({ latitude: NaN, longitude: 9 })).toBe(false);
    expect(() => globePoint({ latitude: 91, longitude: 0 })).toThrow(RangeError);
    expect(() => globePoint({ latitude: 0, longitude: 0 }, -1)).toThrow(RangeError);
  });
});
