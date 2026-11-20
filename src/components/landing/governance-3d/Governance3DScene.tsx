import { Suspense, useEffect, useMemo, useRef, useState, type RefObject } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Float } from '@react-three/drei';
import * as THREE from 'three';

// Separate lazy-loaded chunk: WebGL must not delay first-paint copy/CTA.
export interface MotionState {
  progress: number;
  pointerX: number;
  pointerY: number;
}


const NODE_POINTS: [number, number, number][] = [
  [-0.68, -0.52, 0.22], [0.65, -0.44, -0.28], [-0.38, 0.54, -0.46],
  [0.49, 0.58, 0.36], [0.04, 0.03, 0.64], [-0.05, 0.12, -0.67],
  [-0.74, 0.21, 0.01], [0.7, 0.1, 0.02], [0, -0.74, 0.04],
];
const EDGES: [number, number][] = [
  [0, 4], [0, 6], [1, 4], [1, 7], [2, 5], [2, 6],
  [3, 4], [3, 7], [4, 5], [4, 8], [5, 8], [6, 7],
];
const MODULES = [
  { key: 'AUDIT', angle: -2.4, height: 0.68, color: '#46caff' },
  { key: 'EVIDENCE', angle: -1.45, height: -0.46, color: '#7c83ff' },
  { key: 'POLICY', angle: -0.48, height: 0.55, color: '#49b8ff' },
  { key: 'RISK', angle: 0.52, height: -0.55, color: '#a18cff' },
  { key: 'MONITOR', angle: 1.52, height: 0.58, color: '#52dbeb' },
  { key: 'CONTROL', angle: 2.55, height: -0.42, color: '#668aff' },
] as const;


function supportsWebGL(): boolean {
  if (typeof document === 'undefined') return false;
  try {
    const canvas = document.createElement('canvas');
    return !!(canvas.getContext('webgl2') || canvas.getContext('webgl'));
  } catch {
    return false;
  }
}

function Network() {
  const group = useRef<THREE.Group>(null);
  const positions = useMemo(() => {
    const coordinates: number[] = [];
    EDGES.forEach(([a, b]) => coordinates.push(...NODE_POINTS[a], ...NODE_POINTS[b]));
    return new Float32Array(coordinates);
  }, []);
  useFrame(({ clock }) => {
    if (group.current) group.current.rotation.y = clock.elapsedTime * 0.075;
  });
  return (
    <group ref={group}>
      <lineSegments>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[positions, 3]} />
        </bufferGeometry>
        <lineBasicMaterial color="#7baeff" transparent opacity={0.5} depthWrite={false} />
      </lineSegments>
      {NODE_POINTS.map((point, i) => (
        <mesh key={i} position={point}>
          <sphereGeometry args={[i === 4 ? 0.09 : 0.055, 12, 12]} />
          <meshBasicMaterial color={i % 3 === 0 ? '#45d7ff' : '#7e97ff'} />
        </mesh>
      ))}
      <mesh>
        <icosahedronGeometry args={[0.30, 1]} />
        <meshPhysicalMaterial color="#7faaff" metalness={0.15} roughness={0.16}
          transparent opacity={0.20} depthWrite={false} />
      </mesh>
    </group>
  );
}

function GlassShell({ index, motion }: { index: number; motion: RefObject<MotionState> }) {
  const root = useRef<THREE.Group>(null);
  const size = (1.2 + index * 0.26) * 2;
  const geometry = useMemo(() => new THREE.BoxGeometry(size, size, size), [size]);
  useEffect(() => () => geometry.dispose(), [geometry]);

  useFrame((_, delta) => {
    if (!root.current) return;
    const spread = THREE.MathUtils.smoothstep(motion.current.progress, 0.20, 0.88);
    root.current.position.y = THREE.MathUtils.damp(root.current.position.y, (index - 1) * spread * 1.50, 5, delta);
    root.current.rotation.z = THREE.MathUtils.damp(root.current.rotation.z, (index % 2 ? -1 : 1) * spread * 0.24, 5, delta);
    root.current.scale.setScalar(1 - spread * 0.12);
  });
  return (
    <group ref={root}>
      <mesh geometry={geometry}>
        <meshPhysicalMaterial color={index === 1 ? '#c2e4ff' : '#e4f2ff'} metalness={0.08}
          roughness={0.08} transmission={0.76} thickness={0.30} ior={1.35}
          transparent opacity={1} depthWrite={false} />
      </mesh>
      <lineSegments>
        <edgesGeometry args={[geometry]} />
        <lineBasicMaterial color={index === 1 ? '#5d9fff' : '#8dcfff'}
          transparent opacity={index === 2 ? 0.38 : 0.75} />
      </lineSegments>
    </group>
  );
}

