/**
 * Non-interactive photoreal Earth for the public landing hero backdrop.
 * Night-forward Europe framing + slow auto-rotate. Scenery only —
 * no sun disc, no HUD, no drag.
 */
import { Canvas, useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { PhotorealEarthMesh } from '../visual/PhotorealEarthMesh';

/**
 * Sun sits off the left limb so Europe straddles a readable terminator:
 * day continents + night city lights — not a cream wash, not a black void.
 */
export const LANDING_SUN_POSITION = new THREE.Vector3(-2.85, 0.35, 1.55);

/** Soft key only — no visible RisingSun mesh / CSS sun disc. */
function LimbLight() {
  return (
    <group position={LANDING_SUN_POSITION.toArray() as [number, number, number]}>
      <pointLight color="#ffe0b0" intensity={1.85} distance={32} decay={2} />
      <pointLight color="#e4cfa2" intensity={0.7} distance={22} decay={2} position={[0.5, -0.25, 0.35]} />
    </group>
  );
}

function SlowEarth({ reducedMotion }: { reducedMotion: boolean }) {
  const wrap = useRef<THREE.Group>(null!);
  const sunDir = useMemo(() => LANDING_SUN_POSITION.clone().normalize(), []);

  useFrame((_, delta) => {
    if (reducedMotion || !wrap.current) return;
    wrap.current.rotation.y += delta * 0.028;
  });

  return (
    <group ref={wrap} position={[0.08, -0.28, 0.2]} scale={2.38}>
      <PhotorealEarthMesh
        autoRotate={false}
        reducedMotion={reducedMotion}
        sunDirection={sunDir}
        rotation={[0.18, -0.28, 0.04]}
        palette="landing-gold"
        // Force night lights + specular on the public hero (desktop + mobile).
        quality="medium"
      />
    </group>
  );
}

export interface HeroEarthBackdropSceneProps {
  reducedMotion?: boolean;
}

export function HeroEarthBackdropScene({ reducedMotion = false }: HeroEarthBackdropSceneProps) {
  const sun = LANDING_SUN_POSITION;

  return (
    <Canvas
      className="h-full w-full"
      camera={{ position: [0, 0.05, 3.75], fov: 40 }}
      gl={{
        alpha: true,
        antialias: true,
        powerPreference: 'high-performance',
        toneMapping: THREE.NoToneMapping,
        outputColorSpace: THREE.SRGBColorSpace,
      }}
      dpr={[1, reducedMotion ? 1 : 1.35]}
      style={{ background: 'transparent', pointerEvents: 'none' }}
      frameloop={reducedMotion ? 'demand' : 'always'}
      onCreated={({ gl }) => {
        gl.domElement.style.pointerEvents = 'none';
        gl.toneMapping = THREE.NoToneMapping;
        gl.setClearColor(0x000000, 0);
      }}
    >
      <ambientLight intensity={0.16} color="#d8c9a8" />
      <directionalLight position={[sun.x, sun.y, sun.z]} intensity={2.05} color="#fff1d6" />
      <directionalLight position={[2.4, 0.6, 1.8]} intensity={0.32} color="#8a9bb0" />
      <directionalLight position={[-1.2, -1.4, 2.0]} intensity={0.28} color="#b49a6b" />
      <LimbLight />
      <SlowEarth reducedMotion={reducedMotion} />
    </Canvas>
  );
}

export default HeroEarthBackdropScene;
