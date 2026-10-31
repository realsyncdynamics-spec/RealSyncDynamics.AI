/**
 * SiteOS/COSMOS DESIGN CONTRACT ONLY.
 *
 * Not a registered SiteOS BlockKind and NOT publishable. The existing Puck
 * editor uses packages/siteos-core renderBlockHtml for preview/publish parity.
 * Production integration needs a dedicated server-schema/render/security PR.
 */
export const COSMOS_MODULE_CATALOG = [
  { id: 'globe', title: '3D-Weltkugel', requiresGeoData: false },
  { id: 'solar-system', title: 'Sonnensystem', requiresGeoData: false },
  { id: 'product-3d', title: '3D-Produktviewer', requiresGeoData: true },
  { id: 'city-3d', title: '3D-Stadtkarte', requiresGeoData: true },
  { id: 'camera-flight', title: 'Kameraflug', requiresGeoData: true },
  { id: 'scroll-scene', title: 'Scrollgesteuerte 3D-Szene', requiresGeoData: true },
] as const;

export type CosmosModuleId = (typeof COSMOS_MODULE_CATALOG)[number]['id'];
export type CosmosQuality = 'eco' | 'standard' | 'high';

export type CosmosSceneConfig = {
  kind: CosmosModuleId;
  quality: CosmosQuality;
  accent: string;
  autoplay: boolean;
  longitude: number;
  latitude: number;
  /** A same-origin asset path, never a third-party URL. */
  assetPath?: string;
};

const validQuality = new Set<string>(['eco', 'standard', 'high']);
const validModules = new Set<string>(COSMOS_MODULE_CATALOG.map(m => m.id));

/**
 * Fail closed on imported builder data; no arbitrary URLs or callbacks.
 * This validator does not grant tenant entitlements or publish permission.
 */
export function parseCosmosSceneConfig(value: unknown): CosmosSceneConfig {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new RangeError('COSMOS-Konfiguration muss ein Objekt sein');
  }
  const x = value as Record<string, unknown>;
  if (typeof x.kind !== 'string' || !validModules.has(x.kind) ||
      typeof x.quality !== 'string' || !validQuality.has(x.quality) ||
      typeof x.accent !== 'string' || !/^#[a-fA-F0-9]{6}$/.test(x.accent) ||
      typeof x.autoplay !== 'boolean' ||
      typeof x.longitude !== 'number' || !Number.isFinite(x.longitude) ||
      x.longitude < -180 || x.longitude > 180 ||
      typeof x.latitude !== 'number' || !Number.isFinite(x.latitude) ||
      x.latitude < -90 || x.latitude > 90) {
    throw new RangeError('Ungültige COSMOS-Szenenparameter');
  }
  if (x.assetPath !== undefined &&
      (typeof x.assetPath !== 'string' ||
       !/^\/cosmos\/assets\/[a-zA-Z0-9_/-]+\.(?:glb|gltf|webp|png|jpg|json)$/.test(x.assetPath) ||
       x.assetPath.includes('..') || x.assetPath.length > 255)) {
    throw new RangeError('Nur freigegebene lokale COSMOS-Assets sind zulässig');
  }
  return {
    kind: x.kind as CosmosModuleId,
    quality: x.quality as CosmosQuality,
    accent: x.accent,
    autoplay: x.autoplay,
    longitude: x.longitude,
    latitude: x.latitude,
    ...(x.assetPath === undefined ? {} : { assetPath: x.assetPath as string }),
  };
}

export function defaultCosmosScene(kind: CosmosModuleId): CosmosSceneConfig {
  if (!validModules.has(kind)) throw new RangeError('Unbekanntes COSMOS-Modul');
  return {
    kind,
    quality: 'standard',
    accent: '#65CFFF',
    autoplay: false,
    longitude: 13.405,
    latitude: 52.52,
  };
}
