import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef, useState, type MutableRefObject } from 'react';
import * as THREE from 'three';
import { PhotorealEarthMesh } from '../visual/PhotorealEarthMesh';
import {
  GOVERNANCE_SPHERE_NODES,
  sphereNodePosition,
  type GovernanceSphereNode,
} from './governance-sphere-nodes';
import {
  LANDING_ACCENT,
  LANDING_ACCENT_SOFT,
  LANDING_BG,
  LANDING_BORDER,
  LANDING_SILVER,
  LANDING_WARNING,
} from '../landing/landing-theme';

/**
 * Enterprise Visual System — Farben des Globus.
 *
 * three.js liest keine CSS-Variablen, deshalb der TS-Spiegel aus
 * `landing-theme.ts`. Hierarchie: governed = Cyan-Punkt, attention = Amber,
 * gewählt = Cyan mit zurückhaltendem Halo. Bahnen und Partikel sind Stahl
 * mit niedriger Deckung — sie ordnen, sie leuchten nicht.
 */
const NODE_GOVERNED = LANDING_ACCENT;
const NODE_SELECTED = LANDING_ACCENT_SOFT;
const NODE_ATTENTION = LANDING_WARNING;
const STEEL = LANDING_SILVER;
/** Lichttemperatur: neutral-kühles Weiß, kein Sonnenuntergang. */
const LIGHT_KEY = '#f4f7fa';
const LIGHT_FILL = '#e6edf3';
const EARTH_RADIUS = 1.55;

type SphereControls = {
  rotX: number;
  rotY: number;
  velX: number;
  velY: number;
  zoom: number;
  targetZoom: number;
  pointerInfluence: { x: number; y: number };
  dragging: boolean;
  /** Pointer NDC for light / camera parallax */
  pointer: { x: number; y: number };
};

function Nodes({
  selectedId,
  hoveredId,
  onHover,
  onSelect,
  reducedMotion,
}: {
  selectedId: string | null;
  hoveredId: string | null;
  onHover: (id: string | null) => void;
  onSelect: (node: GovernanceSphereNode) => void;
  reducedMotion: boolean;
}) {
  const pulse = useRef(0);

  useFrame((_, delta) => {
    if (!reducedMotion) pulse.current += delta;
  });

  return (
    <group>
      {GOVERNANCE_SPHERE_NODES.map((node) => {
        const pos = sphereNodePosition(node.lat, node.lon, 1.78);
        const active = selectedId === node.id || hoveredId === node.id;
        const attention = node.state === 'attention';
        const color = attention ? NODE_ATTENTION : active ? NODE_SELECTED : NODE_GOVERNED;
        // Atmung nur als Aktivitätssignal, nicht als Dauerpuls: 2 % statt 6 %.
        const breath = reducedMotion ? 1 : 1 + Math.sin(pulse.current * 1.6 + pos[0]) * 0.02;
        return (
          <group key={node.id} position={pos}>
            <mesh
              onPointerOver={(e) => {
                e.stopPropagation();
                onHover(node.id);
                document.body.style.cursor = 'pointer';
              }}
              onPointerOut={(e) => {
                e.stopPropagation();
                onHover(null);
                document.body.style.cursor = 'grab';
              }}
              onPointerDown={(e) => {
                e.stopPropagation();
                onSelect(node);
              }}
            >
              <sphereGeometry args={[0.24, 12, 12]} />
              <meshBasicMaterial transparent opacity={0} depthWrite={false} />
            </mesh>
            {/* Kleiner, klarer Punkt — kein übergroßer Pulskreis. */}
            <mesh scale={(active ? 1.25 : 1) * breath} raycast={() => null}>
              <sphereGeometry args={[0.07, 16, 16]} />
              <meshStandardMaterial
                color={color}
                emissive={color}
                emissiveIntensity={active ? 0.9 : attention ? 0.55 : 0.35}
                metalness={0.35}
                roughness={0.4}
              />
            </mesh>
            {/* Halo nur bei Auswahl oder Aufmerksamkeit — Leuchten zeigt Zustand an. */}
            {(active || attention) && !reducedMotion && (
              <mesh scale={active ? 2.4 : 1.9} raycast={() => null}>
                <sphereGeometry args={[0.07, 12, 12]} />
                <meshBasicMaterial
                  color={color}
                  transparent
                  opacity={active ? 0.18 : 0.08}
                  depthWrite={false}
                />
              </mesh>
            )}
            {active && !reducedMotion && (
              <mesh scale={3.2} raycast={() => null}>
                <ringGeometry args={[0.1, 0.125, 48]} />
                <meshBasicMaterial
                  color={NODE_SELECTED}
                  transparent
                  opacity={0.32}
                  side={THREE.DoubleSide}
                  depthWrite={false}
                />
              </mesh>
            )}
          </group>
        );
      })}
    </group>
  );
}

