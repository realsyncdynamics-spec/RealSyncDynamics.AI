/**
 * Interactive photoreal Earth for the public landing hero.
 *
 * Orbit/drag + modest wheel zoom + country borders (SphereGeography).
 * No Governance Sphere HUD, nodes, Coming-Soon chrome, or fake KPIs.
 * Desktop prefers 8K day; mobile stays on 4K via detectEarthQuality.
 */
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef, type MutableRefObject } from 'react';
import * as THREE from 'three';
import { SphereGeography } from '../governance-frontend/SphereGeography';
import { PhotorealEarthMesh } from '../visual/PhotorealEarthMesh';
import { detectEarthQuality } from '../visual/earthTextures';

/**
 * Sun sits off the left limb so Europe straddles a readable terminator:
 * day continents + night city lights — not a cream wash, not a black void.
 */
export const LANDING_SUN_POSITION = new THREE.Vector3(-2.85, 0.35, 1.55);

const EARTH_RADIUS = 1.55;

type LandingEarthControls = {
  rotX: number;
  rotY: number;
  velX: number;
  velY: number;
  zoom: number;
  targetZoom: number;
  pointer: { x: number; y: number };
  dragging: boolean;
  hovering: boolean;
};

/** Soft key only — no visible RisingSun mesh / CSS sun disc. */
function LimbLight() {
  return (
    <group position={LANDING_SUN_POSITION.toArray() as [number, number, number]}>
      <pointLight color="#ffe0b0" intensity={1.85} distance={32} decay={2} />
      <pointLight color="#d0c3a4" intensity={0.7} distance={22} decay={2} position={[0.5, -0.25, 0.35]} />
    </group>
  );
}

function DragOrbitSurface({
  controls,
  hoverBoostRef,
}: {
  controls: MutableRefObject<LandingEarthControls>;
  hoverBoostRef: MutableRefObject<boolean>;
}) {
  const last = useRef({ x: 0, y: 0, t: 0 });
  const sample = useRef({ vx: 0, vy: 0 });

  return (
    <mesh
      onPointerDown={(e) => {
        e.stopPropagation();
        const canvas = document.querySelector('[data-landing-earth] canvas');
        if (canvas instanceof HTMLCanvasElement) {
          try {
            canvas.setPointerCapture(e.pointerId);
          } catch {
            /* ignore */
          }
        }
        controls.current.dragging = true;
        controls.current.velX = 0;
        controls.current.velY = 0;
        last.current = { x: e.clientX, y: e.clientY, t: performance.now() };
        sample.current = { vx: 0, vy: 0 };
        document.body.style.cursor = 'grabbing';
      }}
      onPointerUp={(e) => {
        controls.current.dragging = false;
        controls.current.velY = THREE.MathUtils.clamp(sample.current.vx, -0.06, 0.06);
        controls.current.velX = THREE.MathUtils.clamp(sample.current.vy, -0.045, 0.045);
        const canvas = document.querySelector('[data-landing-earth] canvas');
        if (canvas instanceof HTMLCanvasElement) {
          try {
            canvas.releasePointerCapture(e.pointerId);
          } catch {
            /* ignore */
          }
        }
        document.body.style.cursor = 'grab';
      }}
      onPointerOver={() => {
        controls.current.hovering = true;
        hoverBoostRef.current = true;
        if (!controls.current.dragging) document.body.style.cursor = 'grab';
      }}
      onPointerOut={() => {
        controls.current.hovering = false;
        hoverBoostRef.current = false;
        if (controls.current.dragging) {
          controls.current.velY = THREE.MathUtils.clamp(sample.current.vx, -0.06, 0.06);
          controls.current.velX = THREE.MathUtils.clamp(sample.current.vy, -0.045, 0.045);
        }
        controls.current.dragging = false;
        document.body.style.cursor = '';
      }}
      onPointerMove={(e) => {
        controls.current.pointer = { x: e.pointer.x, y: e.pointer.y };
        if (!controls.current.dragging) return;
        const now = performance.now();
        const dt = Math.max(8, now - last.current.t);
        const dx = e.clientX - last.current.x;
        const dy = e.clientY - last.current.y;
        last.current = { x: e.clientX, y: e.clientY, t: now };
        const vy = dx * 0.0048;
        const vx = dy * 0.0036;
        controls.current.rotY += vy;
        controls.current.rotX += vx;
        const scale = 16 / dt;
        sample.current.vx = sample.current.vx * 0.65 + vy * scale * 0.35;
        sample.current.vy = sample.current.vy * 0.65 + vx * scale * 0.35;
      }}
      onDoubleClick={(e) => {
        e.stopPropagation();
        controls.current.targetZoom = 1;
        controls.current.rotX = 0.18;
        controls.current.rotY = -0.28;
        controls.current.velX = 0;
        controls.current.velY = 0;
      }}
    >
      <sphereGeometry args={[1.62, 48, 48]} />
      <meshBasicMaterial transparent opacity={0} depthWrite={false} />
    </mesh>
  );
}

