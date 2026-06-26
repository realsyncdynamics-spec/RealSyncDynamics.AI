import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { useRef, useMemo } from 'react';
import * as THREE from 'three';

/**
 * GlobeVisualization — Animated 3D globe with rotating latitude/longitude lines.
 * Used on Demo Landing Page as centerpiece visual.
 *
 * Features:
 * - Wireframe globe with subtle grid
 * - Rotating lat/long lines (AI cyan color)
 * - Pulsing glow effect
 * - Responsive to viewport
 */

function Wireframe() {
  const ref = useRef<THREE.Group>(null!);

  useFrame(() => {
    if (ref.current) {
      ref.current.rotation.y += 0.0003;
      ref.current.rotation.x += 0.00008;
    }
  });

  return (
    <group ref={ref}>
      {/* Main globe sphere with thin wireframe */}
      <mesh>
        <icosahedronGeometry args={[2, 16]} />
        <meshStandardMaterial
          color="#0a0a0b"
          emissive="#14c4b3"
          emissiveIntensity={0.15}
          wireframe
          metalness={0.4}
          roughness={0.8}
        />
      </mesh>

      {/* Latitude lines (horizontal rings) */}
      {Array.from({ length: 7 }).map((_, i) => {
        const angle = (Math.PI / 8) * (i + 1) - Math.PI / 2;
        const radius = 2 * Math.cos(angle);
        const height = 2 * Math.sin(angle);
        return (
          <mesh key={`lat-${i}`} position={[0, height, 0]}>
            <torusGeometry args={[radius, 0.01, 32, 64]} />
            <meshStandardMaterial
              color="#14c4b3"
              emissive="#14c4b3"
              emissiveIntensity={0.4}
              metalness={0.6}
              roughness={0.4}
            />
          </mesh>
        );
      })}

      {/* Longitude lines (vertical) */}
      {Array.from({ length: 12 }).map((_, i) => {
        const angle = (Math.PI * 2 * i) / 12;
        return (
          <group key={`lon-${i}`} rotation={[0, angle, 0]}>
            <mesh position={[0, 0, 2]}>
              <boxGeometry args={[0.01, 4, 0.01]} />
              <meshStandardMaterial
                color="#14c4b3"
                emissive="#14c4b3"
                emissiveIntensity={0.3}
                metalness={0.6}
                roughness={0.4}
              />
            </mesh>
          </group>
        );
      })}
    </group>
  );
}

function Lights() {
  return (
    <>
      <pointLight position={[10, 10, 10]} intensity={0.8} color="#f9c544" />
      <pointLight position={[-10, -10, -10]} intensity={0.6} color="#14c4b3" />
      <ambientLight intensity={0.4} />
    </>
  );
}

export function GlobeVisualization() {
  return (
    <Canvas
      className="w-full h-full"
      camera={{ position: [0, 0, 5.5], fov: 50 }}
      gl={{ alpha: true, antialias: true }}
      dpr={[1, 2]}
    >
      <Lights />
      <Wireframe />
    </Canvas>
  );
}
