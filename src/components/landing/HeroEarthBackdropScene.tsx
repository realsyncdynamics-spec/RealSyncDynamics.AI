/**
 * Non-interactive photoreal Earth for the public landing hero backdrop.
 * Cinematic sunrise behind the globe — scenery only.
 * Extremely slow auto-rotate; no drag, zoom, HUD, or pointer handlers.
 * Graded to Dominik Dark/Gold/Cream (no NASA cyan).
 */
import { Canvas, useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { PhotorealEarthMesh } from '../visual/PhotorealEarthMesh';

/** Sunrise sun — lower-left behind Earth; lights globe + headline plane. */
export const LANDING_SUN_POSITION = new THREE.Vector3(-4.6, -1.55, 2.15);

function RisingSun({ reducedMotion }: { reducedMotion: boolean }) {
  const core = useRef<THREE.Mesh>(null!);
  const corona = useRef<THREE.Mesh>(null!);
  const haze = useRef<THREE.Mesh>(null!);
  const flare = useRef<THREE.Mesh>(null!);

  useFrame(({ clock }) => {
    if (reducedMotion) return;
    const t = clock.elapsedTime;
    const pulse = 1 + Math.sin(t * 0.42) * 0.035;
    if (core.current) core.current.scale.setScalar(pulse);
    if (corona.current) corona.current.scale.setScalar(pulse * 1.015);
    if (haze.current) {
      const mat = haze.current.material as THREE.MeshBasicMaterial;
      mat.opacity = 0.16 + Math.sin(t * 0.35) * 0.025;
    }
    if (flare.current) {
      const mat = flare.current.material as THREE.MeshBasicMaterial;
      mat.opacity = 0.11 + Math.sin(t * 0.28) * 0.02;
    }
  });

  return (
    <group position={LANDING_SUN_POSITION.toArray() as [number, number, number]}>
      <pointLight color="#fff1d6" intensity={2.8} distance={36} decay={2} />
      <pointLight color="#ff9a4a" intensity={1.35} distance={20} decay={2} position={[0.35, -0.55, 0.2]} />

      <mesh ref={core} raycast={() => null}>
        <sphereGeometry args={[0.72, 32, 32]} />
        <meshBasicMaterial color="#fff6e0" toneMapped={false} />
      </mesh>
      <mesh ref={corona} scale={1.65} raycast={() => null}>
        <sphereGeometry args={[0.72, 24, 24]} />
        <meshBasicMaterial
          color="#ffc078"
          transparent
          opacity={0.48}
          depthWrite={false}
          toneMapped={false}
        />
      </mesh>
      <mesh ref={haze} scale={3.6} raycast={() => null}>
        <sphereGeometry args={[0.72, 20, 20]} />
        <meshBasicMaterial
          color="#ff8a42"
          transparent
          opacity={0.16}
          depthWrite={false}
          side={THREE.BackSide}
          toneMapped={false}
        />
      </mesh>
      {/* Soft horizon flare — sunrise strip, not a cartoon rayburst */}
      <mesh
        ref={flare}
        rotation={[0, 0.15, 0.42]}
        position={[1.4, -0.45, 1.1]}
        raycast={() => null}
      >
        <planeGeometry args={[6.2, 0.85]} />
        <meshBasicMaterial
          color="#ffb060"
          transparent
          opacity={0.12}
          depthWrite={false}
          side={THREE.DoubleSide}
          toneMapped={false}
        />
      </mesh>
    </group>
  );
}

function SlowEarth({ reducedMotion }: { reducedMotion: boolean }) {
  const wrap = useRef<THREE.Group>(null!);
  const sunDir = useMemo(() => LANDING_SUN_POSITION.clone().normalize(), []);

  useFrame((_, delta) => {
    if (reducedMotion || !wrap.current) return;
    wrap.current.rotation.y += delta * 0.014;
  });

  return (
    <group ref={wrap} position={[0.42, -0.48, 0]} scale={1.82}>
      <PhotorealEarthMesh
        autoRotate={false}
        reducedMotion={reducedMotion}
        sunDirection={sunDir}
        rotation={[0.14, -0.48, 0.04]}
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
      camera={{ position: [0, 0.02, 4.35], fov: 40 }}
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
      <ambientLight intensity={0.1} color="#efe6d5" />
      {/* Key from sunrise — warm gold, drives terminator via sunDirection sync */}
      <directionalLight
        position={[sun.x, sun.y, sun.z]}
        intensity={2.05}
        color="#fff1d6"
      />
      <directionalLight position={[-1.2, -2.4, 0.8]} intensity={0.35} color="#ff9a55" />
      {/* Soft night fill — never cool cyan */}
      <directionalLight position={[2.6, 0.6, -1.8]} intensity={0.12} color="#b49a6b" />
      <RisingSun reducedMotion={reducedMotion} />
      <SlowEarth reducedMotion={reducedMotion} />
    </Canvas>
  );
}

export default HeroEarthBackdropScene;
