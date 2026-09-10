import { Canvas, useFrame, useThree } from '@react-three/fiber';
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
  reducedMotion,
}: {
  selectedId: string | null;
  hoveredId: string | null;
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
            {/* Pick mesh — large enough for reliable canvas raycast hits. */}
            <mesh
              userData={{ nodeId: node.id, governanceNode: true }}
              scale={active ? 1.15 : 1}
            >
              <sphereGeometry args={[0.32, 16, 16]} />
              <meshBasicMaterial transparent opacity={0.001} depthWrite={false} />
            </mesh>
            <mesh scale={active ? 1.45 : 1.2} raycast={() => null}>
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

function SphereCore({
  controls,
  selectedId,
  hoveredId,
  reducedMotion,
  groupRef,
}: {
  controls: MutableRefObject<SphereControls>;
  selectedId: string | null;
  hoveredId: string | null;
  reducedMotion: boolean;
  groupRef: MutableRefObject<THREE.Group | null>;
}) {
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
    const group = groupRef.current;
    if (group) {
      group.rotation.x = c.rotX + c.pointerInfluence.y * 0.12;
      group.rotation.y = c.rotY + c.pointerInfluence.x * 0.18;
      group.scale.setScalar(c.zoom);
    }
  });

  return (
    <group ref={groupRef}>
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
      <Orbits reducedMotion={reducedMotion} />
      <AmbientParticles reducedMotion={reducedMotion} />
      <Nodes selectedId={selectedId} hoveredId={hoveredId} reducedMotion={reducedMotion} />
    </group>
  );
}

/**
 * Canvas-level raycast + orbit. Avoids R3F event conflicts that swallowed
 * node picks when a transparent DragSurface also received pointer events.
 */