function Orbits({ reducedMotion }: { reducedMotion: boolean }) {
  const a = useRef<THREE.Mesh>(null!);
  const b = useRef<THREE.Mesh>(null!);
  const c = useRef<THREE.Mesh>(null!);
  useFrame((_, delta) => {
    if (reducedMotion) return;
    if (a.current) a.current.rotation.z += delta * 0.1;
    if (b.current) b.current.rotation.z -= delta * 0.07;
    if (c.current) c.current.rotation.y += delta * 0.045;
  });
  return (
    <>
      {/* Dünne Stahlbahnen, niedrige Deckung — Struktur, kein Neon. */}
      <mesh ref={a} rotation={[Math.PI / 2.4, 0.3, 0]} raycast={() => null}>
        <torusGeometry args={[2.05, 0.0035, 8, 160]} />
        <meshBasicMaterial color={STEEL} transparent opacity={0.14} />
      </mesh>
      <mesh ref={b} rotation={[1.1, 0.8, 0.2]} raycast={() => null}>
        <torusGeometry args={[2.28, 0.0028, 8, 180]} />
        <meshBasicMaterial color={STEEL} transparent opacity={0.09} />
      </mesh>
      <mesh ref={c} rotation={[0.35, 0.15, 0.6]} raycast={() => null}>
        <torusGeometry args={[2.48, 0.0022, 8, 200]} />
        <meshBasicMaterial color={NODE_GOVERNED} transparent opacity={0.07} />
      </mesh>
    </>
  );
}

function AmbientParticles({ reducedMotion }: { reducedMotion: boolean }) {
  const ref = useRef<THREE.Points>(null!);
  const positions = useMemo(() => {
    // 48 statt 120 Partikel: Tiefe andeuten, kein Partikelfeld.
    const arr = new Float32Array(48 * 3);
    for (let i = 0; i < 48; i++) {
      const r = 2.35 + Math.random() * 1.05;
      const phi = Math.acos(2 * Math.random() - 1);
      const theta = Math.random() * Math.PI * 2;
      arr[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      arr[i * 3 + 1] = r * Math.cos(phi);
      arr[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);
    }
    return arr;
  }, []);

  const geometry = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    return geo;
  }, [positions]);

  useFrame((_, delta) => {
    if (reducedMotion || !ref.current) return;
    ref.current.rotation.y += delta * 0.035;
  });

  return (
    <points ref={ref} geometry={geometry} raycast={() => null}>
      <pointsMaterial
        color={STEEL}
        size={0.016}
        sizeAttenuation
        transparent
        opacity={0.22}
        depthWrite={false}
      />
    </points>
  );
}

function DragSurface({
  controls,
}: {
  controls: MutableRefObject<SphereControls>;
}) {
  const last = useRef({ x: 0, y: 0, t: 0 });
  const sample = useRef({ vx: 0, vy: 0 });

  return (
    <mesh
      onPointerDown={(e) => {
        e.stopPropagation();
        const canvas = document.querySelector('[data-governance-sphere] canvas');
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
        // Release with sampled flick velocity for buttery inertia.
        controls.current.velY = THREE.MathUtils.clamp(sample.current.vx, -0.08, 0.08);
        controls.current.velX = THREE.MathUtils.clamp(sample.current.vy, -0.06, 0.06);
        const canvas = document.querySelector('[data-governance-sphere] canvas');
        if (canvas instanceof HTMLCanvasElement) {
          try {
            canvas.releasePointerCapture(e.pointerId);
          } catch {
            /* ignore */
          }
        }
        document.body.style.cursor = 'grab';
      }}
      onPointerMove={(e) => {
        const nx = e.pointer.x;
        const ny = e.pointer.y;
        controls.current.pointer = { x: nx, y: ny };
        if (!controls.current.dragging) {
          controls.current.pointerInfluence = { x: nx, y: ny };
          return;
        }
        const now = performance.now();
        const dt = Math.max(8, now - last.current.t);
        const dx = e.clientX - last.current.x;
        const dy = e.clientY - last.current.y;
        last.current = { x: e.clientX, y: e.clientY, t: now };
        const vy = dx * 0.0052;
        const vx = dy * 0.004;
        controls.current.rotY += vy;
        controls.current.rotX += vx;
        // EMA of flick velocity (px → rad scaled by dt)
        const scale = 16 / dt;
        sample.current.vx = sample.current.vx * 0.65 + vy * scale * 0.35;
        sample.current.vy = sample.current.vy * 0.65 + vx * scale * 0.35;
      }}
      onPointerLeave={() => {
        if (controls.current.dragging) {
          controls.current.velY = THREE.MathUtils.clamp(sample.current.vx, -0.08, 0.08);
          controls.current.velX = THREE.MathUtils.clamp(sample.current.vy, -0.06, 0.06);
        }
        controls.current.dragging = false;
        controls.current.pointerInfluence = { x: 0, y: 0 };
        document.body.style.cursor = 'grab';
      }}
      onWheel={(e) => {
        e.stopPropagation();
        const ne = e.nativeEvent as WheelEvent | undefined;
        const delta = ne?.deltaY ?? 0;
        controls.current.targetZoom *= delta > 0 ? 0.94 : 1.06;
      }}
      onDoubleClick={(e) => {
        e.stopPropagation();
        controls.current.targetZoom = 1;
        controls.current.rotX = 0.22;
        controls.current.rotY = -0.35;
        controls.current.velX = 0;
        controls.current.velY = 0;
      }}
    >
      <sphereGeometry args={[1.62, 48, 48]} />
      <meshBasicMaterial transparent opacity={0} depthWrite={false} />
    </mesh>
  );
}

