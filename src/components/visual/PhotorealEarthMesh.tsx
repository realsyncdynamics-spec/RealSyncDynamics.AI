import { useFrame, useLoader } from '@react-three/fiber';
import { useEffect, useRef } from 'react';
import * as THREE from 'three';

/**
 * Shared photoreal Earth mesh — day texture + atmosphere rim.
 * Used by `/welcome` (PhotorealEarthScene) and the homepage Governance Sphere.
 */

export const EARTH_DAY_TEXTURE = '/textures/earth-day.jpg';

export interface PhotorealEarthMeshProps {
  /** Sphere radius in scene units. */
  radius?: number;
  /** Auto-rotate when true (welcome panel). Governance Sphere drives rotation externally. */
  autoRotate?: boolean;
  reducedMotion?: boolean;
  /** Initial orientation — tip Europe / Atlantic toward camera by default. */
  rotation?: [number, number, number];
}

/**
 * Photoreal day-side Earth with thin atmosphere shells.
 * Parent scenes own lights and interaction.
 */
export function PhotorealEarthMesh({
  radius = 1.55,
  autoRotate = false,
  reducedMotion = false,
  rotation = [0.18, -0.55, 0.08],
}: PhotorealEarthMeshProps) {
  const group = useRef<THREE.Group>(null!);
  const texture = useLoader(THREE.TextureLoader, EARTH_DAY_TEXTURE);

  useEffect(() => {
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = 8;
    texture.needsUpdate = true;
  }, [texture]);

  useFrame((_, delta) => {
    if (!autoRotate || reducedMotion || !group.current) return;
    group.current.rotation.y += delta * 0.045;
  });

  return (
    <group ref={group} rotation={rotation} raycast={() => null}>
      <mesh raycast={() => null}>
        <sphereGeometry args={[radius, 64, 64]} />
        <meshStandardMaterial map={texture} roughness={0.72} metalness={0.08} />
      </mesh>

      {/* Thin atmosphere rim */}
      <mesh scale={1.035} raycast={() => null}>
        <sphereGeometry args={[radius, 48, 48]} />
        <meshBasicMaterial
          color="#4fc3f7"
          transparent
          opacity={0.12}
          side={THREE.BackSide}
          depthWrite={false}
        />
      </mesh>

      {/* Soft outer glow shell */}
      <mesh scale={1.09} raycast={() => null}>
        <sphereGeometry args={[radius, 32, 32]} />
        <meshBasicMaterial
          color="#1a6cff"
          transparent
          opacity={0.06}
          side={THREE.BackSide}
          depthWrite={false}
        />
      </mesh>
    </group>
  );
}