/** Modest wheel / pinch zoom — does not steal page scroll outside the canvas. */
function ModestZoom({ controls }: { controls: MutableRefObject<LandingEarthControls> }) {
  useEffect(() => {
    const el = document.querySelector('[data-landing-earth] canvas');
    if (!(el instanceof HTMLCanvasElement)) return;
    el.style.touchAction = 'none';
    let pinchDist: number | null = null;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      e.stopPropagation();
      controls.current.targetZoom *= e.deltaY > 0 ? 0.95 : 1.05;
      controls.current.targetZoom = THREE.MathUtils.clamp(controls.current.targetZoom, 0.82, 1.35);
    };
    const onTouchMove = (e: TouchEvent) => {
      if (e.touches.length !== 2) return;
      e.preventDefault();
      const [a, b] = [e.touches[0], e.touches[1]];
      const dist = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
      if (pinchDist != null) {
        controls.current.targetZoom = THREE.MathUtils.clamp(
          controls.current.targetZoom * (dist / pinchDist),
          0.82,
          1.35,
        );
      }
      pinchDist = dist;
    };
    const onTouchEnd = () => {
      pinchDist = null;
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    el.addEventListener('touchmove', onTouchMove, { passive: false });
    el.addEventListener('touchend', onTouchEnd);
    return () => {
      el.removeEventListener('wheel', onWheel);
      el.removeEventListener('touchmove', onTouchMove);
      el.removeEventListener('touchend', onTouchEnd);
    };
  }, [controls]);
  return null;
}

function InteractiveEarth({
  controls,
  hoverBoostRef,
  reducedMotion,
  sunDir,
  quality,
}: {
  controls: MutableRefObject<LandingEarthControls>;
  hoverBoostRef: MutableRefObject<boolean>;
  reducedMotion: boolean;
  sunDir: THREE.Vector3;
  quality: ReturnType<typeof detectEarthQuality>;
}) {
  const wrap = useRef<THREE.Group>(null!);

  useFrame((_, delta) => {
    const c = controls.current;
    c.targetZoom = THREE.MathUtils.clamp(c.targetZoom, 0.82, 1.35);
    c.zoom = THREE.MathUtils.damp(c.zoom, c.targetZoom, 8, delta);

    if (!reducedMotion) {
      if (!c.dragging) {
        c.rotY += c.velY;
        c.rotX += c.velX;
        c.velY *= 0.955;
        c.velX *= 0.955;
        if (Math.abs(c.velY) < 0.0002 && Math.abs(c.velX) < 0.0002) {
          c.velY = 0;
          c.velX = 0;
          // Slow institutional auto-rotate when idle.
          c.rotY += delta * 0.028;
        }
      }
    }
    c.rotX = THREE.MathUtils.clamp(c.rotX, -0.75, 0.75);

    if (wrap.current) {
      wrap.current.rotation.x = c.rotX;
      wrap.current.rotation.y = c.rotY;
      wrap.current.scale.setScalar(c.zoom);
    }
  });

  return (
    <group ref={wrap} position={[0.08, -0.28, 0.2]} scale={2.38}>
      <PhotorealEarthMesh
        radius={EARTH_RADIUS}
        autoRotate={false}
        reducedMotion={reducedMotion}
        sunDirection={sunDir}
        rotation={[0, 0, 0]}
        palette="landing-gold"
        quality={quality}
      />
      <SphereGeography
        zoomRef={controls}
        earthRadius={EARTH_RADIUS}
        reducedMotion={reducedMotion}
        layers={['borders', 'continents']}
        hoverBoostRef={hoverBoostRef}
      />
      {!reducedMotion && <DragOrbitSurface controls={controls} hoverBoostRef={hoverBoostRef} />}
    </group>
  );
}

