import { describe, expect, it } from 'vitest';
import {
  COSMOS_MODULE_CATALOG, defaultCosmosScene, parseCosmosSceneConfig,
} from '../../src/components/visual/cosmosBuilderContract';

describe('COSMOS safe SiteOS module contract (not publishable)', () => {
  it('declares the six future 3D content modules', () => {
    expect(COSMOS_MODULE_CATALOG.map(x => x.id)).toEqual([
      'globe', 'solar-system', 'product-3d', 'city-3d',
      'camera-flight', 'scroll-scene',
    ]);
    for (const item of COSMOS_MODULE_CATALOG) {
      expect(parseCosmosSceneConfig(defaultCosmosScene(item.id)).kind).toBe(item.id);
    }
  });

  it('accepts typed, bounded, same-origin asset options', () => {
    const input = {
      ...defaultCosmosScene('product-3d'),
      latitude: -33.9, longitude: 151.2,
      assetPath: '/cosmos/assets/product-v3.glb',
    };
    expect(parseCosmosSceneConfig(input)).toEqual(input);
  });

  it('rejects remote assets, path traversal, invalid coordinates or arbitrary commands', () => {
    const base = defaultCosmosScene('globe');
    for (const assetPath of [
      'https://example.com/model.glb',
      '//example.com/model.glb',
      '/cosmos/assets/../secrets.json',
      '/cosmos/assets/model.gltf?token=x',
      '/cosmos/assets/model.svg',
      '/cosmos/assets/model.glb#fragment',
    ]) {
      expect(() => parseCosmosSceneConfig({ ...base, assetPath })).toThrow(RangeError);
    }
    expect(() => parseCosmosSceneConfig({ ...base, latitude: 91 })).toThrow(RangeError);
    expect(() => parseCosmosSceneConfig({ ...base, accent: 'url(javascript:alert(1))' }))
      .toThrow(RangeError);
    expect(() => parseCosmosSceneConfig({ ...base, kind: 'billing' })).toThrow(RangeError);
  });

  it('drops extra client-provided properties rather than forwarding them', () => {
    const base = defaultCosmosScene('globe');
    expect(parseCosmosSceneConfig({ ...base, tenantId: 'attacker', secret: 'x' }))
      .toEqual(base);
  });
});