function PointerBridge({
  controls,
  onSelect,
  onHover,
}: {
  controls: MutableRefObject<SphereControls>;
  onSelect: (node: GovernanceSphereNode | null) => void;
  onHover: (id: string | null) => void;
}) {
  const { camera, gl, scene } = useThree();
  const raycaster = useMemo(() => new THREE.Raycaster(), []);
  const pointer = useMemo(() => new THREE.Vector2(), []);
  const drag = useRef({ active: false, moved: false, lastX: 0, lastY: 0, picked: false });
  const pinchDist = useRef<number | null>(null);
  const onSelectRef = useRef(onSelect);
  const onHoverRef = useRef(onHover);
  onSelectRef.current = onSelect;
  onHoverRef.current = onHover;

  useEffect(() => {
    const el = gl.domElement;
    el.style.touchAction = 'none';
    el.style.cursor = 'grab';

    const collectNodeMeshes = () => {
      const meshes: THREE.Object3D[] = [];
      scene.traverse((obj) => {
        if (obj.userData?.governanceNode && obj.userData?.nodeId) meshes.push(obj);
      });
      return meshes;
    };

    const pickNodeId = (clientX: number, clientY: number): string | null => {
      const rect = el.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return null;
      pointer.x = ((clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(pointer, camera);
      // Prefer nearest front-facing governance node.
      const hits = raycaster
        .intersectObjects(collectNodeMeshes(), false)
        .filter((h) => h.object.visible !== false);
      const id = hits[0]?.object?.userData?.nodeId;
      return typeof id === 'string' ? id : null;
    };

    const nodeById = (id: string) =>
      GOVERNANCE_SPHERE_NODES.find((n) => n.id === id) ?? null;

    const onPointerDown = (e: PointerEvent) => {
      if (e.button !== 0 && e.pointerType === 'mouse') return;
      const nodeId = pickNodeId(e.clientX, e.clientY);
      if (nodeId) {
        const node = nodeById(nodeId);
        if (node) onSelectRef.current(node);
        drag.current = { active: false, moved: false, lastX: e.clientX, lastY: e.clientY, picked: true };
        el.style.cursor = 'pointer';
        return;
      }
      drag.current = {
        active: true,
        moved: false,
        lastX: e.clientX,
        lastY: e.clientY,
        picked: false,
      };
      controls.current.dragging = true;
      el.style.cursor = 'grabbing';
      el.setPointerCapture(e.pointerId);
    };

    const onPointerMove = (e: PointerEvent) => {
      const rect = el.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0 && !drag.current.active) {
        const nx = ((e.clientX - rect.left) / rect.width) * 2 - 1;
        const ny = -((e.clientY - rect.top) / rect.height) * 2 + 1;
        controls.current.pointerInfluence = { x: nx, y: ny };
        const hoverId = pickNodeId(e.clientX, e.clientY);
        onHoverRef.current(hoverId);
        el.style.cursor = hoverId ? 'pointer' : 'grab';
      }
      if (!drag.current.active) return;
      const dx = e.clientX - drag.current.lastX;
      const dy = e.clientY - drag.current.lastY;
      if (Math.abs(dx) + Math.abs(dy) > 3) drag.current.moved = true;
      drag.current.lastX = e.clientX;
      drag.current.lastY = e.clientY;
      controls.current.velY = dx * 0.0045;
      controls.current.velX = dy * 0.0035;
      controls.current.rotY += controls.current.velY;
      controls.current.rotX += controls.current.velX;
    };

    const onPointerUp = (e: PointerEvent) => {
      const { moved, picked, active } = drag.current;
      drag.current.active = false;
      controls.current.dragging = false;
      pinchDist.current = null;
      try {
        el.releasePointerCapture(e.pointerId);
      } catch {
        /* ignore */
      }
      el.style.cursor = 'grab';
      // Empty tap clears selection — never clear after a successful node pick.
      if (active && !moved && !picked) {
        const nodeId = pickNodeId(e.clientX, e.clientY);
        if (!nodeId) onSelectRef.current(null);
      }
      drag.current.picked = false;
    };

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      controls.current.zoom *= e.deltaY > 0 ? 0.96 : 1.04;
    };

    const onTouchMove = (e: TouchEvent) => {
      if (e.touches.length !== 2) return;
      const [a, b] = [e.touches[0], e.touches[1]];
      const dist = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
      if (pinchDist.current != null) controls.current.zoom *= dist / pinchDist.current;
      pinchDist.current = dist;
    };

    const onTouchEnd = () => {
      pinchDist.current = null;
    };

    el.addEventListener('pointerdown', onPointerDown);
    el.addEventListener('pointermove', onPointerMove);
    el.addEventListener('pointerup', onPointerUp);
    el.addEventListener('pointercancel', onPointerUp);
    el.addEventListener('wheel', onWheel, { passive: false });
    el.addEventListener('touchmove', onTouchMove, { passive: true });
    el.addEventListener('touchend', onTouchEnd);

    return () => {
      el.removeEventListener('pointerdown', onPointerDown);
      el.removeEventListener('pointermove', onPointerMove);
      el.removeEventListener('pointerup', onPointerUp);
      el.removeEventListener('pointercancel', onPointerUp);
      el.removeEventListener('wheel', onWheel);
      el.removeEventListener('touchmove', onTouchMove);
      el.removeEventListener('touchend', onTouchEnd);
    };
  }, [camera, controls, gl, pointer, raycaster, scene]);

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
  const groupRef = useRef<THREE.Group | null>(null);
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
    >
      <color attach="background" args={['transparent']} />
      <ambientLight intensity={0.55} />
      <pointLight position={[4, 3, 5]} intensity={1.1} color="#fff4e0" />
      <pointLight position={[-4, -2, -3]} intensity={0.55} color={GOLD} />
      <hemisphereLight args={['#2a3344', '#0a0a0b', 0.45]} />
      <PointerBridge controls={controls} onSelect={onSelect} onHover={setHoveredId} />
      <SphereCore
        controls={controls}
        selectedId={selectedId}
        hoveredId={hoveredId}
        reducedMotion={reducedMotion}
        groupRef={groupRef}
      />
    </Canvas>
  );
}

export default GovernanceSphereScene;
