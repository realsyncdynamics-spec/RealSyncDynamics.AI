import { Stars } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { useMemo, useRef, type MutableRefObject } from 'react';
import * as THREE from 'three';

/**
 * Distant solar-system backdrop for Governance Sphere.
 * Sun rises warm on the limb; Mars → Pluto sit far away and stay subtle.
 */

const SUN_POS = new THREE.Vector3(-6.8, -1.15, 2.4);

export const SPHERE_SUN_POSITION = SUN_POS;

type DistantBody = {
  id: string;
  /** Relative world position (far from Earth). */
  position: [number, number, number];
  radius: number;
  color: string;
  emissive: string;
  emissiveIntensity: number;
  /** Optional Saturn-style ring. */
  ring?: { inner: number; outer: number; color: string; opacity: number };
};

const DISTANT_PLANETS: readonly DistantBody[] = [
  {
    id: 'mars',
    position: [-11.5, 3.8, -16],
    radius: 0.22,
    color: '#c45a3a',
    emissive: '#8a3018',
    emissiveIntensity: 0.35,
  },
  {
    id: 'jupiter',
    position: [16.5, 5.2, -28],
    radius: 0.55,
    color: '#d4b896',
    emissive: '#a07848',
    emissiveIntensity: 0.28,
  },
  {
    id: 'saturn',
    position: [-18, -4.5, -36],
    radius: 0.42,
    color: '#e0cba0',
    emissive: '#b89860',
    emissiveIntensity: 0.25,
    ring: { inner: 0.55, outer: 0.95, color: '#d8c49a', opacity: 0.45 },
  },
  {
    id: 'uranus',
    position: [9.5, 8.5, -48],
    radius: 0.28,
    color: '#8fd4d8',
    emissive: '#3a8890',
    emissiveIntensity: 0.3,
  },
  {
    id: 'neptune',
    position: [-8.5, 6.8, -58],
    radius: 0.27,
    color: '#3a6ec8',
    emissive: '#1a3a8a',
    emissiveIntensity: 0.35,
  },
  {
    id: 'pluto',
    position: [12.5, -7.2, -64],
    radius: 0.09,
    color: '#c8b8a8',
    emissive: '#6a5a4a',
    emissiveIntensity: 0.2,
  },
];

