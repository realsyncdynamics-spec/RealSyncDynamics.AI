/**
 * Passive photoreal Earth scenery for the public landing hero backdrop.
 *
 * Europe stays in frame (locked yaw). Day/night terminator walks because
 * the sun direction sweeps — not because the globe free-spins to the Americas.
 */
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Line } from '@react-three/drei';
import { useEffect, useMemo, useRef, useState, type MutableRefObject } from 'react';
import * as THREE from 'three';
import { PhotorealEarthMesh } from '../visual/PhotorealEarthMesh';
import { detectEarthQuality, type EarthQuality } from '../visual/earthTextures';
import { sphereNodePosition } from '../governance-frontend/governance-sphere-nodes';
import { SphereGeography } from '../governance-frontend/SphereGeography';

export const LANDING_SUN_POSITION = new THREE.Vector3(-3.4, 0.55, -1.2);

const EARTH_RADIUS = 1.55;
/** Full sun sweep period in seconds — slow enough to read as daylight crawl. */
const TERMINATOR_PERIOD_SEC = 96;

const EUROPE_NETWORK_HUBS: readonly { id: string; lat: number; lon: number }[] = [
  { id: 'berlin', lat: 52.52, lon: 13.41 },
  { id: 'paris', lat: 48.86, lon: 2.35 },
  { id: 'london', lat: 51.51, lon: -0.13 },
  { id: 'brussels', lat: 50.85, lon: 4.35 },
  { id: 'rome', lat: 41.9, lon: 12.5 },
  { id: 'madrid', lat: 40.42, lon: -3.7 },
  { id: 'amsterdam', lat: 52.37, lon: 4.89 },
  { id: 'vienna', lat: 48.21, lon: 16.37 },
  { id: 'warsaw', lat: 52.23, lon: 21.01 },
  { id: 'stockholm', lat: 59.33, lon: 18.07 },
  { id: 'lisbon', lat: 38.72, lon: -9.14 },
  { id: 'athens', lat: 37.98, lon: 23.73 },
  { id: 'dublin', lat: 53.35, lon: -6.26 },
  { id: 'copenhagen', lat: 55.68, lon: 12.57 },
  { id: 'prague', lat: 50.08, lon: 14.44 },
];

const EUROPE_ROUTES: readonly [string, string][] = [
  ['london', 'paris'],
  ['paris', 'berlin'],
  ['brussels', 'amsterdam'],
  ['berlin', 'warsaw'],
  ['berlin', 'vienna'],
  ['vienna', 'rome'],
  ['paris', 'madrid'],
  ['madrid', 'lisbon'],
  ['amsterdam', 'copenhagen'],
  ['copenhagen', 'stockholm'],
  ['berlin', 'prague'],
  ['rome', 'athens'],
  ['london', 'dublin'],
  ['paris', 'rome'],
  ['brussels', 'berlin'],
  ['warsaw', 'stockholm'],
  ['lisbon', 'london'],
  ['athens', 'vienna'],
];

function isAutomation(): boolean {
  return typeof navigator !== 'undefined' && Boolean(navigator.webdriver);
}

