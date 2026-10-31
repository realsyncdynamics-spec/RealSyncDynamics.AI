import { describe, expect, it } from 'vitest';
import { localMetres, parseBuildingGeoJson } from '../../src/components/visual/cosmosBuildings';

const footprint = (props: Record<string, unknown> = {}) => ({
  type: 'Feature', properties: props,
  geometry: { type: 'Polygon', coordinates: [[
    [13.404, 52.52],
    [13.4041, 52.52],
    [13.4041, 52.5201],
    [13.404, 52.5201],
    [13.404, 52.52],
  ]] },
});
const collection = (...features: unknown[]) => ({
  type: 'FeatureCollection', features,
});

describe('COSMOS bounded GeoJSON building model', () => {
  it('parses geographic Polygon features with measured heights', () => {
    const model = parseBuildingGeoJson(collection(footprint({ height: '18 m', name: 'Haus A' })));
    expect(model.buildings).toHaveLength(1);
    expect(model.buildings[0].name).toBe('Haus A');
    expect(model.buildings[0].heightMetres).toBe(18);
    expect(model.buildings[0].heightEstimated).toBe(false);
    expect(model.origin.latitude).toBeCloseTo(52.52005, 5);
    expect(model.maxExtentMetres).toBeGreaterThan(0);
  });

  it('explicitly estimates missing heights and levels', () => {
    const levels = parseBuildingGeoJson(collection(footprint({ 'building:levels': 4 })));
    expect(levels.buildings[0].heightMetres).toBe(12);
    expect(levels.estimatedHeights).toBe(1);
    const unknown = parseBuildingGeoJson(collection(footprint()));
    expect(unknown.buildings[0].heightMetres).toBe(9);
    expect(unknown.buildings[0].heightEstimated).toBe(true);
  });

  it('accepts MultiPolygon and ignores non-polygon features', () => {
    const multi = footprint({ height: 8 });
    multi.geometry.type = 'MultiPolygon';
    multi.geometry.coordinates = [footprint().geometry.coordinates] as unknown as typeof multi.geometry.coordinates;
    const model = parseBuildingGeoJson(collection(
      { type: 'Feature', geometry: { type: 'Point', coordinates: [13, 52] } }, multi,
    ));
    expect(model.buildings).toHaveLength(1);
    expect(model.estimatedHeights).toBe(0);
  });

  it('projects east/north coordinates in metres, local to WGS84 origin', () => {
    const origin = { latitude: 52.52, longitude: 13.405 };
    const [east, north] = localMetres(13.406, 52.521, origin);
    expect(east).toBeGreaterThan(60);
    expect(east).toBeLessThan(70);
    expect(north).toBeGreaterThan(110);
    expect(north).toBeLessThan(113);
  });

  it('rejects remote geography and invalid/open polygons', () => {
    const remote = footprint();
    remote.geometry.coordinates[0][2] = [15, 52.5201];
    expect(() => parseBuildingGeoJson(collection(remote))).toThrow(RangeError);
    const open = footprint();
    open.geometry.coordinates[0].pop();
    expect(() => parseBuildingGeoJson(collection(open))).toThrow(RangeError);
    expect(() => parseBuildingGeoJson(collection(footprint(), ...Array(151).fill(footprint()))))
      .toThrow(RangeError);
    expect(() => parseBuildingGeoJson(collection())).toThrow(RangeError);
    expect(() => parseBuildingGeoJson([])).toThrow(RangeError);
  });
});
