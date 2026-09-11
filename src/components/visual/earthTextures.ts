/**
 * Adaptive Earth texture tiers for PhotorealEarthMesh.
 *
 * Day/cloud maps: Solar System Scope (CC BY 4.0), NASA Blue Marble–based.
 * Night / specular / bump: three-globe + three.js example lineage (NASA-derived).
 * See `public/textures/README.md`.
 */

export type EarthQuality = 'low' | 'medium' | 'high';

export interface EarthTextureSet {
  day: string;
  night: string | null;
  clouds: string | null;
  specular: string | null;
  /** Sphere segment counts [width, height]. */
  segments: [number, number];
  /** Anisotropy cap for day map. */
  anisotropy: number;
  /** Include atmosphere fresnel + cloud shell. */
  atmosphere: boolean;
  cloudsEnabled: boolean;
  nightEnabled: boolean;
  specularEnabled: boolean;
}

/** Boot / reduced-motion / weak mobile — day only, fast FCP. */
export const EARTH_DAY_BOOT = '/textures/earth-day.jpg';

const TEXTURE_SETS: Record<EarthQuality, EarthTextureSet> = {
  low: {
    day: '/textures/earth-day.jpg',
    night: null,
    clouds: null,
    specular: null,
    segments: [48, 48],
    anisotropy: 4,
    atmosphere: true,
    cloudsEnabled: false,
    nightEnabled: false,
    specularEnabled: false,
  },
  medium: {
    day: '/textures/earth-day-4k.jpg',
    night: '/textures/earth-night.jpg',
    clouds: '/textures/earth-clouds.jpg',
    specular: '/textures/earth-specular.jpg',
    segments: [72, 72],
    anisotropy: 8,
    atmosphere: true,
    cloudsEnabled: true,
    nightEnabled: true,
    specularEnabled: true,
  },
  high: {
    day: '/textures/earth-day-8k.jpg',
    night: '/textures/earth-night-4k.jpg',
    clouds: '/textures/earth-clouds-4k.jpg',
    specular: '/textures/earth-specular.jpg',
    segments: [96, 96],
    anisotropy: 16,
    atmosphere: true,
    cloudsEnabled: true,
    nightEnabled: true,
    specularEnabled: true,
  },
};

/**
 * Pick a quality tier from device hints.
 * Prefers full fidelity on desktop; lightens maps/effects on weak mobile.
 */
export function detectEarthQuality(opts?: {
  reducedMotion?: boolean;
  force?: EarthQuality;
}): EarthQuality {
  if (opts?.force) return opts.force;
  if (typeof window === 'undefined') return 'medium';
  if (opts?.reducedMotion) return 'low';

  const nav = navigator as Navigator & {
    deviceMemory?: number;
    connection?: { saveData?: boolean; effectiveType?: string };
  };
  const saveData = Boolean(nav.connection?.saveData);
  const slowNet =
    nav.connection?.effectiveType === '2g' || nav.connection?.effectiveType === 'slow-2g';
  const lowMem = typeof nav.deviceMemory === 'number' && nav.deviceMemory > 0 && nav.deviceMemory <= 4;
  const coarse = window.matchMedia?.('(pointer: coarse)')?.matches ?? false;
  const narrow = window.matchMedia?.('(max-width: 768px)')?.matches ?? false;
  const mobileUA = /Android|iPhone|iPad|iPod|Mobile/i.test(nav.userAgent ?? '');

  if (saveData || slowNet) return 'low';
  if ((coarse || narrow || mobileUA) && lowMem) return 'low';
  if (coarse || narrow || mobileUA) return 'medium';

  // Desktop: high when we have headroom; otherwise medium (4K is already sharp).
  if (lowMem) return 'medium';
  return 'high';
}

export function getEarthTextureSet(quality: EarthQuality): EarthTextureSet {
  return TEXTURE_SETS[quality];
}

/** Preload a URL without blocking React render (upgrade path). */
export function preloadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.decoding = 'async';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Failed to load ${url}`));
    img.src = url;
  });
}