function CameraEase({
  controls,
  reducedMotion,
}: {
  controls: MutableRefObject<LandingEarthControls>;
  reducedMotion: boolean;
}) {
  const { camera } = useThree();
  const base = useMemo(() => new THREE.Vector3(0, 0.05, 3.75), []);

  useFrame(() => {
    if (reducedMotion) {
      camera.position.lerp(base, 0.12);
      camera.lookAt(0, 0, 0);
      return;
    }
    const z = (controls.current.zoom - 1) * -0.35;
    const target = base.clone().add(new THREE.Vector3(0, 0, z));
    camera.position.lerp(target, 0.08);
    camera.lookAt(0, 0, 0);
  });

  return null;
}

export interface HeroEarthBackdropSceneProps {
  reducedMotion?: boolean;
}

export function HeroEarthBackdropScene({ reducedMotion = false }: HeroEarthBackdropSceneProps) {
  const sun = LANDING_SUN_POSITION;
  const sunDir = useMemo(() => LANDING_SUN_POSITION.clone().normalize(), []);
  const quality = useMemo(() => detectEarthQuality({ reducedMotion }), [reducedMotion]);
  const controls = useRef<LandingEarthControls>({
    rotX: 0.18,
    rotY: -0.28,
    velX: 0,
    velY: 0,
    zoom: 1,
    targetZoom: 1,
    pointer: { x: 0, y: 0 },
    dragging: false,
    hovering: false,
  });
  const hoverBoostRef = useRef(false);

  useEffect(() => {
    return () => {
      document.body.style.cursor = '';
    };
  }, []);

  return (
    <Canvas
      className="h-full w-full touch-none"
      camera={{ position: [0, 0.05, 3.75], fov: 40 }}
      gl={{
        alpha: true,
        antialias: true,
        powerPreference: 'high-performance',
        toneMapping: THREE.NoToneMapping,
        outputColorSpace: THREE.SRGBColorSpace,
      }}
      dpr={[1, reducedMotion ? 1 : quality === 'high' ? 1.75 : 1.35]}
      style={{ background: 'transparent' }}
      frameloop={reducedMotion ? 'demand' : 'always'}
      onCreated={({ gl }) => {
        gl.domElement.style.touchAction = 'none';
        gl.domElement.style.cursor = reducedMotion ? 'default' : 'grab';
        gl.domElement.style.pointerEvents = 'auto';
        gl.toneMapping = THREE.NoToneMapping;
        gl.setClearColor(0x000000, 0);
      }}
    >
      <ambientLight intensity={0.16} color="#d8c9a8" />
      <directionalLight position={[sun.x, sun.y, sun.z]} intensity={2.05} color="#fff1d6" />
      <directionalLight position={[2.4, 0.6, 1.8]} intensity={0.32} color="#8a9bb0" />
      <directionalLight position={[-1.2, -1.4, 2.0]} intensity={0.28} color="#b49a6b" />
      <LimbLight />
      <CameraEase controls={controls} reducedMotion={reducedMotion} />
      {!reducedMotion && <ModestZoom controls={controls} />}
      <InteractiveEarth
        controls={controls}
        hoverBoostRef={hoverBoostRef}
        reducedMotion={reducedMotion}
        sunDir={sunDir}
        quality={quality}
      />
    </Canvas>
  );
}

export default HeroEarthBackdropScene;
