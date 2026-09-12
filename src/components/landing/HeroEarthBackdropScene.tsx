/**
 * Passive photoreal Earth scenery for the public landing hero backdrop.
 *
 * Europe-night framing (right / background) with gold route network arcs —
 * matches Dominik Grok Imagine mock scenery. Deep space void left for copy.
 * No Sphere HUD, continent UI labels, drag orbit, or fake KPIs.
 * Gentle idle drift only — canvas is pointer-events-none via CSS/host.
 *
 * Perf: boot on medium textures, upgrade to 8K after idle; demand frameloop.
 */
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Line } from '@react-three/drei';
import { useEffect, useMemo, useRef, useState, type MutableRefObject } from 'react';
import * as THREE from 'three';
import { PhotorealEarthMesh } from '../visual/PhotorealEarthMesh';
import { detectEarthQuality, type EarthQuality } from '../visual/earthTextures';
import { sphereNodePosition } from '../governance-frontend/governance-sphere-nodes';

/**
 * Sun sits west of Europe so the continent reads as night city lights —
 * not a cream wash, not a fully black void.
 */
export const LANDING_SUN_POSITION = new THREE.Vector3(-3.4, 0.55, -1.2);

const EARTH_RADIUS = 1.55;

/** EU hubs for gold governance-route arcs (geography only — no KPI HUD). */
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

/** Curated gold routes — arcs across Europe, not a dense fake mesh. */
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

type ScenerySpin = {
  rotY: number;
};

function isAutomation(): boolean {
  return typeof navigator !== 'undefined' && Boolean(navigator.webdriver);
}

/** Soft key only — no visible RisingSun mesh / CSS sun disc. */
function LimbLight() {
  return (
    <group position={LANDING_SUN_POSITION.toArray() as [number, number, number]}>
      <pointLight color="#ffe0b0" intensity={1.15} distance={32} decay={2} />
      <pointLight
        color="#d0c3a4"
        intensity={0.45}
        distance={22}
        decay={2}
        position={[0.5, -0.25, 0.35]}
      />
    </group>
  );
}

function LandingRenderLoop({
  reducedMotion,
}: {
  reducedMotion: boolean;
}) {
  const { invalidate } = useThree();
  useEffect(() => {
    if (reducedMotion) {
      invalidate();
      return;
    }
    let raf = 0;
    let last = 0;
    const tick = (now: number) => {
      // ~20fps idle is enough for slow drift; saves main-thread for CTAs.
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

/**
 * Gold route/network overlay — thin luminous arcs + nodes over Europe.
 * Scenery only: no labels, no KPI chips, no pointer capture.
 */
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

/**
 * Europe fills the right / background — left void for Dominik copy + stars.
 * Night-dominant city lights; gold network rides the mesh.
 */
function SceneryEarth({
  spin,
  reducedMotion,
  sunDir,
  quality,
}: {
  spin: MutableRefObject<ScenerySpin>;
  reducedMotion: boolean;
  sunDir: THREE.Vector3;
  quality: EarthQuality;
}) {
  const wrap = useRef<THREE.Group>(null!);

  useFrame(({ clock }) => {
    // Locked Europe framing — gentle sway only; never free-spin to the Americas.
    const base = -0.48;
    const sway = reducedMotion ? 0 : Math.sin(clock.elapsedTime * 0.12) * 0.045;
    spin.current.rotY = base + sway;
    if (wrap.current) {
      wrap.current.rotation.y = spin.current.rotY;
    }
  });

  return (
    <group
      ref={wrap}
      position={[1.55, -0.15, -0.55]}
      scale={1.48}
      rotation={[0.08, 0, -0.06]}
    >
      <PhotorealEarthMesh
        key={quality}
        radius={EARTH_RADIUS}
        autoRotate={false}
        reducedMotion={reducedMotion}
        sunDirection={sunDir}
        rotation={[0.12, -0.08, 0.05]}
        palette="landing-gold"
        quality={quality}
      />
      <GoldEuropeNetwork radius={EARTH_RADIUS} reducedMotion={reducedMotion} />
    </group>
  );
}

function CameraLock() {
  const { camera } = useThree();
  const base = useMemo(() => new THREE.Vector3(-0.35, 0.28, 4.6), []);

  useFrame(() => {
    camera.position.copy(base);
    // Look slightly right so Europe dominates the right half; left stays void.
    camera.lookAt(1.05, -0.05, 0);
  });

  return null;
}

function useProgressiveEarthQuality(reducedMotion: boolean): EarthQuality {
  const [quality, setQuality] = useState<EarthQuality>(() => {
    if (reducedMotion) return 'low';
    // Boot medium (4K) — never decode 8K on first paint / CI webdriver.
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
  const sun = LANDING_SUN_POSITION;
  const sunDir = useMemo(() => LANDING_SUN_POSITION.clone().normalize(), []);
  const quality = useProgressiveEarthQuality(reducedMotion);
  // Europe toward camera (+Z-ish after wrap Y); start framed on the continent.
  const spin = useRef<ScenerySpin>({ rotY: -0.48 });

  const maxDpr = reducedMotion || isAutomation() ? 1 : quality === 'high' ? 1.5 : 1.25;

  return (
    <Canvas
      className="h-full w-full"
      camera={{ position: [-0.35, 0.28, 4.6], fov: 38 }}
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
      {/* Dim ambient — night Europe + city lights must dominate */}
      <ambientLight intensity={0.08} color="#d8c9a8" />
      <directionalLight position={[sun.x, sun.y, sun.z]} intensity={1.15} color="#fff1d6" />
      <directionalLight position={[2.8, 0.4, 1.2]} intensity={0.22} color="#8a9bb0" />
      <directionalLight position={[-0.8, -1.2, 2.2]} intensity={0.35} color="#b49a6b" />
      <LimbLight />
      <CameraLock />
      <SceneryEarth
        spin={spin}
        reducedMotion={reducedMotion}
        sunDir={sunDir}
        quality={quality}
      />
    </Canvas>
  );
}

export default HeroEarthBackdropScene;
