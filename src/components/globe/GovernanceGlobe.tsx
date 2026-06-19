import { Canvas, useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';

/**
 * GovernanceGlobe — interaktive 3D-Europa-Weltkugel (Three.js + R3F).
 *
 * Hero-Centerpiece für die Governance-OS-Homepage. Premium, dunkel,
 * europäisch — keine externen Texturen/APIs, alle Maps werden zur
 * Laufzeit per Canvas erzeugt.
 *
 * Komposition:
 *   - dunkler Planet (InnerSphere) als okkludierende Basis
 *   - dotted Globe (Punktwolke, Europa heller) als „Datennetz"
 *   - leuchtende City-Marker für DSGVO/EU-Länder
 *   - animierte Datenströme (Bezier-Arcs mit wandernden Kometen)
 *   - Fresnel-Atmosphäre (Petrol-Halo) + dezenter Sternenhintergrund
 *
 * Default-Export → code-split via React.lazy. Wird nur auf fähigen
 * Viewports und bei erlaubter Motion gemountet (siehe GovernanceOsHome).
 */

// ── Geo-Helfer ───────────────────────────────────────────────────────

function latLonToVec3(lat: number, lon: number, r: number): THREE.Vector3 {
  const phi = (90 - lat) * (Math.PI / 180);
  const theta = (lon + 180) * (Math.PI / 180);
  return new THREE.Vector3(
    -r * Math.sin(phi) * Math.cos(theta),
    r * Math.cos(phi),
    r * Math.sin(phi) * Math.sin(theta),
  );
}

// EU/DSGVO-Länder als leuchtende Punkte (Hauptstädte/Zentren).
const CITIES: Array<{ name: string; lat: number; lon: number; hub?: boolean }> = [
  { name: 'Deutschland', lat: 52.52, lon: 13.4, hub: true },
  { name: 'Österreich', lat: 48.21, lon: 16.37 },
  { name: 'Schweiz', lat: 47.37, lon: 8.54 },
  { name: 'Frankreich', lat: 48.85, lon: 2.35 },
  { name: 'Italien', lat: 41.9, lon: 12.5 },
  { name: 'Spanien', lat: 40.42, lon: -3.7 },
  { name: 'Niederlande', lat: 52.37, lon: 4.9 },
  { name: 'Belgien', lat: 50.85, lon: 4.35 },
  { name: 'Polen', lat: 52.23, lon: 21.01 },
  { name: 'Schweden', lat: 59.33, lon: 18.07 },
  { name: 'Dänemark', lat: 55.68, lon: 12.57 },
  { name: 'Portugal', lat: 38.72, lon: -9.14 },
  { name: 'Irland', lat: 53.35, lon: -6.26 },
  { name: 'Finnland', lat: 60.17, lon: 24.94 },
  { name: 'Tschechien', lat: 50.08, lon: 14.44 },
  { name: 'Griechenland', lat: 37.98, lon: 23.73 },
];

// Datenströme: Berlin (Hub, Index 0) → restliche Länder + Querverbindungen.
const ARCS: Array<[number, number]> = [
  [0, 3], [0, 4], [0, 5], [0, 8], [0, 9], [0, 13], [0, 15],
  [3, 5], [6, 12], [1, 14], [7, 6], [2, 4], [10, 9], [11, 5],
];

const ACCENTS = ['#2dd4bf', '#5fe5d1', '#34d399', '#1a6fff'];

// ── Canvas-Texturen (rund, additiv) ──────────────────────────────────

function makeRadialTexture(inner: string, outer: string): THREE.CanvasTexture {
  const size = 64;
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d')!;
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, inner);
  g.addColorStop(0.4, outer);
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(c);
  tex.needsUpdate = true;
  return tex;
}

// ── Dunkler Planet ───────────────────────────────────────────────────

function InnerSphere() {
  return (
    <mesh>
      <sphereGeometry args={[0.995, 64, 64]} />
      <meshStandardMaterial
        color="#070709"
        emissive="#0d3b38"
        emissiveIntensity={0.18}
        metalness={0.45}
        roughness={0.85}
      />
    </mesh>
  );
}

// ── Dotted Globe (Punktwolke) ────────────────────────────────────────

