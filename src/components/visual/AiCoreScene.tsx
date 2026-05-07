import { Canvas, useFrame } from '@react-three/fiber';
import { useRef } from 'react';
import * as THREE from 'three';

/**
 * AiCoreScene — 3D Watchmaker-AI centerpiece (Three.js + R3F).
 *
 * Counterpart to AiCoreVisual.svg, lazy-loaded only on capable viewports.
 * Composition:
 *   - Brass torus ring rotating CW (metallic, gold)
 *   - Gunmetal inner torus rotating CCW (slightly tilted for depth)
 *   - AI chip cube at center with cyan emissive pulse
 *   - Two point lights (warm brass-side + cool ai-cyan-side) for dimensionality
 *
 * Default export so it can be code-split with React.lazy.
 */

function BrassRing() {
  const ref = useRef<THREE.Mesh>(null!);
  useFrame((_, delta) => {
    if (ref.current) ref.current.rotation.z += delta * 0.18;
  });
  return (
    <mesh ref={ref}>
      <torusGeometry args={[1.6, 0.13, 24, 96]} />
      <meshStandardMaterial color="#b78a3d" metalness={1} roughness={0.22} />
    </mesh>
  );
}

function GunmetalRing() {
  const ref = useRef<THREE.Mesh>(null!);
  useFrame((_, delta) => {
    if (ref.current) ref.current.rotation.z -= delta * 0.26;
  });
  return (
    <mesh ref={ref} rotation={[Math.PI / 14, 0, 0]}>
      <torusGeometry args={[1.22, 0.07, 20, 80]} />
      <meshStandardMaterial color="#2a2e35" metalness={0.88} roughness={0.35} />
    </mesh>
  );
}

function AiChip() {
  const ref = useRef<THREE.Mesh>(null!);
  useFrame((state) => {
    const m = ref.current?.material;
    if (m && (m as THREE.MeshStandardMaterial).emissiveIntensity !== undefined) {
      const t = state.clock.elapsedTime;
      (m as THREE.MeshStandardMaterial).emissiveIntensity = 0.6 + Math.sin(t * 2.3) * 0.28;
    }
  });
  return (
    <mesh ref={ref}>
      <boxGeometry args={[0.62, 0.62, 0.18]} />
      <meshStandardMaterial
        color="#0a0a0b"
        emissive="#14c4b3"
        emissiveIntensity={0.7}
        metalness={0.85}
        roughness={0.32}
      />
    </mesh>
  );
}

function CircuitTraces() {
  // Four short cyan emissive bars radiating from chip toward inner ring,
  // pulsing in scale to suggest data flow.
  const refs = [useRef<THREE.Mesh>(null!), useRef<THREE.Mesh>(null!), useRef<THREE.Mesh>(null!), useRef<THREE.Mesh>(null!)];
  useFrame((state) => {
    const t = state.clock.elapsedTime;
    refs.forEach((r, i) => {
      if (!r.current) return;
      const phase = t * 1.4 + i * 1.5;
      const s = 0.8 + (Math.sin(phase) * 0.5 + 0.5) * 0.6;
      r.current.scale.x = s;
    });
  });
  const positions: Array<[number, number, number]> = [
    [0.6, 0,    0],
    [-0.6, 0,   0],
    [0,    0.6, 0],
    [0,   -0.6, 0],
  ];
  const rotations: Array<[number, number, number]> = [
    [0, 0, 0],
    [0, 0, Math.PI],
    [0, 0, Math.PI / 2],
    [0, 0, -Math.PI / 2],
  ];
  return (
    <>
      {positions.map((p, i) => (
        <mesh key={i} ref={refs[i]} position={p} rotation={rotations[i]}>
          <boxGeometry args={[0.5, 0.025, 0.015]} />
          <meshStandardMaterial
            color="#053f37"
            emissive="#14c4b3"
            emissiveIntensity={1.1}
          />
        </mesh>
      ))}
    </>
  );
}

export default function AiCoreScene() {
  return (
    <Canvas
      camera={{ position: [0, 0, 4.4], fov: 42 }}
      gl={{ antialias: true, alpha: true }}
      dpr={[1, 2]}
      style={{ width: '100%', height: '100%', background: 'transparent' }}
    >
      <ambientLight intensity={0.32} />
      <pointLight position={[2.4, 2, 2]} intensity={1.4} color="#fbf6e9" />
      <pointLight position={[-1.6, -1.4, 1.8]} intensity={0.9} color="#5fe5d1" />
      <BrassRing />
      <GunmetalRing />
      <CircuitTraces />
      <AiChip />
    </Canvas>
  );
}