function Orbit({ motion }: { motion: RefObject<MotionState> }) {
  const root = useRef<THREE.Group>(null);
  useFrame((_, delta) => {
    if (!root.current) return;
    const reveal = THREE.MathUtils.smoothstep(motion.current.progress, 0.38, 0.9);
    MODULES.forEach((item, i) => {
      const child = root.current?.children[i];
      if (!child) return;
      const distance = 1.25 + reveal * 2;
      const target = new THREE.Vector3(
        Math.sin(item.angle) * distance,
        item.height * (1 + reveal),
        Math.cos(item.angle) * distance,
      );
      child.position.lerp(target, 1 - Math.exp(-delta * 5));
      child.scale.setScalar(0.35 + reveal * 0.65);
    });
  });
  return (
    <group ref={root}>
      {MODULES.map((item) => (
        <group key={item.key}
          position={[Math.sin(item.angle) * 1.25, item.height, Math.cos(item.angle) * 1.25]}>
          <mesh>
            <octahedronGeometry args={[0.14, 0]} />
            <meshBasicMaterial color={item.color} />
          </mesh>
          <mesh>
            <sphereGeometry args={[0.24, 12, 12]} />
            <meshBasicMaterial color={item.color} transparent opacity={0.1} depthWrite={false} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

function GovernanceCore({ motion }: { motion: RefObject<MotionState> }) {
  const root = useRef<THREE.Group>(null);
  useFrame(({ clock }, delta) => {
    if (!root.current) return;
    const state = motion.current;
    root.current.rotation.x = THREE.MathUtils.damp(
      root.current.rotation.x, 0.20 + state.pointerY * 0.10 + state.progress * 0.12, 3, delta,
    );
    root.current.rotation.y = THREE.MathUtils.damp(
      root.current.rotation.y, -0.50 + state.pointerX * 0.16 + clock.elapsedTime * 0.09 + state.progress * 0.65, 3, delta,
    );
    root.current.scale.setScalar(0.82 + state.progress * 0.16);
  });
  return (
    <group ref={root}>
      {[0, 1, 2].map((index) => <GlassShell key={index} index={index} motion={motion} />)}
      <Network />
      <Orbit motion={motion} />
    </group>
  );
}

function StillCube() {
  return (
    <div className="rs-governance-hero__fallback" aria-hidden="true">
      <div className="rs-governance-hero__fallback-cube" />
    </div>
  );
}

function Visual({ motion, reduced }: { motion: RefObject<MotionState>; reduced: boolean }) {
  const [available] = useState(supportsWebGL);
  const [lost, setLost] = useState(false);
  if (!available || lost || reduced) return <StillCube />;

  return (
    <Canvas
      camera={{ position: [5, 3.2, 8.7], fov: 38, near: 0.1, far: 80 }}
      dpr={[1, 1.5]}
      gl={{ alpha: true, antialias: true, powerPreference: 'high-performance' }}
      onCreated={({ gl }) => {
        gl.setClearColor('#ffffff', 0);
        gl.domElement.addEventListener('webglcontextlost', () => setLost(true), { once: true });
      }}
    >
      <ambientLight intensity={1.7} />
      <directionalLight position={[5, 7, 8]} intensity={2.2} />
      <pointLight position={[-4, -2, 4]} intensity={35} color="#67c7ff" distance={16} />
      <pointLight position={[4, 1, -4]} intensity={24} color="#9288ff" distance={14} />
      <Suspense fallback={null}>
        <Float speed={0.75} rotationIntensity={0} floatIntensity={0.12}>
          <GovernanceCore motion={motion} />
        </Float>
      </Suspense>
    </Canvas>
  );
}


export default function Governance3DScene({
  motion, reduced,
}: { motion: RefObject<MotionState>; reduced: boolean }) {
  return <Visual motion={motion} reduced={reduced} />;
}
