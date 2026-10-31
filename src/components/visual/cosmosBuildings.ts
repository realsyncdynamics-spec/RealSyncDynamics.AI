/**
 * COSMOS local building layer. WGS84 GeoJSON input, never executed as code
 * and never automatically treated as an authenticated OSM dataset.
 * Buildings are rendered on a flat datum until a matched DEM is available.
 */
export type GeoCoordinates = { latitude: number; longitude: number };
export type BuildingFootprint = {
  id: string;
  name: string;
  rings: Array<Array<[number, number]>>;
  heightMetres: number;
  heightEstimated: boolean;
};
export type BuildingsModel = {
  origin: GeoCoordinates;
  buildings: BuildingFootprint[];
  estimatedHeights: number;
  maxExtentMetres: number;
};

const METRES_PER_DEGREE = 111_319.49079327358;
const MAX_FEATURES = 150;
const MAX_POINTS = 12_000;
const MAX_RANGE_METRES = 1_600;

type Json = Record<string, unknown>;
const isObject = (value: unknown): value is Json =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

function numberFromProperty(input: unknown): number | null {
  if (typeof input === 'number') return Number.isFinite(input) ? input : null;
  if (typeof input !== 'string') return null;
  const trimmed = input.trim();
  if (!/^\d+(?:\.\d+)?\s*(?:m|metres?|meters?)?$/i.test(trimmed)) return null;
  const n = Number.parseFloat(trimmed);
  return Number.isFinite(n) ? n : null;
}

export function localMetres(
  longitude: number, latitude: number, origin: GeoCoordinates,
): [number, number] {
  const east = (longitude - origin.longitude) *
    METRES_PER_DEGREE * Math.cos(origin.latitude * Math.PI / 180);
  const north = (latitude - origin.latitude) * METRES_PER_DEGREE;
  return [east, north];
}

function coordinate(value: unknown): [number, number] {
  if (!Array.isArray(value) || value.length < 2 ||
      typeof value[0] !== 'number' || typeof value[1] !== 'number' ||
      !Number.isFinite(value[0]) || !Number.isFinite(value[1]) ||
      value[0] < -180 || value[0] > 180 || value[1] < -90 || value[1] > 90) {
    throw new RangeError('Ungültige GeoJSON-Koordinaten');
  }
  return [value[0], value[1]];
}

function polygonRings(raw: unknown): Array<Array<[number, number]>> {
  if (!Array.isArray(raw) || raw.length < 1 || raw.length > 8) {
    throw new RangeError('GeoJSON-Polygon hat keine gültigen Ringe');
  }
  return raw.map((ring) => {
    if (!Array.isArray(ring) || ring.length < 4 || ring.length > 512) {
      throw new RangeError('Polygonring muss 4 bis 512 Punkte besitzen');
    }
    const points = ring.map(coordinate);
    const first = points[0];
    const last = points[points.length - 1];
    if (Math.abs(first[0] - last[0]) > 1e-7 ||
        Math.abs(first[1] - last[1]) > 1e-7) {
      throw new RangeError('GeoJSON-Polygonring ist nicht geschlossen');
    }
    return points;
  });
}

function heightFromProperties(properties: Json): {
  heightMetres: number; heightEstimated: boolean;
} {
  const exactHeight = numberFromProperty(properties.height);
  if (exactHeight !== null && exactHeight >= 2 && exactHeight <= 300) {
    return { heightMetres: exactHeight, heightEstimated: false };
  }
  const levels = numberFromProperty(properties['building:levels']);
  if (levels !== null && levels >= 1 && levels <= 100) {
    return { heightMetres: Math.min(300, levels * 3), heightEstimated: true };
  }
  return { heightMetres: 9, heightEstimated: true };
}

/** Parse a bounded FeatureCollection of Polygon/MultiPolygon building geometries.
 * Any foreign properties are ignored. Imported data is unverified until
 * independently checked against its attributed source.
 */
export function parseBuildingGeoJson(value: unknown): BuildingsModel {
  if (!isObject(value) || value.type !== 'FeatureCollection' ||
      !Array.isArray(value.features) || value.features.length > MAX_FEATURES) {
    throw new RangeError('Erwartet: GeoJSON FeatureCollection mit maximal 150 Objekten');
  }
  const buildings: BuildingFootprint[] = [];
  let pointCount = 0;
  for (const [featureIndex, rawFeature] of value.features.entries()) {
    if (!isObject(rawFeature) || rawFeature.type !== 'Feature' ||
        !isObject(rawFeature.geometry)) continue;
    const geometry = rawFeature.geometry;
    const properties = isObject(rawFeature.properties) ? rawFeature.properties : {};
    // Ignore unrelated points, roads and parks.
    if (geometry.type !== 'Polygon' && geometry.type !== 'MultiPolygon') continue;
    const polygons: unknown[] = geometry.type === 'Polygon'
      ? [geometry.coordinates]
      : Array.isArray(geometry.coordinates) ? geometry.coordinates : [];
    for (const [polygonIndex, rawPolygon] of polygons.entries()) {
      const rings = polygonRings(rawPolygon);
      pointCount += rings.reduce((n, ring) => n + ring.length, 0);
      if (pointCount > MAX_POINTS || buildings.length >= MAX_FEATURES) {
        throw new RangeError('Zu viele Gebäude oder Polygonpunkte');
      }
      const { heightMetres, heightEstimated } = heightFromProperties(properties);
      const rawName = typeof properties.name === 'string' ?
        properties.name.replace(/[<>]/g, '').slice(0, 72) : '';
      buildings.push({
        id: featureIndex + ':' + polygonIndex,
        name: rawName || 'Gebäude ' + (buildings.length + 1),
        rings, heightMetres, heightEstimated,
      });
    }
  }
  if (buildings.length === 0) {
    throw new RangeError('Keine Polygon- oder MultiPolygon-Gebäude enthalten');
  }
  const firstRing = buildings[0].rings[0];
  const uniquePoints = firstRing.slice(0, -1);
  const origin: GeoCoordinates = {
    longitude: uniquePoints.reduce((sum, p) => sum + p[0], 0) / uniquePoints.length,
    latitude: uniquePoints.reduce((sum, p) => sum + p[1], 0) / uniquePoints.length,
  };
  let maxExtentMetres = 0;
  for (const building of buildings) {
    for (const ring of building.rings) {
      for (const [lon, lat] of ring) {
        const [x, y] = localMetres(lon, lat, origin);
        const extent = Math.hypot(x, y);
        if (!Number.isFinite(extent) || extent > MAX_RANGE_METRES) {
          throw new RangeError('Gebäudegrundrisse liegen über 1,6 km auseinander');
        }
        maxExtentMetres = Math.max(extent, maxExtentMetres);
      }
    }
  }
  return {
    origin,
    buildings,
    estimatedHeights: buildings.filter((b) => b.heightEstimated).length,
    maxExtentMetres,
  };
}
