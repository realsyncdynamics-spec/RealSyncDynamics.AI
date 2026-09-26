import { Canvas } from '@react-three/fiber';
import * as THREE from 'three';
import { PhotorealEarthMesh } from '../visual/PhotorealEarthMesh';

/**
 * Decorative public-hero Earth. No nodes, no orbits, no drag.
 * Reuses the shared photoreal mesh already used on /welcome.
 */
export default function HeroEarthScene({ reducedMotion = false }: { reducedMotion?: boolean }) {
  return (
    <Canvas
      className="h-full w-full"
      camera={{ position: [0.55, 0.12, 3.55], fov: 36 }}
      gl={{
        alpha: true,
        antialias: true,
        powerPreference: 'high-performance',
        toneMapping: THREE.NoToneMapping,
        outputColorSpace: THREE.SRGBColorSpace,
      }}
      dpr={[1, reducedMotion ? 1.1 : 1.6]}
      style={{ background: 'transparent', pointerEvents: 'none' }}
    >
      <ambientLight intensity={0.55} color="#fff6ea" />
      <directionalLight position={[4.2, 1.4, 2.6]} intensity={2.4} color="#fff8ee" />
      <directionalLight position={[-2.8, -1.1, -1.8]} intensity={0.28} color="#6ec8ff" />
      <PhotorealEarthMesh
        radius={1.55}
        autoRotate={!reducedMotion}
        reducedMotion={reducedMotion}
        rotation={[0.22, -0.72, 0.06]}
        palette="default"
      />
    </Canvas>
  );
}
