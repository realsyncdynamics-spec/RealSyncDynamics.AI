import type { PlanetId } from './cosmosData';

/**
 * COSMOS runs only same-origin texture requests.
 *
 * All 360-degree maps except Earth are committed as source-original JPEG in
 * public/textures/cosmos/. Solar System Scope is CC BY 4.0;
 * the 1024px Moon is from the Three.js texture examples.
 * Provenance and exact blob IDs: COSMOS-ORIGINAL-TEXTURES-README.md.
 */
export type TexturedBodyId = PlanetId | 'sun' | 'moon';

const ORIGINAL_TEXTURE_FILES: Record<TexturedBodyId, string> = {
  sun: '/textures/cosmos/sun.jpg',
  mercury: '/textures/cosmos/mercury.jpg',
  venus: '/textures/cosmos/venus.jpg',
  earth: '/textures/earth-day-2k.webp',
  moon: '/textures/cosmos/moon.jpg',
  mars: '/textures/cosmos/mars.jpg',
  jupiter: '/textures/cosmos/jupiter.jpg',
  saturn: '/textures/cosmos/saturn.jpg',
  uranus: '/textures/cosmos/uranus.jpg',
  neptune: '/textures/cosmos/neptune.jpg',
};

export function originalTextureUrl(body: TexturedBodyId): string {
  if (!Object.prototype.hasOwnProperty.call(ORIGINAL_TEXTURE_FILES, body)) {
    throw new RangeError('Unbekannter Himmelskörper');
  }
  return ORIGINAL_TEXTURE_FILES[body];
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
  moonSource: 'https://github.com/mrdoob/three.js/blob/dev/examples/textures/planets/moon_1024.jpg',
  assetPath: '/textures/cosmos/',
} as const;
