import { describe, expect, it } from 'vitest';
import {
  MATTERHORN_DEM, sampleTerrariumGrid, terrariumElevation, tileCenterWgs84,
} from '../../src/components/visual/cosmosDem';

describe('COSMOS local, source-validated DEM pipeline', () => {
  it('decodes signed Terrarium elevations in metres', () => {
    expect(terrariumElevation(128, 0, 0)).toBe(0);
    expect(terrariumElevation(128, 1, 128)).toBe(1.5);
    expect(terrariumElevation(127, 255, 0)).toBe(-1);
    expect(() => terrariumElevation(128, 1, 256)).toThrow(RangeError);
  });

  it('samples a valid 3x3 RGBA image into a 2x2 heightfield', () => {
    const width = 3, height = 3;
    const data = new Uint8ClampedArray(width * height * 4);
    for (let i = 0; i < width * height; i++) {
      data[i * 4] = 128;
      data[i * 4 + 1] = i * 10;
      data[i * 4 + 3] = 255;
    }
    const field = sampleTerrariumGrid({ width, height, data }, 2);
    expect(Array.from(field.metres)).toEqual([0, 20, 60, 80]);
    expect(field.min).toBe(0);
    expect(field.max).toBe(80);
  });

  it('fails closed on inconsistent raster sizes and missing pixels', () => {
    expect(() => sampleTerrariumGrid({
      width: 2, height: 2, data: new Uint8ClampedArray(12),
    })).toThrow(RangeError);
    expect(() => sampleTerrariumGrid({
      width: 2, height: 2, data: new Uint8ClampedArray(16),
    })).toThrow(RangeError);
    expect(() => sampleTerrariumGrid({
      width: 2, height: 2, data: new Uint8ClampedArray(16),
    }, 0)).toThrow(RangeError);
  });

  it('places the selected Mapterhorn tile in the Alps', () => {
    const center = tileCenterWgs84(
      MATTERHORN_DEM.zoom, MATTERHORN_DEM.x, MATTERHORN_DEM.y,
    );
    expect(center.latitude).toBeGreaterThan(45.9);
    expect(center.latitude).toBeLessThan(46.1);
    expect(center.longitude).toBeGreaterThan(7.5);
    expect(center.longitude).toBeLessThan(7.9);
    expect(() => tileCenterWgs84(13, -1, 2915)).toThrow(RangeError);
    expect(() => tileCenterWgs84(25, 4270, 2915)).toThrow(RangeError);
  });
});