function LandingRenderLoop({ reducedMotion }: { reducedMotion: boolean }) {
  const { invalidate } = useThree();
  useEffect(() => {
    if (reducedMotion) {
      invalidate();
      return;
    }
    let raf = 0;
    let last = 0;
    const tick = (now: number) => {
      if (now - last >= 50) {
        last = now;
        invalidate();
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [invalidate, reducedMotion]);
  return null;
}

function buildGreatCirclePoints(
  a: THREE.Vector3,
  b: THREE.Vector3,
  lift: number,
  segments = 40,
): THREE.Vector3[] {
  const mid = a.clone().add(b).multiplyScalar(0.5).normalize().multiplyScalar(lift);
  const curve = new THREE.QuadraticBezierCurve3(a, mid, b);
  const points: THREE.Vector3[] = [];
  for (let i = 0; i <= segments; i++) {
    points.push(curve.getPoint(i / segments));
  }
  return points;
}

function GoldEuropeNetwork({ radius, reducedMotion }: { radius: number; reducedMotion: boolean }) {
  const group = useRef<THREE.Group>(null!);
  const hubs = useMemo(() => {
    const map = new Map<string, THREE.Vector3>();
    for (const h of EUROPE_NETWORK_HUBS) {
      const [x, y, z] = sphereNodePosition(h.lat, h.lon, radius * 1.018);
      map.set(h.id, new THREE.Vector3(x, y, z));
    }
    return map;
  }, [radius]);

  const arcs = useMemo(() => {
    const lift = radius * 1.12;
    return EUROPE_ROUTES.flatMap(([from, to], idx) => {
      const a = hubs.get(from);
      const b = hubs.get(to);
      if (!a || !b) return [];
      return [{ key: `${from}-${to}-${idx}`, points: buildGreatCirclePoints(a, b, lift) }];
    });
  }, [hubs, radius]);

  useFrame(({ clock }) => {
    if (!group.current || reducedMotion) return;
    const t = clock.elapsedTime;
    group.current.children.forEach((child, i) => {
      const mat = (child as THREE.Object3D & { material?: THREE.Material }).material;
      if (mat && 'opacity' in mat) {
        (mat as THREE.Material & { opacity: number }).opacity =
          0.5 + Math.sin(t * 0.7 + i * 0.15) * 0.12;
      }
    });
  });

  return (
    <group ref={group} raycast={() => null}>
      {arcs.map(({ key, points }) => (
        <Line
          key={key}
          points={points}
          color="#e4cfa2"
          lineWidth={1.15}
          transparent
          opacity={0.62}
          depthWrite={false}
          toneMapped={false}
        />
      ))}
      {Array.from(hubs.entries()).map(([id, pos]) => (
        <mesh key={id} position={pos.toArray() as [number, number, number]} raycast={() => null}>
          <sphereGeometry args={[0.018, 10, 10]} />
          <meshBasicMaterial
            color="#f2e6c8"
            transparent
            opacity={0.9}
            depthWrite={false}
            toneMapped={false}
          />
        </mesh>
      ))}
    </group>
  );
}

const EUROPE_LIMB_ROTY = -1.58;

/** Sun azimuth sweep only — globe yaw stays on Europe. */
function WalkingSun({
  reducedMotion,
  sunDir,
  keyLight,
}: {
  reducedMotion: boolean;
  sunDir: THREE.Vector3;
  keyLight: MutableRefObject<THREE.DirectionalLight | null>;
}) {
  useFrame(({ clock }) => {
    if (reducedMotion) return;
    const phase = (clock.elapsedTime / TERMINATOR_PERIOD_SEC) * Math.PI * 2;
    const az = -0.55 + Math.sin(phase) * 0.62;
    const el = 0.18 + Math.cos(phase) * 0.14;
    sunDir.set(Math.cos(az) * Math.cos(el), Math.sin(el), Math.sin(az) * Math.cos(el)).normalize();
    if (keyLight.current) {
      keyLight.current.position.copy(sunDir).multiplyScalar(8);
    }
  });
  return null;
}

function SceneryEarth({
  reducedMotion,
  sunDir,
  quality,
}: {
  reducedMotion: boolean;
  sunDir: THREE.Vector3;
  quality: EarthQuality;
}) {
  const wrap = useRef<THREE.Group>(null!);
  const geoZoom = useRef({ zoom: 1.18 });

  useFrame(({ clock }) => {
    if (!wrap.current) return;
    // Micro-sway only. Never leave the Europe yaw band.
    const sway = reducedMotion ? 0 : Math.sin(clock.elapsedTime * 0.12) * 0.055;
    wrap.current.rotation.y = EUROPE_LIMB_ROTY + sway;
  });

  return (
    <group ref={wrap} position={[1.95, -0.45, -0.2]} scale={1.68} rotation={[0.22, 0, -0.02]}>
      <PhotorealEarthMesh
        key={quality}
        radius={EARTH_RADIUS}
        autoRotate={false}
        reducedMotion={reducedMotion}
        sunDirection={sunDir}
        rotation={[0.28, 0.08, 0.02]}
        palette="landing-gold"
        quality={quality}
      />
      <SphereGeography
        zoomRef={geoZoom}
        earthRadius={EARTH_RADIUS}
        reducedMotion={reducedMotion}
        layers={['borders']}
      />
      <GoldEuropeNetwork radius={EARTH_RADIUS} reducedMotion={reducedMotion} />
    </group>
  );
}

function CameraLock() {
  const { camera } = useThree();
  const base = useMemo(() => new THREE.Vector3(-0.7, 0.15, 4.2), []);
  useFrame(() => {
    camera.position.copy(base);
    camera.lookAt(1.5, -0.28, 0);
  });
  return null;
}

function useProgressiveEarthQuality(reducedMotion: boolean): EarthQuality {
  const [quality, setQuality] = useState<EarthQuality>(() => {
    if (reducedMotion) return 'low';
    return 'medium';
  });

  useEffect(() => {
    if (reducedMotion || isAutomation()) return;
    const target = detectEarthQuality({ reducedMotion });
    if (target !== 'high') {
      setQuality(target);
      return;
    }
    const delay = window.setTimeout(() => setQuality('high'), 2800);
    return () => window.clearTimeout(delay);
  }, [reducedMotion]);

  return quality;
}

export interface HeroEarthBackdropSceneProps {
  reducedMotion?: boolean;
}

export function HeroEarthBackdropScene({ reducedMotion = false }: HeroEarthBackdropSceneProps) {
  const sunDir = useMemo(() => LANDING_SUN_POSITION.clone().normalize(), []);
  const keyLight = useRef<THREE.DirectionalLight | null>(null);
  const quality = useProgressiveEarthQuality(reducedMotion);
  const maxDpr = reducedMotion || isAutomation() ? 1 : quality === 'high' ? 1.5 : 1.25;

  return (
    <Canvas
      className="h-full w-full"
      camera={{ position: [-0.7, 0.15, 4.2], fov: 36 }}
      gl={{
        alpha: true,
        antialias: !isAutomation(),
        powerPreference: isAutomation() ? 'low-power' : 'high-performance',
        toneMapping: THREE.NoToneMapping,
        outputColorSpace: THREE.SRGBColorSpace,
      }}
      dpr={[1, maxDpr]}
      style={{ background: 'transparent', pointerEvents: 'none' }}
      frameloop="demand"
      onCreated={({ gl }) => {
        gl.domElement.style.touchAction = 'auto';
        gl.domElement.style.cursor = 'default';
        gl.domElement.style.pointerEvents = 'none';
        gl.toneMapping = THREE.NoToneMapping;
        gl.setClearColor(0x000000, 0);
      }}
    >
      <LandingRenderLoop reducedMotion={reducedMotion} />
      <WalkingSun reducedMotion={reducedMotion} sunDir={sunDir} keyLight={keyLight} />
      <ambientLight intensity={0.28} color="#efe4cc" />
      <directionalLight
        ref={keyLight}
        position={[LANDING_SUN_POSITION.x, LANDING_SUN_POSITION.y, LANDING_SUN_POSITION.z]}
        intensity={1.95}
        color="#fff6e0"
      />
      <directionalLight position={[2.8, 0.4, 1.2]} intensity={0.32} color="#9aacc0" />
      <CameraLock />
      <SceneryEarth reducedMotion={reducedMotion} sunDir={sunDir} quality={quality} />
    </Canvas>
  );
}

export default HeroEarthBackdropScene;
