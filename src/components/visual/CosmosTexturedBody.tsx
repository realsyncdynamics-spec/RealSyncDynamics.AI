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
 * Loads the authentic equirectangular map only on explicit user opt-in.
 * Images are cross-origin and require valid CORS response; on error we keep
 * a clearly documented color fallback, never an "original" claim.
 */
export function CosmosTexturedBody({
  id, radius, fallbackColor, originalsEnabled, isSun = false,
}: SurfaceProps) {
  const [map, setMap] = useState<THREE.Texture | null>(null);
  useEffect(() => {
    setMap(null);
    if (!originalsEnabled) return;

    let active = true;
    let owned: THREE.Texture | null = null;
    const loader = new THREE.TextureLoader();
    loader.setCrossOrigin('anonymous');
    loader.load(
      originalTextureUrl(id),
      (loaded) => {
        if (!active) { loaded.dispose(); return; }
        loaded.colorSpace = THREE.SRGBColorSpace;
        loaded.anisotropy = 2;
        owned = loaded;
        setMap(loaded);
      },
      undefined,
      () => {
        if (active) setMap(null);
      },
    );
    return () => {
      active = false;
      owned?.dispose();
    };
  }, [id, originalsEnabled]);

  return (
    <mesh>
      <sphereGeometry args={[radius, 48, 32]} />
      {isSun
        ? <meshBasicMaterial map={map} color={map ? '#ffffff' : fallbackColor} />
        : <meshStandardMaterial map={map} color={map ? '#ffffff' : fallbackColor}
          roughness={0.94} metalness={0} />}
    </mesh>
  );
}