function DottedSphere() {
  const dotTex = useMemo(() => makeRadialTexture('rgba(255,255,255,1)', 'rgba(255,255,255,0.5)'), []);
  const { positions, colors } = useMemo(() => {
    const N = 1700;
    const pos = new Float32Array(N * 3);
    const col = new Float32Array(N * 3);
    const europe = latLonToVec3(50, 10, 1).normalize();
    const base = new THREE.Color('#243042');
    const eu = new THREE.Color('#2dd4bf');
    const golden = Math.PI * (3 - Math.sqrt(5));
    const tmp = new THREE.Vector3();
    for (let i = 0; i < N; i++) {
      const y = 1 - (i / (N - 1)) * 2;
      const radius = Math.sqrt(Math.max(0, 1 - y * y));
      const theta = golden * i;
      tmp.set(Math.cos(theta) * radius, y, Math.sin(theta) * radius);
      pos[i * 3] = tmp.x * 1.004;
      pos[i * 3 + 1] = tmp.y * 1.004;
      pos[i * 3 + 2] = tmp.z * 1.004;
      const prox = tmp.dot(europe); // -1..1
      const t = Math.max(0, (prox - 0.78) / 0.22);
      const c = base.clone().lerp(eu, Math.min(1, t * t));
      col[i * 3] = c.r;
      col[i * 3 + 1] = c.g;
      col[i * 3 + 2] = c.b;
    }
    return { positions: pos, colors: col };
  }, []);

  return (
    <points>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
        <bufferAttribute attach="attributes-color" args={[colors, 3]} />
      </bufferGeometry>
      <pointsMaterial
        size={0.016}
        map={dotTex}
        vertexColors
        transparent
        depthWrite={false}
        sizeAttenuation
        blending={THREE.AdditiveBlending}
      />
    </points>
  );
}

// ── City-Marker (leuchtende DSGVO-Länder) ────────────────────────────

function CityMarkers() {
  const haloTex = useMemo(() => makeRadialTexture('rgba(94,229,209,0.95)', 'rgba(45,212,191,0.35)'), []);
  const groupRef = useRef<THREE.Group>(null!);

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    const g = groupRef.current;
    if (!g) return;
    g.children.forEach((child, i) => {
      const s = 0.9 + Math.sin(t * 1.6 + i * 0.9) * 0.18;
      child.scale.setScalar(s);
    });
  });

  return (
    <>
      <group ref={groupRef}>
        {CITIES.map((c) => {
          const p = latLonToVec3(c.lat, c.lon, 1.012);
          const scale = c.hub ? 0.16 : 0.1;
          return (
            <sprite key={c.name} position={p} scale={[scale, scale, scale]}>
              <spriteMaterial
                map={haloTex}
                color={c.hub ? '#7dffe8' : '#2dd4bf'}
                transparent
                depthWrite={false}
                blending={THREE.AdditiveBlending}
                opacity={0.9}
              />
            </sprite>
          );
        })}
      </group>
      {/* feste, helle Kerne (kein Pulsieren) */}
      {CITIES.map((c) => {
        const p = latLonToVec3(c.lat, c.lon, 1.012);
        return (
          <mesh key={`core-${c.name}`} position={p}>
            <sphereGeometry args={[c.hub ? 0.013 : 0.009, 12, 12]} />
            <meshBasicMaterial color={c.hub ? '#eafffb' : '#9af5e6'} toneMapped={false} />
          </mesh>
        );
      })}
    </>
  );
}

// ── Datenströme (animierte Arcs) ─────────────────────────────────────

