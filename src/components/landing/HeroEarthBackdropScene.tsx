/**
 * Non-interactive photoreal Earth for the public landing hero backdrop.
 * Extremely slow auto-rotate only — no drag, zoom, HUD, or pointer handlers.
 * Graded to Dominik Dark/Gold/Cream (no NASA cyan atmosphere).
 */
import { Canvas, useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { PhotorealEarthMesh } from '../visual/PhotorealEarthMesh';

function SlowEarth({ reducedMotion }: { reducedMotion: boolean }) {
  const wrap = useRef<THREE.Group>(null!);
  // Warm key from upper-right — gold terminator, not cool blue fill.
  const sunDir = useMemo(() => new THREE.Vector3(2.8, 0.55, 2.1).normalize(), []);

  useFrame((_, delta) => {
    if (reducedMotion || !wrap.current) return;
    wrap.current.rotation.y += delta * 0.018;
  });

  return (
    <group ref={wrap} position={[0.55, -0.35, 0]} scale={1.35}>
      <PhotorealEarthMesh
        autoRotate={false}
        reducedMotion={reducedMotion}
        sunDirection={sunDir}
        rotation={[0.12, -0.55, 0.05]}
        palette="landing-gold"
      />
    </group>
  );
}

export interface HeroEarthBackdropSceneProps {
  reducedMotion?: boolean;
}

export function HeroEarthBackdropScene({ reducedMotion = false }: HeroEarthBackdropSceneProps) {
  return (
    <Canvas
      className="h-full w-full"
      camera={{ position: [0, 0.05, 4.6], fov: 38 }}
      gl={{
        alpha: true,
        antialias: true,
        powerPreference: 'high-performance',
        toneMapping: THREE.NoToneMapping,
        outputColorSpace: THREE.SRGBColorSpace,
      }}
      dpr={[1, reducedMotion ? 1 : 1.5]}
      style={{ background: 'transparent', pointerEvents: 'none' }}
      frameloop={reducedMotion ? 'demand' : 'always'}
      onCreated={({ gl }) => {
        gl.domElement.style.pointerEvents = 'none';
        gl.toneMapping = THREE.NoToneMapping;
      }}
    >
      <color attach="background" args={['#00000000']} />
      <ambientLight intensity={0.16} color="#efe6d5" />
      <directionalLight position={[2.8, 0.55, 2.1]} intensity={1.65} color="#fff1d6" />
      {/* Warm amber fill — never cool cyan */}
      <directionalLight position={[-2.4, -0.4, -1.6]} intensity={0.18} color="#b49a6b" />
      <SlowEarth reducedMotion={reducedMotion} />
    </Canvas>
  );
}

export default HeroEarthBackdropScene;
