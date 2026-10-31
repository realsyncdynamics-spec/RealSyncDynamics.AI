/**
 * Geographical WGS84 latitude/longitude targets on a textured unit globe.
 * These are locations, not detailed buildings or terrain data.
 */
export const GEO_DESTINATIONS = [
  { id: 'berlin', name: 'Berlin', latitude: 52.52, longitude: 13.405 },
  { id: 'new-york', name: 'New York', latitude: 40.7128, longitude: -74.006 },
  { id: 'tokyo', name: 'Tokio', latitude: 35.6762, longitude: 139.6503 },
  { id: 'matterhorn', name: 'Matterhorn', latitude: 45.9763, longitude: 7.6586 },
  { id: 'everest', name: 'Mount Everest', latitude: 27.9881, longitude: 86.925 },
  { id: 'grand-canyon', name: 'Grand Canyon South Rim', latitude: 36.0589, longitude: -112.1092 },
] as const;

export type Coordinates = { latitude: number; longitude: number };

export function validCoordinates(point: Coordinates): boolean {
  return Number.isFinite(point.latitude) && Number.isFinite(point.longitude)
    && point.latitude >= -90 && point.latitude <= 90
    && point.longitude >= -180 && point.longitude <= 180;
}

/**
 * Three.js sphere UV: lon 0 -> +X, lon +90 -> -Z, north pole -> +Y.
 * matches a conventional equirectangular texture (0° at middle of bitmap).
 */
export function globePoint(point: Coordinates, radius = 1): [number, number, number] {
  if (!validCoordinates(point) || !Number.isFinite(radius) || radius <= 0) {
    throw new RangeError('Invalid geographical coordinates or radius');
  }
  const lat = point.latitude * Math.PI / 180;
  const lon = point.longitude * Math.PI / 180;
  return [
    radius * Math.cos(lat) * Math.cos(lon),
    radius * Math.sin(lat),
    -radius * Math.cos(lat) * Math.sin(lon),
  ];
}