function RisingSun({ reducedMotion }: { reducedMotion: boolean }) {
  const core = useRef<THREE.Mesh>(null!);
  const corona = useRef<THREE.Mesh>(null!);
  const haze = useRef<THREE.Mesh>(null!);

  useFrame(({ clock }) => {
    if (reducedMotion) return;
    const t = clock.elapsedTime;
    const pulse = 1 + Math.sin(t * 0.55) * 0.04;
    if (core.current) core.current.scale.setScalar(pulse);
    if (corona.current) corona.current.scale.setScalar(pulse * 1.02);
    if (haze.current) {
      const mat = haze.current.material as THREE.MeshBasicMaterial;
      mat.opacity = 0.14 + Math.sin(t * 0.4) * 0.03;
    }
  });

  return (
    <group position={SUN_POS.toArray() as [number, number, number]}>
      {/* Warm sunrise key — also drives PhotorealEarthMesh terminator via sunDir sync */}
      <pointLight color="#ffd6a0" intensity={2.4} distance={40} decay={2} />
      <pointLight color="#ff8a4a" intensity={1.1} distance={18} decay={2} position={[0.4, -0.6, 0]} />

      <mesh ref={core} raycast={() => null}>
        <sphereGeometry args={[0.55, 32, 32]} />
        <meshBasicMaterial color="#fff2d0" toneMapped={false} />
      </mesh>
      <mesh ref={corona} scale={1.55} raycast={() => null}>
        <sphereGeometry args={[0.55, 24, 24]} />
        <meshBasicMaterial
          color="#ffb060"
          transparent
          opacity={0.45}
          depthWrite={false}
          toneMapped={false}
        />
      </mesh>
      <mesh ref={haze} scale={3.2} raycast={() => null}>
        <sphereGeometry args={[0.55, 20, 20]} />
        <meshBasicMaterial
          color="#ff7a3a"
          transparent
          opacity={0.14}
          depthWrite={false}
          side={THREE.BackSide}
          toneMapped={false}
        />
      </mesh>
      {/* Horizon flare strip — reads as sunrise without HUD clutter */}
      <mesh rotation={[0, 0, 0.35]} position={[1.2, -0.35, 0.8]} raycast={() => null}>
        <planeGeometry args={[4.5, 0.65]} />
        <meshBasicMaterial
          color="#ff9a55"
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

function DistantPlanet({ body, reducedMotion }: { body: DistantBody; reducedMotion: boolean }) {
  const group = useRef<THREE.Group>(null!);

  useFrame((_, delta) => {
    if (reducedMotion || !group.current) return;
    group.current.rotation.y += delta * 0.08;
  });

  return (
    <group ref={group} position={body.position}>
      <mesh raycast={() => null}>
        <sphereGeometry args={[body.radius, 16, 16]} />
        <meshStandardMaterial
          color={body.color}
          emissive={body.emissive}
          emissiveIntensity={body.emissiveIntensity}
          roughness={0.75}
          metalness={0.1}
          toneMapped={false}
        />
      </mesh>
      {body.ring && (
        <mesh rotation={[Math.PI / 2.6, 0.2, 0.15]} raycast={() => null}>
          <ringGeometry args={[body.ring.inner, body.ring.outer, 48]} />
          <meshBasicMaterial
            color={body.ring.color}
            transparent
            opacity={body.ring.opacity}
            side={THREE.DoubleSide}
            depthWrite={false}
            toneMapped={false}
          />
        </mesh>
      )}
    </group>
  );
}

function ParallaxStarfield({
  controls,
  reducedMotion,
}: {
  controls: MutableRefObject<{ pointerInfluence: { x: number; y: number } }>;
  reducedMotion: boolean;
}) {
  const near = useRef<THREE.Points>(null!);
  const far = useRef<THREE.Group>(null!);

  const nearPositions = useMemo(() => {
    const arr = new Float32Array(280 * 3);
    for (let i = 0; i < 280; i++) {
      const r = 22 + Math.random() * 40;
      const phi = Math.acos(2 * Math.random() - 1);
      const theta = Math.random() * Math.PI * 2;
      arr[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      arr[i * 3 + 1] = r * Math.cos(phi);
      arr[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta) - 8;
    }
    return arr;
  }, []);

  const nearGeo = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(nearPositions, 3));
    return geo;
  }, [nearPositions]);

  useFrame((_, delta) => {
    if (!far.current) return;
    const p = controls.current.pointerInfluence;
    const px = reducedMotion ? 0 : p.x * 0.45;
    const py = reducedMotion ? 0 : p.y * 0.28;
    far.current.position.x = THREE.MathUtils.damp(far.current.position.x, px, 2.5, delta);
    far.current.position.y = THREE.MathUtils.damp(far.current.position.y, py, 2.5, delta);
    if (!reducedMotion && near.current) {
      near.current.rotation.y += delta * 0.008;
    }
  });

  return (
    <group ref={far}>
      <Stars
        radius={90}
        depth={42}
        count={reducedMotion ? 400 : 900}
        factor={2.4}
        saturation={0}
        fade
        speed={reducedMotion ? 0 : 0.25}
      />
      <points ref={near} geometry={nearGeo} raycast={() => null}>
        <pointsMaterial
          color="#d8e8ff"
          size={0.045}
          sizeAttenuation
          transparent
          opacity={0.55}
          depthWrite={false}
          toneMapped={false}
        />
      </points>
    </group>
  );
}

export interface SphereSpaceBackgroundProps {
  controls: MutableRefObject<{ pointerInfluence: { x: number; y: number } }>;
  reducedMotion?: boolean;
  /** When false (mobile low tier), skip distant planets for fill-rate. */
  showPlanets?: boolean;
}

export function SphereSpaceBackground({
  controls,
  reducedMotion = false,
  showPlanets = true,
}: SphereSpaceBackgroundProps) {
  return (
    <group>
      <ParallaxStarfield controls={controls} reducedMotion={reducedMotion} />
      <RisingSun reducedMotion={reducedMotion} />
      {showPlanets &&
        DISTANT_PLANETS.map((body) => (
          <DistantPlanet key={body.id} body={body} reducedMotion={reducedMotion} />
        ))}
    </group>
  );
}

export { DISTANT_PLANETS };
