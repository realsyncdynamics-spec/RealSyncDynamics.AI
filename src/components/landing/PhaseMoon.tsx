import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

/** Small moon; phases come from the same key light as Earth. */
export function PhaseMoon({
  reducedMotion,
  sunDir,
}: {
  reducedMotion: boolean;
  sunDir: THREE.Vector3;
}) {
  const orbit = useRef<THREE.Group>(null!);

  useFrame((_, delta) => {
    if (reducedMotion || !orbit.current) return;
    orbit.current.rotation.y += delta * 0.07;
  });

  return (
    <group ref={orbit} position={[-0.15, 0.85, -1.6]} rotation={[0.2, 0, 0.15]}>
      <mesh position={[2.35, 0.15, 0]} castShadow={false}>
        <sphereGeometry args={[0.14, 28, 28]} />
        <meshStandardMaterial color="#d8d2c6" roughness={0.95} metalness={0} />
      </mesh>
      <pointLight position={sunDir.toArray()} intensity={0} />
    </group>
  );
}