function PointerLights({
  controls,
  reducedMotion,
  sunDir,
}: {
  controls: MutableRefObject<SphereControls>;
  reducedMotion: boolean;
  sunDir: THREE.Vector3;
}) {
  const key = useRef<THREE.DirectionalLight>(null!);
  const fill = useRef<THREE.PointLight>(null!);

  useFrame(() => {
    const p = controls.current.pointer;
    const influence = reducedMotion ? 0 : 1;
    const lx = 4.2 + p.x * 1.4 * influence;
    const ly = 1.3 + p.y * 0.9 * influence;
    const lz = 3.0;
    if (key.current) {
      key.current.position.set(lx, ly, lz);
      sunDir.set(lx, ly, lz).normalize();
    }
    if (fill.current) {
      fill.current.position.set(-2.8 - p.x * 0.6 * influence, 1.8, 3.2);
    }
  });

  return (
    <>
      {/* Neutrales Schlüssellicht, kühles Gegenlicht: Titan statt Sonnenuntergang. */}
      <ambientLight intensity={0.5} />
      <directionalLight ref={key} position={[4.5, 1.4, 3.2]} intensity={1.25} color={LIGHT_KEY} />
      <directionalLight position={[-3.2, -1.2, -2.4]} intensity={0.35} color={LANDING_ACCENT_SOFT} />
      <pointLight ref={fill} position={[3.2, 2.2, 4]} intensity={0.4} color={LIGHT_FILL} />
      <hemisphereLight args={[LANDING_BORDER, LANDING_BG, 0.35]} />
    </>
  );
}

function CameraParallax({
  controls,
  reducedMotion,
}: {
  controls: MutableRefObject<SphereControls>;
  reducedMotion: boolean;
}) {
  const { camera } = useThree();
  const base = useMemo(() => new THREE.Vector3(0, 0.15, 5.2), []);

  useFrame(() => {
    if (reducedMotion) {
      camera.position.lerp(base, 0.12);
      camera.lookAt(0, 0, 0);
      return;
    }
    const p = controls.current.pointerInfluence;
    const target = base
      .clone()
      .add(new THREE.Vector3(p.x * 0.22, p.y * 0.14, (controls.current.zoom - 1) * -0.35));
    camera.position.lerp(target, 0.08);
    camera.lookAt(0, 0, 0);
  });

  return null;
}

