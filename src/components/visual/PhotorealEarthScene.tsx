import { Canvas, useFrame } from '@react-three/fiber';
import { useEffect, useRef, type MutableRefObject } from 'react';
import * as THREE from 'three';
import { PhotorealEarthMesh } from './PhotorealEarthMesh';

/**
 * Photoreal Earth — R3F scene for `/welcome` right panel.
 * Day / night / clouds / specular: see `public/textures/README.md`.
 */

type WelcomeControls = {
  rotY: number;
  velY: number;
  pointer: { x: number; y: number };
  dragging: boolean;
};

function SceneLights({
  controls,
  reducedMotion,
  sunDir,
}: {
  controls: MutableRefObject<WelcomeControls>;
  reducedMotion: boolean;
  sunDir: THREE.Vector3;
}) {
  const key = useRef<THREE.DirectionalLight>(null!);
  useFrame(() => {
    const p = controls.current.pointer;
    const k = reducedMotion ? 0 : 1;
    const x = 4.5 + p.x * 1.2 * k;
    const y = 1.2 + p.y * 0.7 * k;
    if (key.current) key.current.position.set(x, y, 2.8);
    sunDir.set(x, y, 2.8).normalize();
  });
  return (
    <>
      <ambientLight intensity={0.28} />
      <directionalLight ref={key} position={[4.5, 1.2, 2.8]} intensity={2.1} color="#fff6e8" />
      <directionalLight position={[-3.5, -1.5, -2]} intensity={0.35} color="#6ec8ff" />
    </>
  );
}

function InteractiveEarth({
  controls,
  reducedMotion,
  sunDir,
}: {
  controls: MutableRefObject<WelcomeControls>;
  reducedMotion: boolean;
  sunDir: THREE.Vector3;
}) {
  const wrap = useRef<THREE.Group>(null!);
  const last = useRef({ x: 0 });

  useFrame((_, delta) => {
    const c = controls.current;
    if (!reducedMotion && !c.dragging) {
      c.rotY += c.velY;
      c.velY *= 0.96;
      if (Math.abs(c.velY) < 0.0003) {
        c.velY = 0;
        c.rotY += delta * 0.045;
      }
    }
    if (wrap.current) {
      wrap.current.rotation.y = c.rotY;
      wrap.current.rotation.x = reducedMotion ? 0 : c.pointer.y * 0.08;
    }
  });

  return (
    <group ref={wrap}>
      <PhotorealEarthMesh
        autoRotate={false}
        reducedMotion={reducedMotion}
        sunDirection={sunDir}
      />
      <mesh
        onPointerDown={(e) => {
          e.stopPropagation();
          controls.current.dragging = true;
          controls.current.velY = 0;
          last.current.x = e.clientX;
          document.body.style.cursor = 'grabbing';
        }}
        onPointerUp={() => {
          controls.current.dragging = false;
          document.body.style.cursor = 'grab';
        }}
        onPointerLeave={() => {
          controls.current.dragging = false;
          controls.current.pointer = { x: 0, y: 0 };
          document.body.style.cursor = 'grab';
        }}
        onPointerMove={(e) => {
          controls.current.pointer = { x: e.pointer.x, y: e.pointer.y };
          if (!controls.current.dragging) return;
          const dx = e.clientX - last.current.x;
          last.current.x = e.clientX;
          const v = dx * 0.005;
          controls.current.rotY += v;
          controls.current.velY = v;
        }}
        onWheel={(e) => {
          e.stopPropagation();
        }}
      >
        <sphereGeometry args={[1.62, 32, 32]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>
    </group>
  );
}

export interface PhotorealEarthSceneProps {
  reducedMotion?: boolean;
}

export function PhotorealEarthScene({ reducedMotion = false }: PhotorealEarthSceneProps) {
  const controls = useRef<WelcomeControls>({
    rotY: 0,
    velY: 0,
    pointer: { x: 0, y: 0 },
    dragging: false,
  });
  const sunDir = useRef(new THREE.Vector3(4.5, 1.2, 2.8).normalize()).current;
  useEffect(() => {
    return () => {
      document.body.style.cursor = '';
    };
  }, []);

  return (
    <Canvas
      className="h-full w-full"
      camera={{ position: [0, 0.15, 4.15], fov: 42 }}
      gl={{
        alpha: true,
        antialias: true,
        powerPreference: 'high-performance',
        toneMapping: THREE.NoToneMapping,
        outputColorSpace: THREE.SRGBColorSpace,
      }}
      dpr={[1, reducedMotion ? 1.25 : 1.85]}
      style={{ background: 'transparent' }}
      onCreated={({ gl }) => {
        gl.domElement.style.cursor = 'grab';
        gl.toneMapping = THREE.NoToneMapping;
      }}
    >
      <SceneLights controls={controls} reducedMotion={reducedMotion} sunDir={sunDir} />
      <InteractiveEarth controls={controls} reducedMotion={reducedMotion} sunDir={sunDir} />
    </Canvas>
  );
}

export default PhotorealEarthScene;
