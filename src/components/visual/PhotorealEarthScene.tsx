import { Canvas } from '@react-three/fiber';
import { PhotorealEarthMesh } from './PhotorealEarthMesh';

/**
 * Photoreal Earth — R3F scene for `/welcome` right panel.
 * Day texture: public domain / three.js examples earth_atmos map
 * (shipped locally as `/textures/earth-day.jpg`).
 */

function SceneLights() {
  return (
    <>
      <ambientLight intensity={0.28} />
      {/* Sun-side key light */}
      <directionalLight position={[4.5, 1.2, 2.8]} intensity={2.1} color="#fff6e8" />
      {/* Cool fill from space */}
      <directionalLight position={[-3.5, -1.5, -2]} intensity={0.35} color="#6ec8ff" />
    </>
  );
}

export interface PhotorealEarthSceneProps {
  reducedMotion?: boolean;
}

export function PhotorealEarthScene({ reducedMotion = false }: PhotorealEarthSceneProps) {
  return (
    <Canvas
      className="h-full w-full"
      camera={{ position: [0, 0.15, 4.15], fov: 42 }}
      gl={{ alpha: true, antialias: true, powerPreference: 'high-performance' }}
      dpr={[1, 1.75]}
      style={{ background: 'transparent' }}
    >
      <SceneLights />
      <PhotorealEarthMesh autoRotate reducedMotion={reducedMotion} />
    </Canvas>
  );
}

export default PhotorealEarthScene;
