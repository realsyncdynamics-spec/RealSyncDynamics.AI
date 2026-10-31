import type { PlanetId } from './cosmosData';

/**
 * Source-of-record images: Solar System Scope, CC BY 4.0.
 * Mirrored 2K assets by Sanghel/solar-system-3d, pinned to a known commit.
 *
 * IMPORTANT: These URLs transfer the viewer's IP to jsDelivr.
 * Do not load them until a visitor explicitly opts in. Self-host before GO.
 */
const MIRROR_SHA = '47c8bbc6b63f4c6c2310911238c2c4b6bff6d20b';
const SOURCE_BASE =
  'https://cdn.jsdelivr.net/gh/Sanghel/solar-system-3d@' +
  MIRROR_SHA + '/public/textures/';

export type TexturedBodyId = PlanetId | 'sun' | 'moon';

const ORIGINAL_TEXTURE_FILES: Record<TexturedBodyId, string> = {
  sun: 'sun.jpg',
  mercury: 'mercury.jpg',
  venus: 'venus.jpg',
  earth: 'earth.jpg',
  moon: 'satellites/moon.jpg',
  mars: 'mars.jpg',
  jupiter: 'jupiter.jpg',
  saturn: 'saturn.jpg',
  uranus: 'uranus.jpg',
  neptune: 'neptune.jpg',
};

/** The COSMOS Earth uses its already self-hosted 2K texture by default. */
export function originalTextureUrl(body: TexturedBodyId): string {
  if (!(body in ORIGINAL_TEXTURE_FILES)) {
    throw new RangeError('Unbekannter Himmelskörper');
  }
  return SOURCE_BASE + ORIGINAL_TEXTURE_FILES[body];
}

export function clampPlanetScale(input: number): number {
  if (!Number.isFinite(input)) return 1;
  return Math.max(0.6, Math.min(1.8, Math.round(input * 20) / 20));
}

export function scaledRadius(baseRadius: number, scale: number): number {
  if (!Number.isFinite(baseRadius) || baseRadius <= 0) {
    throw new RangeError('Planet radius must be positive');
  }
  return baseRadius * clampPlanetScale(scale);
}

export const ORIGINAL_TEXTURE_ATTRIBUTION = {
  title: 'Solar System Scope — Solar Textures',
  source: 'https://www.solarsystemscope.com/textures/',
  license: 'https://creativecommons.org/licenses/by/4.0/',
  mirror: 'https://github.com/Sanghel/solar-system-3d/tree/' +
    MIRROR_SHA + '/public/textures',
  processor: 'Originalkarten als 2K-JPEG, keine generierten Planetentexturen',
} as const;
