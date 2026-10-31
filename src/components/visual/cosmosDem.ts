/**
 * RealSync COSMOS — same-origin Terrarium DEM contract.
 * Data source: Mapterhorn, see https://mapterhorn.com/data-access/.
 * This module never fabricates terrain values. No image is bundled until
 * its actual download, provenance and redistribution rights are verified.
 */
export const MATTERHORN_DEM = {
  id: 'matterhorn-local-dem',
  label: 'Matterhorn (Höhenkachel)',
  zoom: 13,
  x: 4270,
  y: 2915,
  url: '/cosmos/dem/matterhorn-z13-x4270-y2915.webp',
  attribution: '© Mapterhorn / swisstopo (Quellen pro Dataset prüfen)',
  providerUrl: 'https://mapterhorn.com/attribution/',
} as const;

export type HeightField = {
  size: number;
  metres: Float32Array;
  min: number;
  max: number;
};

export function terrariumElevation(r: number, g: number, b: number): number {
  for (const v of [r, g, b]) {
    if (!Number.isInteger(v) || v < 0 || v > 255) {
      throw new RangeError('Terrarium channels must be bytes');
    }
  }
  return r * 256 + g + b / 256 - 32768;
}

/** Converts the pixels of a verified same-origin DEM tile to a sampled grid. */
export function sampleTerrariumGrid(
  image: { width: number; height: number; data: Uint8ClampedArray },
  size = 97,
): HeightField {
  if (!Number.isInteger(size) || size < 2 || size > 513) {
    throw new RangeError('Terrain grid resolution out of bounds');
  }
  const { width, height, data } = image;
  if (!Number.isInteger(width) || !Number.isInteger(height) ||
      width < 2 || height < 2 || width > 4096 || height > 4096 ||
      data.length !== width * height * 4) {
    throw new RangeError('Invalid DEM image dimensions');
  }
  const metres = new Float32Array(size * size);
  let min = Number.POSITIVE_INFINITY;
  let max = Number.NEGATIVE_INFINITY;
  for (let row = 0; row < size; row++) {
    for (let col = 0; col < size; col++) {
      const x = Math.round(col / (size - 1) * (width - 1));
      const y = Math.round(row / (size - 1) * (height - 1));
      const offset = (y * width + x) * 4;
      if (data[offset + 3] < 250) {
        throw new RangeError('DEM tile contains transparent/nodata pixels');
      }
      const value = terrariumElevation(data[offset], data[offset + 1], data[offset + 2]);
      if (!Number.isFinite(value) || value < -12000 || value > 10000) {
        throw new RangeError('DEM tile contains implausible heights');
      }
      metres[row * size + col] = value;
      min = Math.min(min, value);
      max = Math.max(max, value);
    }
  }
  return { size, metres, min, max };
}

/** Accurate slippy-map tile center for metadata and reproducibility. */
export function tileCenterWgs84(zoom: number, x: number, y: number): {
  latitude: number; longitude: number;
} {
  if (!Number.isInteger(zoom) || zoom < 0 || zoom > 22) {
    throw new RangeError('Invalid tile zoom');
  }
  const n = 2 ** zoom;
  if (!Number.isInteger(x) || !Number.isInteger(y) ||
      x < 0 || x >= n || y < 0 || y >= n) {
    throw new RangeError('Invalid tile coordinates');
  }
  const longitude = ((x + 0.5) / n) * 360 - 180;
  const mercator = Math.PI * (1 - 2 * (y + 0.5) / n);
  const latitude = Math.atan(Math.sinh(mercator)) * 180 / Math.PI;
  return { latitude, longitude };
}
