/**
 * Non-interactive photoreal Earth for the public landing hero backdrop.
 * Extremely slow auto-rotate only — no drag, zoom, HUD, or pointer handlers.
 */
import { Canvas, useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { PhotorealEarthMesh } from '../visual/PhotorealEarthMesh';

function SlowEarth({ reducedMotion }: { reducedMotion: boolean }) {
  const wrap = useRef<THREE.Group>(null!);
  const sunDir = useMemo(() => new THREE.Vector3(3.2, 0.85, 2.4).normalize(), []);

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
      <ambientLight intensity={0.22} />
      <directionalLight position={[3.2, 0.85, 2.4]} intensity={1.85} color="#fff4e6" />
      <directionalLight position={[-2.8, -0.6, -1.8]} intensity={0.28} color="#6a9cc8" />
      <SlowEarth reducedMotion={reducedMotion} />
    </Canvas>
  );
}

export default HeroEarthBackdropScene;
