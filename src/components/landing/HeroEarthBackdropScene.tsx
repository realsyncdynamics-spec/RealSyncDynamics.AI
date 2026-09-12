/**
 * Passive photoreal Earth scenery for the public landing hero backdrop.
 *
 * Full-bleed night Earth (8K day+night textures) behind Dominik copy.
 * No Sphere HUD, continent UI labels, drag orbit, or fake KPIs.
 * Gentle idle rotation only — canvas is pointer-events-none via CSS/host.
 *
 * Perf: boot on medium textures, upgrade to 8K after idle; demand frameloop.
 */
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef, useState, type MutableRefObject } from 'react';
import * as THREE from 'three';
import { PhotorealEarthMesh } from '../visual/PhotorealEarthMesh';
import { detectEarthQuality, type EarthQuality } from '../visual/earthTextures';

/**
 * Sun sits off the left limb so Europe straddles a readable terminator:
 * day continents + night city lights — not a cream wash, not a black void.
 */
export const LANDING_SUN_POSITION = new THREE.Vector3(-2.85, 0.35, 1.55);

const EARTH_RADIUS = 1.55;

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
      <pointLight color="#ffe0b0" intensity={1.85} distance={32} decay={2} />
      <pointLight
        color="#d0c3a4"
        intensity={0.7}
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
      // ~20fps idle is enough for slow spin; saves main-thread for CTAs.
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

/**
 * Horizon-framed Earth: curvature fills the lower viewport (Sovereign Night),
 * dark void above for cream headline. No geography chrome.
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

  useFrame((_, delta) => {
    if (!reducedMotion) {
      spin.current.rotY += delta * 0.022;
    }
    if (wrap.current) {
      wrap.current.rotation.y = spin.current.rotY;
    }
  });

  return (
    <group ref={wrap} position={[0.05, -2.05, -0.4]} scale={1.72} rotation={[0.12, 0, 0]}>
      <PhotorealEarthMesh
        key={quality}
        radius={EARTH_RADIUS}
        autoRotate={false}
        reducedMotion={reducedMotion}
        sunDirection={sunDir}
        rotation={[0, -0.42, 0]}
        palette="landing-gold"
        quality={quality}
      />
    </group>
  );
}

function CameraLock() {
  const { camera } = useThree();
  const base = useMemo(() => new THREE.Vector3(0, 0.35, 5.2), []);

  useFrame(() => {
    camera.position.copy(base);
    camera.lookAt(0, -0.55, 0);
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
  const spin = useRef<ScenerySpin>({ rotY: -0.42 });

  const maxDpr = reducedMotion || isAutomation() ? 1 : quality === 'high' ? 1.5 : 1.25;

  return (
    <Canvas
      className="h-full w-full"
      camera={{ position: [0, 0.35, 5.2], fov: 36 }}
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
      <ambientLight intensity={0.16} color="#d8c9a8" />
      <directionalLight position={[sun.x, sun.y, sun.z]} intensity={2.05} color="#fff1d6" />
      <directionalLight position={[2.4, 0.6, 1.8]} intensity={0.32} color="#8a9bb0" />
      <directionalLight position={[-1.2, -1.4, 2.0]} intensity={0.28} color="#b49a6b" />
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
