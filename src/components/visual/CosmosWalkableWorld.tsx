import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, Sky } from '@react-three/drei';
import * as THREE from 'three';
import { terrainHeight, treeLocations } from './cosmosTerrainMath';

type Motion = 'forward' | 'back' | 'left' | 'right' | null;
const PANEL: CSSProperties = {
  background: 'rgba(5, 12, 24, 0.90)',
  border: '1px solid #35516b',
  color: '#e8f4ff',
  padding: 14,
  fontFamily: 'system-ui, sans-serif',
  backdropFilter: 'blur(10px)',
};
const BUTTON: CSSProperties = {
  padding: '10px 12px',
  border: '1px solid #537996',
  borderRadius: 0,
  background: '#11283e',
  color: '#e8f4ff',
  cursor: 'pointer',
  touchAction: 'none',
};

function Landscape() {
  const geometry = useMemo(() => {
    const plane = new THREE.PlaneGeometry(110, 110, 90, 90);
    plane.rotateX(-Math.PI / 2);
    const positions = plane.getAttribute('position');
    for (let i = 0; i < positions.count; i += 1) {
      const x = positions.getX(i);
      const z = positions.getZ(i);
      positions.setY(i, terrainHeight(x, z));
    }
    positions.needsUpdate = true;
    plane.computeVertexNormals();
    return plane;
  }, []);
  useEffect(() => () => geometry.dispose(), [geometry]);
  return (
    <mesh geometry={geometry} receiveShadow>
      <meshStandardMaterial color="#477e4e" roughness={1} side={THREE.DoubleSide} />
    </mesh>
  );
}

function Forest() {
  const positions = useMemo(treeLocations, []);
  const trunks = useRef<THREE.InstancedMesh>(null);
  const crowns = useRef<THREE.InstancedMesh>(null);
  useEffect(() => {
    if (!trunks.current || !crowns.current) return;
    const matrix = new THREE.Object3D();
    positions.forEach(([x, y, z], i) => {
      const scale = 0.75 + ((i * 37) % 13) / 20;
      matrix.position.set(x, y + 1.2 * scale, z);
      matrix.scale.setScalar(scale);
      matrix.updateMatrix();
      trunks.current!.setMatrixAt(i, matrix.matrix);
      matrix.position.set(x, y + 3 * scale, z);
      matrix.updateMatrix();
      crowns.current!.setMatrixAt(i, matrix.matrix);
    });
    trunks.current.instanceMatrix.needsUpdate = true;
    crowns.current.instanceMatrix.needsUpdate = true;
  }, [positions]);
  return (
    <>
      <instancedMesh ref={trunks} args={[undefined, undefined, positions.length]} castShadow>
        <cylinderGeometry args={[0.18, 0.27, 2.4, 6]} />
        <meshStandardMaterial color="#654329" roughness={1} />
      </instancedMesh>
      <instancedMesh ref={crowns} args={[undefined, undefined, positions.length]} castShadow>
        <coneGeometry args={[1.15, 4.1, 7]} />
        <meshStandardMaterial color="#276a3d" roughness={1} />
      </instancedMesh>
    </>
  );
}

function Village() {
  const positions: Array<[number, number]> = [
    [11, -9], [20, -9], [10, 0], [21, 1], [16, 11],
  ];
  return (
    <>
      {positions.map(([x, z], index) => {
        const y = terrainHeight(x, z);
        return (
          <group key={index} position={[x, y, z]}>
            <mesh position={[0, 1.7, 0]} castShadow receiveShadow>
              <boxGeometry args={[4.7, 3.4, 4.7]} />
              <meshStandardMaterial color={index % 2 ? '#c7b69f' : '#d8cfba'} />
            </mesh>
            <mesh position={[0, 4.25, 0]} castShadow rotation={[0, Math.PI / 4, 0]}>
              <coneGeometry args={[3.65, 2.4, 4]} />
              <meshStandardMaterial color="#8b4939" roughness={0.95} />
            </mesh>
            <mesh position={[0, 1.25, 2.37]}>
              <planeGeometry args={[1.1, 2.25]} />
              <meshStandardMaterial color="#5c4031" />
            </mesh>
          </group>
        );
      })}
    </>
  );
}

function Road() {
  const segments = useMemo(
    () => Array.from({ length: 35 }, (_, i) => {
      const z = -49 + i * 2.9;
      const x = 4 + Math.sin(z * 0.09) * 3;
      return { x, z, y: terrainHeight(x, z) + 0.10 };
    }), []);
  return (
    <>
      {segments.map(({ x, z, y }, index) => (
        <mesh key={index} position={[x, y, z]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[4.2, 3.3]} />
          <meshStandardMaterial color="#998874" roughness={1}
            side={THREE.DoubleSide} />
        </mesh>
      ))}
    </>
  );
}

