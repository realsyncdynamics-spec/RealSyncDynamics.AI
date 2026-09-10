import { Canvas, useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef, useState, type MutableRefObject } from 'react';
import * as THREE from 'three';
import {
  GOVERNANCE_SPHERE_NODES,
  sphereNodePosition,
  type GovernanceSphereNode,
} from './governance-sphere-nodes';

const GOLD = '#e8c98a';
const GOLD_SOFT = '#f3d9a0';
const ATTENTION = '#d4a574';
const CORE = '#0b1220';

type SphereControls = {
  rotX: number;
  rotY: number;
  velX: number;
  velY: number;
  zoom: number;
  pointerInfluence: { x: number; y: number };
  dragging: boolean;
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
  return (
    <group>
      {GOVERNANCE_SPHERE_NODES.map((node) => {
        const pos = sphereNodePosition(node.lat, node.lon, 1.78);
        const active = selectedId === node.id || hoveredId === node.id;
        const attention = node.state === 'attention';
        const color = attention ? ATTENTION : GOLD;
        return (
          <group key={node.id} position={pos}>
            {/* Invisible hit target — larger than the visible core for reliable picks. */}
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
                // Select on down so orbit / miss handlers cannot clear in the same gesture.
                onSelect(node);
              }}
            >
              <sphereGeometry args={[0.22, 12, 12]} />
              <meshBasicMaterial transparent opacity={0} depthWrite={false} />
            </mesh>
            <mesh scale={active ? 1.5 : 1.25} raycast={() => null}>
              <sphereGeometry args={[0.09, 16, 16]} />
              <meshStandardMaterial
                color={color}
                emissive={color}
                emissiveIntensity={active ? 1.05 : attention ? 0.6 : 0.4}
                metalness={0.55}
                roughness={0.35}
              />
            </mesh>
            {!reducedMotion && (
              <mesh scale={active ? 2.8 : 2.1} raycast={() => null}>
                <sphereGeometry args={[0.09, 12, 12]} />
                <meshBasicMaterial
                  color={color}
                  transparent
                  opacity={active ? 0.24 : 0.1}
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
  useFrame((_, delta) => {
    if (reducedMotion) return;
    if (a.current) a.current.rotation.z += delta * 0.12;
    if (b.current) b.current.rotation.z -= delta * 0.08;
  });
  return (
    <>
      <mesh ref={a} rotation={[Math.PI / 2.4, 0.3, 0]} raycast={() => null}>
        <torusGeometry args={[2.05, 0.006, 8, 128]} />
        <meshBasicMaterial color={GOLD} transparent opacity={0.28} />
      </mesh>
      <mesh ref={b} rotation={[1.1, 0.8, 0.2]} raycast={() => null}>
        <torusGeometry args={[2.25, 0.004, 8, 160]} />
        <meshBasicMaterial color={GOLD_SOFT} transparent opacity={0.18} />
      </mesh>
    </>
  );
}

function AmbientParticles({ reducedMotion }: { reducedMotion: boolean }) {
  const ref = useRef<THREE.Points>(null!);
  const positions = useMemo(() => {
    const arr = new Float32Array(90 * 3);
    for (let i = 0; i < 90; i++) {
      const r = 2.4 + Math.random() * 0.9;
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
    ref.current.rotation.y += delta * 0.04;
  });

  return (
    <points ref={ref} geometry={geometry} raycast={() => null}>
      <pointsMaterial
        color={GOLD_SOFT}
        size={0.025}
        sizeAttenuation
        transparent
        opacity={0.45}
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
  const last = useRef({ x: 0, y: 0 });

  return (
    <mesh
      // Slightly inside node radius so node hits win when aimed at nodes.
      onPointerDown={(e) => {
        e.stopPropagation();
        controls.current.dragging = true;
        last.current = { x: e.clientX, y: e.clientY };
        document.body.style.cursor = 'grabbing';
      }}
      onPointerUp={() => {
        controls.current.dragging = false;
        document.body.style.cursor = 'grab';
      }}
      onPointerMove={(e) => {
        const nx = e.pointer.x;
        const ny = e.pointer.y;
        if (!controls.current.dragging) {
          controls.current.pointerInfluence = { x: nx, y: ny };
          return;
        }
        const dx = e.clientX - last.current.x;
        const dy = e.clientY - last.current.y;
        last.current = { x: e.clientX, y: e.clientY };
        controls.current.velY = dx * 0.0045;
        controls.current.velX = dy * 0.0035;
        controls.current.rotY += controls.current.velY;
        controls.current.rotX += controls.current.velX;
      }}
      onPointerLeave={() => {
        controls.current.dragging = false;
        controls.current.pointerInfluence = { x: 0, y: 0 };
        document.body.style.cursor = 'grab';
      }}
      onWheel={(e) => {
        e.stopPropagation();
        const ne = e.nativeEvent as WheelEvent | undefined;
        const delta = ne?.deltaY ?? 0;
        controls.current.zoom *= delta > 0 ? 0.96 : 1.04;
      }}
    >
      <sphereGeometry args={[1.62, 48, 48]} />
      <meshBasicMaterial transparent opacity={0} depthWrite={false} />
    </mesh>
  );
}

function SphereCore({
  controls,
  selectedId,
  hoveredId,
  onHover,
  onSelect,
  reducedMotion,
}: {
  controls: MutableRefObject<SphereControls>;
  selectedId: string | null;
  hoveredId: string | null;
  onHover: (id: string | null) => void;
  onSelect: (node: GovernanceSphereNode) => void;
  reducedMotion: boolean;
}) {
  const group = useRef<THREE.Group>(null!);

  useFrame((_, delta) => {
    const c = controls.current;
    if (!reducedMotion) {
      c.rotY += c.velY;
      c.rotX += c.velX;
      c.velY *= 0.94;
      c.velX *= 0.94;
      if (!c.dragging && Math.abs(c.velY) < 0.0004 && Math.abs(c.velX) < 0.0004) {
        c.rotY += delta * 0.08;
      }
    }
    c.rotX = THREE.MathUtils.clamp(c.rotX, -0.85, 0.85);
    c.zoom = THREE.MathUtils.clamp(c.zoom, 0.72, 1.55);
    if (group.current) {
      group.current.rotation.x = c.rotX + c.pointerInfluence.y * 0.12;
      group.current.rotation.y = c.rotY + c.pointerInfluence.x * 0.18;
      group.current.scale.setScalar(c.zoom);
    }
  });

  return (
    <group ref={group}>
      <mesh raycast={() => null}>
        <icosahedronGeometry args={[1.55, 2]} />
        <meshStandardMaterial
          color={CORE}
          emissive="#1a1520"
          emissiveIntensity={0.35}
          metalness={0.72}
          roughness={0.45}
          wireframe
        />
      </mesh>
      <mesh raycast={() => null}>
        <sphereGeometry args={[1.48, 48, 48]} />
        <meshStandardMaterial
          color="#0a101c"
          emissive="#3d3428"
          emissiveIntensity={0.22}
          metalness={0.6}
          roughness={0.55}
          transparent
          opacity={0.88}
        />
      </mesh>
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
      const [a, b] = [e.touches[0], e.touches[1]];
      const dist = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
      if (pinchDist != null) controls.current.zoom *= dist / pinchDist;
      pinchDist = dist;
    };
    const onTouchEnd = () => {
      pinchDist = null;
    };
    el.addEventListener('touchmove', onTouchMove, { passive: true });
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
    rotX: 0.18,
    rotY: 0.4,
    velX: 0,
    velY: 0,
    zoom: 1,
    pointerInfluence: { x: 0, y: 0 },
    dragging: false,
  });
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
      gl={{ alpha: true, antialias: true, powerPreference: 'high-performance' }}
      dpr={[1, 1.75]}
      onCreated={({ gl }) => {
        gl.domElement.style.touchAction = 'none';
        gl.domElement.style.cursor = 'grab';
      }}
    >
      <color attach="background" args={['transparent']} />
      <ambientLight intensity={0.55} />
      <pointLight position={[4, 3, 5]} intensity={1.1} color="#fff4e0" />
      <pointLight position={[-4, -2, -3]} intensity={0.55} color={GOLD} />
      <hemisphereLight args={['#2a3344', '#0a0a0b', 0.45]} />
      <PinchZoom controls={controls} />
      <SphereCore
        controls={controls}
        selectedId={selectedId}
        hoveredId={hoveredId}
        onHover={setHoveredId}
        onSelect={onSelect}
        reducedMotion={reducedMotion}
      />
    </Canvas>
  );
}

export default GovernanceSphereScene;
