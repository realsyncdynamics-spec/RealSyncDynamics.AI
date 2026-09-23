import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Line } from '@react-three/drei';
import { useEffect, useMemo, useRef, type MutableRefObject } from 'react';
import * as THREE from 'three';
import { PhotorealEarthMesh } from '../visual/PhotorealEarthMesh';
import { detectEarthQuality, type EarthQuality } from '../visual/earthTextures';
import { sphereNodePosition } from '../governance-frontend/governance-sphere-nodes';

export const LANDING_SUN_POSITION = new THREE.Vector3(-3.4, 0.55, -1.2);
const EARTH_RADIUS = 1.55;
const TERMINATOR_PERIOD_SEC = 56;
const EUROPE_LIMB_ROTY = -1.58;
/** Landing never pulls the 4K high tier — FCP + VRAM budget. */
const LANDING_MAX_QUALITY: EarthQuality = 'medium';
const VISIBLE_FRAME_MS = 50; // 20 fps terminator

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
];

const EUROPE_ROUTES: readonly [string, string][] = [
  ['london', 'paris'], ['paris', 'berlin'], ['brussels', 'amsterdam'],
  ['berlin', 'warsaw'], ['vienna', 'rome'], ['paris', 'madrid'],
  ['amsterdam', 'stockholm'], ['rome', 'athens'], ['london', 'lisbon'],
  ['brussels', 'berlin'],
];

function isAutomation(): boolean {
  return typeof navigator !== 'undefined' && Boolean(navigator.webdriver);
}

function landingQuality(reducedMotion: boolean): EarthQuality {
  if (reducedMotion || isAutomation()) return 'low';
  const raw = detectEarthQuality({ reducedMotion });
  return raw === 'high' ? LANDING_MAX_QUALITY : raw;
}