function WalkController({ motion }: { motion: Motion }) {
  const { camera } = useThree();
  const pressed = useRef(new Set<string>());
  const forward = useRef(new THREE.Vector3());
  const lateral = useRef(new THREE.Vector3());
  const movement = useRef(new THREE.Vector3());
  useEffect(() => {
    const down = (event: KeyboardEvent) => {
      if (event.target instanceof HTMLInputElement ||
          event.target instanceof HTMLTextAreaElement) return;
      if (['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(event.key.toLowerCase())) {
        pressed.current.add(event.key.toLowerCase());
        if (event.key.toLowerCase().startsWith('arrow')) event.preventDefault();
      }
    };
    const up = (event: KeyboardEvent) => pressed.current.delete(event.key.toLowerCase());
    const blur = () => pressed.current.clear();
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    window.addEventListener('blur', blur);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
      window.removeEventListener('blur', blur);
    };
  }, []);
  useFrame((state, dt) => {
    const ctrl = state.controls as unknown as { target: THREE.Vector3; update: () => void } | null;
    if (!ctrl) return;
    const keys = pressed.current;
    const ahead = keys.has('w') || keys.has('arrowup') || motion === 'forward';
    const back = keys.has('s') || keys.has('arrowdown') || motion === 'back';
    const left = keys.has('a') || keys.has('arrowleft') || motion === 'left';
    const right = keys.has('d') || keys.has('arrowright') || motion === 'right';
    if (!ahead && !back && !left && !right) return;
    camera.getWorldDirection(forward.current);
    forward.current.y = 0;
    if (forward.current.lengthSq() < 0.001) forward.current.set(0, 0, -1);
    forward.current.normalize();
    lateral.current.set(-forward.current.z, 0, forward.current.x);
    movement.current.set(0, 0, 0);
    movement.current.addScaledVector(forward.current, Number(ahead) - Number(back));
    movement.current.addScaledVector(lateral.current, Number(right) - Number(left));
    if (movement.current.lengthSq() === 0) return;
    movement.current.normalize().multiplyScalar(Math.min(dt, 0.05) * 8);
    const newX = THREE.MathUtils.clamp(camera.position.x + movement.current.x, -51, 51);
    const newZ = THREE.MathUtils.clamp(camera.position.z + movement.current.z, -51, 51);
    movement.current.x = newX - camera.position.x;
    movement.current.z = newZ - camera.position.z;
    const minHeight = terrainHeight(newX, newZ) + 2.1;
    movement.current.y = Math.max(0, minHeight - camera.position.y);
    camera.position.add(movement.current);
    ctrl.target.add(movement.current);
    ctrl.update();
  });
  return <OrbitControls makeDefault enablePan={false} enableDamping
    minDistance={2.2} maxDistance={38} maxPolarAngle={Math.PI / 2.02}
    target={[0, terrainHeight(0, 0) + 1, 0]} />;
}

export function CosmosWalkableWorld({ onBack }: { onBack: () => void }) {
  const [motion, setMotion] = useState<Motion>(null);
  const [night, setNight] = useState(false);
  return (
    <section aria-label="Begehbare fiktive 3D-Landschaft"
      style={{ position: 'relative', height: '100dvh', background: '#0b1931', overflow: 'hidden' }}>
      <Canvas camera={{ position: [0, 8, 19], fov: 64, near: 0.15, far: 210 }}
        dpr={[1, 1.5]} gl={{ antialias: true }}
        shadows fallback={<p role="alert">WebGL ist hier nicht verfügbar.</p>}>
        <color attach="background" args={[night ? '#071022' : '#9bbfd2']} />
        <fog attach="fog" args={[night ? '#071022' : '#9bbfd2', 55, 125]} />
        {!night && <Sky distance={450000} sunPosition={[8, 25, -12]} />}
        <ambientLight intensity={night ? 0.20 : 1.4} />
        <directionalLight position={[15, 28, 12]} intensity={night ? 0.35 : 2}
          castShadow shadow-mapSize={[1024, 1024]}
          shadow-camera-left={-55} shadow-camera-right={55}
          shadow-camera-top={55} shadow-camera-bottom={-55} />
        <Landscape />
        <Forest />
        <Road />
        <Village />
        <mesh position={[-18, -0.9, -14]} rotation={[-Math.PI / 2, 0, 0]}>
          <circleGeometry args={[9.5, 48]} />
          <meshStandardMaterial color="#2877a1" transparent opacity={0.85}
            metalness={0.25} roughness={0.2} side={THREE.DoubleSide} />
        </mesh>
        <WalkController motion={motion} />
      </Canvas>
      <div style={{ ...PANEL, position: 'absolute', top: 12, left: 12,
        right: 12, maxWidth: 480 }}>
        <strong style={{ color: '#8fe2ff', letterSpacing: 1.4, fontSize: 11 }}>
          REALSYNC COSMOS · WORLD DEMO
        </strong>
        <h2 style={{ margin: '5px 0', fontSize: 21 }}>Begehbare 3D-Landschaft</h2>
        <p style={{ fontSize: 12, margin: '4px 0 10px' }}>
          Fiktive Testwelt – keine echten Geländedaten oder Gebäude.
        </p>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button style={BUTTON} onClick={onBack}>← Sonnensystem</button>
          <button style={BUTTON} onClick={() => setNight(v => !v)}>
            {night ? 'Tageslicht' : 'Nachtansicht'}
          </button>
        </div>
      </div>
      <div style={{ ...PANEL, position: 'absolute', bottom: 12, right: 12,
        width: 208, maxWidth: 'calc(100vw - 24px)' }}>
        <div style={{ fontSize: 11, marginBottom: 9, color: '#b9d5e5' }}>
          WASD / Pfeiltasten bewegen · Ziehen umsehen · Zoomen mit zwei Fingern
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 5 }}>
          {([
            ['left', '←', 1, 0], ['forward', '↑', 2, 0],
            ['right', '→', 3, 0], ['back', '↓', 2, 1],
          ] as const).map(([dir, label, col, row]) => (
            <button key={dir} aria-label={dir === 'forward' ? 'Vorwärts' :
              dir === 'back' ? 'Rückwärts' : dir === 'left' ? 'Links' : 'Rechts'}
              style={{ ...BUTTON, gridColumn: col, gridRow: row + 1, padding: '12px 0' }}
              onPointerDown={(event) => {
                event.currentTarget.setPointerCapture(event.pointerId);
                setMotion(dir);
              }}
              onPointerUp={() => setMotion(null)}
              onPointerCancel={() => setMotion(null)}
              onLostPointerCapture={() => setMotion(null)}
            >{label}</button>
          ))}
        </div>
      </div>
    </section>
  );
}
