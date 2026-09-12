/**
 * Non-interactive photoreal Earth for the public landing hero backdrop.
 * Cinematic sunrise — scenery only. Desktop framing: lit day side + sun
 * fill the viewport (no dark night-blob / empty black bands).
 */
import { Canvas, useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { PhotorealEarthMesh } from '../visual/PhotorealEarthMesh';

/**
 * Sunrise sun — left limb, slightly in front of the horizon so the disc
 * peeks past the Earth and the day side faces the camera.
 */
export const LANDING_SUN_POSITION = new THREE.Vector3(-2.55, -0.35, 3.6);

function RisingSun({ reducedMotion }: { reducedMotion: boolean }) {
  const core = useRef<THREE.Mesh>(null!);
  const corona = useRef<THREE.Mesh>(null!);
  const haze = useRef<THREE.Mesh>(null!);
  const flare = useRef<THREE.Mesh>(null!);

  useFrame(({ clock }) => {
    if (reducedMotion) return;
    const t = clock.elapsedTime;
    const pulse = 1 + Math.sin(t * 0.38) * 0.03;
    if (core.current) core.current.scale.setScalar(pulse);
    if (corona.current) corona.current.scale.setScalar(pulse * 1.012);
    if (haze.current) {
      const mat = haze.current.material as THREE.MeshBasicMaterial;
      mat.opacity = 0.2 + Math.sin(t * 0.32) * 0.03;
    }
    if (flare.current) {
      const mat = flare.current.material as THREE.MeshBasicMaterial;
      mat.opacity = 0.14 + Math.sin(t * 0.26) * 0.025;
    }
  });

  return (
    <group position={LANDING_SUN_POSITION.toArray() as [number, number, number]}>
      <pointLight color="#fff1d6" intensity={3.4} distance={42} decay={2} />
      <pointLight color="#ff9a4a" intensity={1.8} distance={24} decay={2} position={[0.4, -0.4, 0.15]} />

      <mesh ref={core} raycast={() => null}>
        <sphereGeometry args={[1.15, 32, 32]} />
        <meshBasicMaterial color="#fffaf0" toneMapped={false} />
      </mesh>
      <mesh ref={corona} scale={1.9} raycast={() => null}>
        <sphereGeometry args={[1.15, 24, 24]} />
        <meshBasicMaterial
          color="#ffc078"
          transparent
          opacity={0.72}
          depthWrite={false}
          toneMapped={false}
        />
      </mesh>
      <mesh ref={haze} scale={4.8} raycast={() => null}>
        <sphereGeometry args={[1.15, 20, 20]} />
        <meshBasicMaterial
          color="#ff8a42"
          transparent
          opacity={0.28}
          depthWrite={false}
          side={THREE.BackSide}
          toneMapped={false}
        />
      </mesh>
      <mesh
        ref={flare}
        rotation={[0, 0.12, 0.38]}
        position={[1.8, -0.2, 1.2]}
        raycast={() => null}
      >
        <planeGeometry args={[9, 1.4]} />
        <meshBasicMaterial
          color="#ffb060"
          transparent
          opacity={0.22}
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
  // Direction from Earth toward the sun (world space) for terminator.
  const sunDir = useMemo(() => LANDING_SUN_POSITION.clone().normalize(), []);

  useFrame((_, delta) => {
    // Near-freeze — keep the lit Europe/Atlantic frame Dominik needs.
    if (reducedMotion || !wrap.current) return;
    wrap.current.rotation.y += delta * 0.004;
  });

  return (
    /*
     * Frame: Europe / Atlantic toward camera, sun on the left limb.
     * Oversized + shifted so the sphere crops past viewport edges —
     * no empty black bands on desktop.
     */
    <group ref={wrap} position={[0.15, -0.55, 0.2]} scale={2.35}>
      <PhotorealEarthMesh
        autoRotate={false}
        reducedMotion={reducedMotion}
        sunDirection={sunDir}
        // Tip Europe/NW Africa into the lit sunrise quadrant (not Americas night).
        rotation={[0.22, 0.72, 0.06]}
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
      camera={{ position: [0, 0.08, 3.85], fov: 42 }}
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
      <ambientLight intensity={0.22} color="#efe6d5" />
      <directionalLight position={[sun.x, sun.y, sun.z]} intensity={2.85} color="#fff1d6" />
      <directionalLight position={[-1.6, -1.8, 1.2]} intensity={0.75} color="#ff9a55" />
      <directionalLight position={[2.2, 0.8, -1.4]} intensity={0.14} color="#b49a6b" />
      <RisingSun reducedMotion={reducedMotion} />
      <SlowEarth reducedMotion={reducedMotion} />
    </Canvas>
  );
}

export default HeroEarthBackdropScene;
