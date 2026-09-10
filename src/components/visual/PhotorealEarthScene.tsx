import { Canvas, useFrame, useLoader } from '@react-three/fiber';
import { useEffect, useRef } from 'react';
import * as THREE from 'three';

/**
 * Photoreal Earth — R3F scene for `/welcome` right panel.
 * Day texture: public domain / three.js examples earth_atmos map
 * (shipped locally as `/textures/earth-day.jpg`).
 */

const EARTH_TEXTURE = '/textures/earth-day.jpg';

function Earth({ reducedMotion }: { reducedMotion: boolean }) {
  const group = useRef<THREE.Group>(null!);
  const texture = useLoader(THREE.TextureLoader, EARTH_TEXTURE);

  useEffect(() => {
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = 8;
    texture.needsUpdate = true;
  }, [texture]);

  useFrame((_, delta) => {
    if (reducedMotion || !group.current) return;
    group.current.rotation.y += delta * 0.045;
  });

  return (
    <group ref={group} rotation={[0.18, -0.55, 0.08]}>
      {/* Photoreal day sphere */}
      <mesh>
        <sphereGeometry args={[1.55, 64, 64]} />
        <meshStandardMaterial
          map={texture}
          roughness={0.72}
          metalness={0.08}
        />
      </mesh>

      {/* Thin atmosphere rim */}
      <mesh scale={1.035}>
        <sphereGeometry args={[1.55, 48, 48]} />
        <meshBasicMaterial
          color="#4fc3f7"
          transparent
          opacity={0.12}
          side={THREE.BackSide}
          depthWrite={false}
        />
      </mesh>

      {/* Soft outer glow shell */}
      <mesh scale={1.09}>
        <sphereGeometry args={[1.55, 32, 32]} />
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

function SceneLights() {
  return (
    <>
      <ambientLight intensity={0.28} />
      {/* Sun-side key light */}
      <directionalLight
        position={[4.5, 1.2, 2.8]}
        intensity={2.1}
        color="#fff6e8"
      />
      {/* Cool fill from space */}
      <directionalLight
        position={[-3.5, -1.5, -2]}
        intensity={0.35}
        color="#6ec8ff"
      />
    </>
  );
}

export interface PhotorealEarthSceneProps {
  reducedMotion?: boolean;
}

export function PhotorealEarthScene({ reducedMotion = false }: PhotorealEarthSceneProps) {
  return (
    <Canvas
      className="h-full w-full"
      camera={{ position: [0, 0.15, 4.15], fov: 42 }}
      gl={{ alpha: true, antialias: true, powerPreference: 'high-performance' }}
      dpr={[1, 1.75]}
      style={{ background: 'transparent' }}
    >
      <SceneLights />
      <Earth reducedMotion={reducedMotion} />
    </Canvas>
  );
}

export default PhotorealEarthScene;
