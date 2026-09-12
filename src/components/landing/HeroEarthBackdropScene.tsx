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
      <pointLight color="#ffe0b0" intensity={1.55} distance={30} decay={2} />
      <pointLight color="#e4cfa2" intensity={0.55} distance={20} decay={2} position={[0.5, -0.25, 0.35]} />
    </group>
  );
}

function SlowEarth({ reducedMotion }: { reducedMotion: boolean }) {
  const wrap = useRef<THREE.Group>(null!);
  const sunDir = useMemo(() => LANDING_SUN_POSITION.clone().normalize(), []);

  useFrame((_, delta) => {
    if (reducedMotion || !wrap.current) return;
    // Slow cinematic spin — continents and city lights must stay readable.
    wrap.current.rotation.y += delta * 0.028;
  });

  return (
    /*
     * Oversized + shifted so the sphere crops past viewport edges —
     * Earth fills the hero; no empty black bands on desktop.
     * Initial yaw tips Europe / Atlantic toward camera across the terminator.
     */
    <group ref={wrap} position={[0.08, -0.28, 0.2]} scale={2.38}>
      <PhotorealEarthMesh
        autoRotate={false}
        reducedMotion={reducedMotion}
        sunDirection={sunDir}
        rotation={[0.18, -0.28, 0.04]}
        palette="landing-gold"
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
      dpr={[1, reducedMotion ? 1 : 1.5]}
      style={{ background: 'transparent', pointerEvents: 'none' }}
      frameloop={reducedMotion ? 'demand' : 'always'}
      onCreated={({ gl }) => {
        gl.domElement.style.pointerEvents = 'none';
        gl.toneMapping = THREE.NoToneMapping;
        gl.setClearColor(0x000000, 0);
      }}
    >
      {/* Balanced ambient so day land + night lights both read */}
      <ambientLight intensity={0.2} color="#d8c9a8" />
      <directionalLight position={[sun.x, sun.y, sun.z]} intensity={1.85} color="#fff1d6" />
      <directionalLight position={[2.4, 0.6, 1.8]} intensity={0.28} color="#8a9bb0" />
      <directionalLight position={[-1.2, -1.4, 2.0]} intensity={0.22} color="#b49a6b" />
      <LimbLight />
      <SlowEarth reducedMotion={reducedMotion} />
    </Canvas>
  );
}

export default HeroEarthBackdropScene;