function LandingRenderLoop({
  reducedMotion,
  active,
}: {
  reducedMotion: boolean;
  active: boolean;
}) {
  const { invalidate } = useThree();
  useEffect(() => {
    if (reducedMotion || !active) {
      invalidate();
      return;
    }
    let raf = 0;
    let last = 0;
    const tick = (now: number) => {
      if (now - last >= VISIBLE_FRAME_MS) {
        last = now;
        invalidate();
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [invalidate, reducedMotion, active]);
  return null;
}

function buildGreatCirclePoints(a: THREE.Vector3, b: THREE.Vector3, lift: number, segments = 16) {
  const mid = a.clone().add(b).multiplyScalar(0.5).normalize().multiplyScalar(lift);
  const curve = new THREE.QuadraticBezierCurve3(a, mid, b);
  return Array.from({ length: segments + 1 }, (_, i) => curve.getPoint(i / segments));
}

function CyanEuropeNetwork({ radius }: { radius: number }) {
  const hubs = useMemo(() => {
    const map = new Map<string, THREE.Vector3>();
    for (const h of EUROPE_NETWORK_HUBS) {
      const [x, y, z] = sphereNodePosition(h.lat, h.lon, radius * 1.012);
      map.set(h.id, new THREE.Vector3(x, y, z));
    }
    return map;
  }, [radius]);
  const arcs = useMemo(() => {
    const lift = radius * 1.07;
    return EUROPE_ROUTES.flatMap(([from, to], idx) => {
      const a = hubs.get(from);
      const b = hubs.get(to);
      if (!a || !b) return [];
      return [{ key: `${from}-${to}-${idx}`, points: buildGreatCirclePoints(a, b, lift) }];
    });
  }, [hubs, radius]);
  return (
    <group raycast={() => null}>
      {arcs.map(({ key, points }) => (
        <Line key={key} points={points} color="#7fe3f5" lineWidth={0.65} transparent opacity={0.34} depthWrite={false} toneMapped={false} />
      ))}
      {Array.from(hubs.entries()).map(([id, pos]) => (
        <mesh key={id} position={pos.toArray() as [number, number, number]} raycast={() => null}>
          <sphereGeometry args={[0.009, 6, 6]} />
          <meshBasicMaterial color="#e8f7fc" transparent opacity={0.65} depthWrite={false} toneMapped={false} />
        </mesh>
      ))}
    </group>
  );
}

function WalkingSun({
  reducedMotion, sunDir, keyLight, active,
}: {
  reducedMotion: boolean;
  sunDir: THREE.Vector3;
  keyLight: MutableRefObject<THREE.DirectionalLight | null>;
  active: boolean;
}) {
  useFrame(({ clock }) => {
    if (reducedMotion || !active) return;
    const phase = (clock.elapsedTime / TERMINATOR_PERIOD_SEC) * Math.PI * 2;
    const az = -0.72 + Math.sin(phase) * 0.86;
    const el = 0.12 + Math.cos(phase) * 0.28;
    sunDir.set(Math.cos(az) * Math.cos(el), Math.sin(el), Math.sin(az) * Math.cos(el)).normalize();
    if (keyLight.current) {
      keyLight.current.position.copy(sunDir).multiplyScalar(9);
      keyLight.current.intensity = 1.45 + Math.max(0, sunDir.y) * 1.4;
    }
  });
  return null;
}

function SceneryEarth({
  reducedMotion, sunDir, quality,
}: {
  reducedMotion: boolean;
  sunDir: THREE.Vector3;
  quality: EarthQuality;
}) {
  const wrap = useRef<THREE.Group>(null!);
  useFrame(({ clock }) => {
    if (!wrap.current) return;
    const sway = reducedMotion ? 0 : Math.sin(clock.elapsedTime * 0.06) * 0.028;
    wrap.current.rotation.y = EUROPE_LIMB_ROTY + sway;
  });
  return (
    <group ref={wrap} position={[2.22, -0.36, -0.12]} scale={2.18} rotation={[0.18, 0, -0.02]}>
      <PhotorealEarthMesh
        radius={EARTH_RADIUS}
        autoRotate={false}
        reducedMotion={reducedMotion}
        sunDirection={sunDir}
        rotation={[0.28, 0.08, 0.02]}
        palette="default"
        quality={quality}
      />
      <CyanEuropeNetwork radius={EARTH_RADIUS} />
    </group>
  );
}

function CameraLock() {
  const { camera } = useThree();
  useEffect(() => {
    camera.position.set(-0.48, 0.1, 3.35);
    camera.lookAt(1.72, -0.2, 0);
  }, [camera]);
  return null;
}

export interface HeroEarthBackdropSceneProps {
  reducedMotion?: boolean;
  /** Pause the demand loop when the hero is off-screen or the tab is hidden. */
  active?: boolean;
}

export function HeroEarthBackdropScene({
  reducedMotion = false,
  active = true,
}: HeroEarthBackdropSceneProps) {
  const sunDir = useMemo(() => LANDING_SUN_POSITION.clone().normalize(), []);
  const keyLight = useRef<THREE.DirectionalLight | null>(null);
  const quality = useMemo(() => landingQuality(reducedMotion), [reducedMotion]);
  const maxDpr = reducedMotion || isAutomation() || quality === 'low' ? 1 : 1.25;

  return (
    <Canvas
      className="h-full w-full"
      camera={{ position: [-0.48, 0.1, 3.35], fov: 30 }}
      gl={{
        alpha: true,
        antialias: quality !== 'low' && !isAutomation(),
        powerPreference: 'low-power',
        toneMapping: THREE.ACESFilmicToneMapping,
        outputColorSpace: THREE.SRGBColorSpace,
      }}
      dpr={[1, maxDpr]}
      style={{ background: 'transparent', pointerEvents: 'none' }}
      frameloop="demand"
      onCreated={({ gl }) => {
        gl.domElement.style.touchAction = 'auto';
        gl.domElement.style.cursor = 'default';
        gl.domElement.style.pointerEvents = 'none';
        gl.toneMapping = THREE.ACESFilmicToneMapping;
        gl.toneMappingExposure = 1.05;
        gl.setClearColor(0x000000, 0);
      }}
    >
      <LandingRenderLoop reducedMotion={reducedMotion} active={active} />
      <WalkingSun reducedMotion={reducedMotion} sunDir={sunDir} keyLight={keyLight} active={active} />
      <ambientLight intensity={0.12} color="#8aa4b8" />
      <directionalLight ref={keyLight} position={[LANDING_SUN_POSITION.x, LANDING_SUN_POSITION.y, LANDING_SUN_POSITION.z]} intensity={2.35} color="#fff4e2" />
      <CameraLock />
      <SceneryEarth reducedMotion={reducedMotion} sunDir={sunDir} quality={quality} />
    </Canvas>
  );
}

export default HeroEarthBackdropScene;
