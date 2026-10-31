import { useEffect, useState } from 'react';
import * as THREE from 'three';
import {
  originalTextureUrl,
  type TexturedBodyId,
} from './cosmosOriginalTextures';

type SurfaceProps = {
  id: TexturedBodyId;
  radius: number;
  fallbackColor: string;
  originalsEnabled: boolean;
  isSun?: boolean;
};

/**
 * Loads an authentic, locally hosted equirectangular planet map.
 * Rendering can be disabled on low-end devices. Texture resources are
 * disposed on toggle/unmount; on load failure the sphere remains visible
 * with its schematic fallback color.
 */
export function CosmosTexturedBody({
  id, radius, fallbackColor, originalsEnabled, isSun = false,
}: SurfaceProps) {
  const [map, setMap] = useState<THREE.Texture | null>(null);
  useEffect(() => {
    setMap(null);
    if (!originalsEnabled) return;

    let active = true;
    const owned: { texture: THREE.Texture | null } = { texture: null };
    const loader = new THREE.TextureLoader();
    loader.load(
      originalTextureUrl(id),
      (loaded) => {
        if (!active) { loaded.dispose(); return; }
        loaded.colorSpace = THREE.SRGBColorSpace;
        loaded.needsUpdate = true;
        loaded.anisotropy = 2;
        owned.texture = loaded;
        setMap(loaded);
      },
      undefined,
      () => {
        if (active) setMap(null);
      },
    );
    return () => {
      active = false;
      owned.texture?.dispose();
    };
  }, [id, originalsEnabled]);

  return (
    <mesh>
      <sphereGeometry args={[radius, 48, 32]} />
      {isSun
        ? <meshBasicMaterial key={map ? 'original' : 'fallback'}
            map={map} color={map ? '#ffffff' : fallbackColor} />
        : <meshStandardMaterial key={map ? 'original' : 'fallback'}
            map={map} color={map ? '#ffffff' : fallbackColor}
            roughness={0.94} metalness={0} />}
    </mesh>
  );
}
