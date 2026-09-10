import { Canvas, ThreeEvent, useFrame } from '@react-three/fiber';
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

type DragState = {
  active: boolean;
  pointerId: number | null;
  lastX: number;
  lastY: number;
};

type SphereControls = {
  rotX: number;
  rotY: number;
  velX: number;
  velY: number;
  zoom: number;
  pointerInfluence: { x: number; y: number };
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
        const pos = sphereNodePosition(node.lat, node.lon, 1.72);
        const active = selectedId === node.id || hoveredId === node.id;
        const attention = node.state === 'attention';
        const color = attention ? ATTENTION : GOLD;
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
              onClick={(e) => {
                e.stopPropagation();
                onSelect(node);
              }}
              scale={active ? 1.35 : 1}
            >
              <sphereGeometry args={[0.055, 16, 16]} />
              <meshStandardMaterial
                color={color}
                emissive={color}
                emissiveIntensity={active ? 0.85 : attention ? 0.45 : 0.28}
                metalness={0.55}
                roughness={0.35}
              />
            </mesh>
            {!reducedMotion && (
              <mesh scale={active ? 2.4 : 1.8}>
                <sphereGeometry args={[0.055, 12, 12]} />
                <meshBasicMaterial
                  color={color}
                  transparent
                  opacity={active ? 0.18 : 0.08}
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
      <mesh ref={a} rotation={[Math.PI / 2.4, 0.3, 0]}>
        <torusGeometry args={[2.05, 0.006, 8, 128]} />
        <meshBasicMaterial color={GOLD} transparent opacity={0.28} />
      </mesh>
      <mesh ref={b} rotation={[1.1, 0.8, 0.2]}>
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

  useFrame((_, delta) => {
    if (reducedMotion || !ref.current) return;
    ref.current.rotation.y += delta * 0.04;
  });

  return (
    <points ref={ref}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          count={positions.length / 3}
          array={positions}
          itemSize={3}
        />
      </bufferGeometry>
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
      // Ambient drift when idle
      if (Math.abs(c.velY) < 0.0004 && Math.abs(c.velX) < 0.0004) {
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
      <mesh>
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
      <mesh>
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
  });
  const drag = useRef<DragState>({
    active: false,
    pointerId: null,
    lastX: 0,
    lastY: 0,
  });
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const pinch = useRef<{ dist: number | null }>({ dist: null });

  useEffect(() => {
    return () => {
      document.body.style.cursor = '';
    };
  }, []);

  const onPointerMoveInfluence = (e: ThreeEvent<PointerEvent>) => {
    if (drag.current.active) return;
    const x = (e.pointer.x || 0);
    const y = (e.pointer.y || 0);
    controls.current.pointerInfluence.x = x;
    controls.current.pointerInfluence.y = y;
  };

  return (
    <Canvas
      className="h-full w-full touch-none"
      camera={{ position: [0, 0.15, 5.2], fov: 42 }}
      gl={{ alpha: true, antialias: true, powerPreference: 'high-performance' }}
      dpr={[1, 1.75]}
      onCreated={({ gl }) => {
        gl.domElement.style.touchAction = 'none';
      }}
      onPointerDown={(e) => {
        drag.current = {
          active: true,
          pointerId: e.pointerId,
          lastX: e.clientX,
          lastY: e.clientY,
        };
        document.body.style.cursor = 'grabbing';
        (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
      }}
      onPointerUp={() => {
        drag.current.active = false;
        drag.current.pointerId = null;
        pinch.current.dist = null;
        document.body.style.cursor = hoveredId ? 'pointer' : 'grab';
      }}
      onPointerLeave={() => {
        drag.current.active = false;
        controls.current.pointerInfluence = { x: 0, y: 0 };
        document.body.style.cursor = '';
      }}
      onPointerMove={(e) => {
        if (!drag.current.active) return;
        const dx = e.clientX - drag.current.lastX;
        const dy = e.clientY - drag.current.lastY;
        drag.current.lastX = e.clientX;
        drag.current.lastY = e.clientY;
        controls.current.velY = dx * 0.0045;
        controls.current.velX = dy * 0.0035;
        controls.current.rotY += controls.current.velY;
        controls.current.rotX += controls.current.velX;
      }}
      onWheel={(e) => {
        e.preventDefault();
        controls.current.zoom *= e.deltaY > 0 ? 0.96 : 1.04;
      }}
      onTouchMove={(e) => {
        if (e.touches.length === 2) {
          const [a, b] = [e.touches[0], e.touches[1]];
          const dist = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
          if (pinch.current.dist != null) {
            const ratio = dist / pinch.current.dist;
            controls.current.zoom *= ratio;
          }
          pinch.current.dist = dist;
        }
      }}
      onTouchEnd={() => {
        pinch.current.dist = null;
      }}
    >
      <color attach="background" args={['transparent']} />
      <ambientLight intensity={0.55} />
      <pointLight position={[4, 3, 5]} intensity={1.1} color="#fff4e0" />
      <pointLight position={[-4, -2, -3]} intensity={0.55} color={GOLD} />
      <hemisphereLight args={['#2a3344', '#0a0a0b', 0.45]} />
      <SphereCore
        controls={controls}
        selectedId={selectedId}
        hoveredId={hoveredId}
        onHover={setHoveredId}
        onSelect={onSelect}
        reducedMotion={reducedMotion}
      />
      <mesh
        visible={false}
        onPointerMove={onPointerMoveInfluence}
        onClick={() => onSelect(null)}
      >
        <sphereGeometry args={[3.2, 16, 16]} />
        <meshBasicMaterial transparent opacity={0} />
      </mesh>
    </Canvas>
  );
}

export default GovernanceSphereScene;