function DataArcs() {
  const cometTex = useMemo(() => makeRadialTexture('rgba(255,255,255,1)', 'rgba(125,255,232,0.5)'), []);
  const arcs = useMemo(() => {
    return ARCS.map(([a, b], i) => {
      const start = latLonToVec3(CITIES[a].lat, CITIES[a].lon, 1.01);
      const end = latLonToVec3(CITIES[b].lat, CITIES[b].lon, 1.01);
      const mid = start.clone().add(end).multiplyScalar(0.5);
      const lift = 1 + start.distanceTo(end) * 0.42;
      mid.normalize().multiplyScalar(lift);
      const curve = new THREE.QuadraticBezierCurve3(start, mid, end);
      const tube = new THREE.TubeGeometry(curve, 40, 0.0045, 6, false);
      return {
        curve,
        tube,
        color: ACCENTS[i % ACCENTS.length],
        speed: 0.18 + (i % 5) * 0.04,
        offset: (i * 0.137) % 1,
      };
    });
  }, []);

  const cometRefs = useRef<Array<THREE.Sprite | null>>([]);

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    arcs.forEach((arc, i) => {
      const sprite = cometRefs.current[i];
      if (!sprite) return;
      const p = (t * arc.speed + arc.offset) % 1;
      const pos = arc.curve.getPoint(p);
      sprite.position.copy(pos);
      const fade = Math.sin(p * Math.PI); // an Endpunkten ausblenden
      (sprite.material as THREE.SpriteMaterial).opacity = 0.25 + fade * 0.75;
    });
  });

  return (
    <>
      {arcs.map((arc, i) => (
        <group key={i}>
          <mesh geometry={arc.tube}>
            <meshBasicMaterial
              color={arc.color}
              transparent
              opacity={0.22}
              blending={THREE.AdditiveBlending}
              depthWrite={false}
              toneMapped={false}
            />
          </mesh>
          <sprite
            ref={(el) => { cometRefs.current[i] = el; }}
            scale={[0.07, 0.07, 0.07]}
          >
            <spriteMaterial
              map={cometTex}
              color={arc.color}
              transparent
              depthWrite={false}
              blending={THREE.AdditiveBlending}
              toneMapped={false}
            />
          </sprite>
        </group>
      ))}
    </>
  );
}

// ── Fresnel-Atmosphäre (Petrol-Halo) ─────────────────────────────────

function Atmosphere() {
  const material = useMemo(() => {
    return new THREE.ShaderMaterial({
      uniforms: { glowColor: { value: new THREE.Color('#14b8a6') } },
      vertexShader: `
        varying vec3 vNormal;
        varying vec3 vView;
        void main() {
          vNormal = normalize(normalMatrix * normal);
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          vView = normalize(-mv.xyz);
          gl_Position = projectionMatrix * mv;
        }
      `,
      fragmentShader: `
        uniform vec3 glowColor;
        varying vec3 vNormal;
        varying vec3 vView;
        void main() {
          float fres = pow(1.0 - abs(dot(vNormal, vView)), 3.0);
          gl_FragColor = vec4(glowColor, fres * 0.85);
        }
      `,
      side: THREE.BackSide,
      blending: THREE.AdditiveBlending,
      transparent: true,
      depthWrite: false,
    });
  }, []);

  return (
    <mesh material={material}>
      <sphereGeometry args={[1.22, 48, 48]} />
    </mesh>
  );
}

// ── Sternenhintergrund (dezente Partikel) ────────────────────────────

function BackgroundStars() {
  const ref = useRef<THREE.Points>(null!);
  const positions = useMemo(() => {
    const N = 320;
    const pos = new Float32Array(N * 3);
    for (let i = 0; i < N; i++) {
      const r = 4 + Math.random() * 6;
      const phi = Math.acos(2 * Math.random() - 1);
      const theta = Math.random() * Math.PI * 2;
      pos[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      pos[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
      pos[i * 3 + 2] = r * Math.cos(phi);
    }
    return pos;
  }, []);

  useFrame((_, delta) => {
    if (ref.current) ref.current.rotation.y += delta * 0.01;
  });

  return (
    <points ref={ref}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial size={0.03} color="#3a4a5e" transparent opacity={0.7} sizeAttenuation />
    </points>
  );
}

// ── Rotierende Globe-Gruppe ──────────────────────────────────────────

function GlobeGroup() {
  const ref = useRef<THREE.Group>(null!);
  useFrame((_, delta) => {
    if (ref.current) ref.current.rotation.y += delta * 0.06;
  });
  return (
    <group ref={ref} rotation={[0.42, 0, 0.08]}>
      <InnerSphere />
      <DottedSphere />
      <CityMarkers />
      <DataArcs />
      <Atmosphere />
    </group>
  );
}

// ── Szene ────────────────────────────────────────────────────────────

export default function GovernanceGlobe() {
  return (
    <Canvas
      camera={{ position: [0, 0.1, 3.05], fov: 38 }}
      gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
      dpr={[1, 1.8]}
      style={{ width: '100%', height: '100%', background: 'transparent' }}
    >
      <ambientLight intensity={0.35} />
      <pointLight position={[-3, 2.5, 3]} intensity={2.1} color="#5fe5d1" />
      <pointLight position={[3, -1.5, 2]} intensity={1.1} color="#1a6fff" />
      <BackgroundStars />
      <GlobeGroup />
    </Canvas>
  );
}