function SphereCore({
  controls,
  selectedId,
  hoveredId,
  onHover,
  onSelect,
  reducedMotion,
  sunDir,
}: {
  controls: MutableRefObject<SphereControls>;
  selectedId: string | null;
  hoveredId: string | null;
  onHover: (id: string | null) => void;
  onSelect: (node: GovernanceSphereNode) => void;
  reducedMotion: boolean;
  sunDir: THREE.Vector3;
}) {
  const group = useRef<THREE.Group>(null!);

  useFrame((_, delta) => {
    const c = controls.current;
    // Smooth zoom toward target
    c.targetZoom = THREE.MathUtils.clamp(c.targetZoom, 0.72, 1.6);
    c.zoom = THREE.MathUtils.damp(c.zoom, c.targetZoom, 8, delta);

    if (!reducedMotion) {
      if (!c.dragging) {
        c.rotY += c.velY;
        c.rotX += c.velX;
        // Longer, silkier inertia
        c.velY *= 0.955;
        c.velX *= 0.955;
        if (Math.abs(c.velY) < 0.00025 && Math.abs(c.velX) < 0.00025) {
          c.velY = 0;
          c.velX = 0;
          c.rotY += delta * 0.065;
        }
      }
    }
    c.rotX = THREE.MathUtils.clamp(c.rotX, -0.9, 0.9);
    if (group.current) {
      const px = reducedMotion ? 0 : c.pointerInfluence.y * 0.1;
      const py = reducedMotion ? 0 : c.pointerInfluence.x * 0.16;
      group.current.rotation.x = c.rotX + px;
      group.current.rotation.y = c.rotY + py;
      group.current.scale.setScalar(c.zoom);
    }
  });

  return (
    <group ref={group}>
      <PhotorealEarthMesh
        radius={EARTH_RADIUS}
        autoRotate={false}
        reducedMotion={reducedMotion}
        rotation={[0, 0, 0]}
        sunDirection={sunDir}
      />
      <DragSurface controls={controls} />
      <Orbits reducedMotion={reducedMotion} />
      <AmbientParticles reducedMotion={reducedMotion} />
      <Nodes
        selectedId={selectedId}
        hoveredId={hoveredId}
        onHover={onHover}
        onSelect={onSelect}
        reducedMotion={reducedMotion}
      />
    </group>
  );
}

/** Pinch zoom via native touch on the canvas element (wheel handled in-scene). */
function PinchZoom({ controls }: { controls: MutableRefObject<SphereControls> }) {
  useEffect(() => {
    const el = document.querySelector('[data-governance-sphere] canvas');
    if (!(el instanceof HTMLCanvasElement)) return;
    el.style.touchAction = 'none';
    let pinchDist: number | null = null;
    const onTouchMove = (e: TouchEvent) => {
      if (e.touches.length !== 2) return;
      e.preventDefault();
      const [a, b] = [e.touches[0], e.touches[1]];
      const dist = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
      if (pinchDist != null) {
        controls.current.targetZoom *= dist / pinchDist;
      }
      pinchDist = dist;
    };
    const onTouchEnd = () => {
      pinchDist = null;
    };
    el.addEventListener('touchmove', onTouchMove, { passive: false });
    el.addEventListener('touchend', onTouchEnd);
    return () => {
      el.removeEventListener('touchmove', onTouchMove);
      el.removeEventListener('touchend', onTouchEnd);
    };
  }, [controls]);
  return null;
}

export interface GovernanceSphereSceneProps {
  selectedId: string | null;
  onSelect: (node: GovernanceSphereNode | null) => void;
  reducedMotion?: boolean;
}

export function GovernanceSphereScene({
  selectedId,
  onSelect,
  reducedMotion = false,
}: GovernanceSphereSceneProps) {
  const controls = useRef<SphereControls>({
    rotX: 0.22,
    rotY: -0.35,
    velX: 0,
    velY: 0,
    zoom: 1,
    targetZoom: 1,
    pointerInfluence: { x: 0, y: 0 },
    pointer: { x: 0, y: 0 },
    dragging: false,
  });
  const sunDir = useMemo(() => new THREE.Vector3(4.5, 1.4, 3.2).normalize(), []);
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  useEffect(() => {
    return () => {
      document.body.style.cursor = '';
    };
  }, []);

  return (
    <Canvas
      className="h-full w-full touch-none"
      camera={{ position: [0, 0.15, 5.2], fov: 42 }}
      gl={{
        alpha: true,
        antialias: true,
        powerPreference: 'high-performance',
        toneMapping: THREE.NoToneMapping,
        outputColorSpace: THREE.SRGBColorSpace,
      }}
      dpr={[1, reducedMotion ? 1.25 : 2]}
      onCreated={({ gl }) => {
        gl.domElement.style.touchAction = 'none';
        gl.domElement.style.cursor = 'grab';
        gl.toneMapping = THREE.NoToneMapping;
      }}
      onPointerMissed={() => onSelect(null)}
    >
      <PointerLights controls={controls} reducedMotion={reducedMotion} sunDir={sunDir} />
      <CameraParallax controls={controls} reducedMotion={reducedMotion} />
      <PinchZoom controls={controls} />
      <SphereCore
        controls={controls}
        selectedId={selectedId}
        hoveredId={hoveredId}
        onHover={setHoveredId}
        onSelect={onSelect}
        reducedMotion={reducedMotion}
        sunDir={sunDir}
      />
    </Canvas>
  );
}

export default GovernanceSphereScene;
