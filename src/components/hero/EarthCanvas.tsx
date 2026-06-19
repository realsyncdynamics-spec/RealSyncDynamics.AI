/**
 * EarthCanvas — fotorealistische, dynamische 3D-Erde (Three.js / R3F).
 *
 * Hero-Centerpiece „Governance Command Center im Weltall": Europa im Fokus &
 * Tageslicht, Stadtlichter auf der Nachtseite, Wolkenebene, Atmosphäre,
 * Sonnenflare, Sternenfeld, ferne Galaxie, Hintergrund-Planeten (inkl. Saturn),
 * Mond, Orbit-Linien und dezente Netzwerk-Nodes.
 *
 * Texturen: gemeinfreie NASA-Blue-Marble-Maps unter `public/textures/earth/`.
 * Fehlen sie, wirft der Loader → die umschließende ErrorBoundary
 * (DynamicEarthScene) zeigt einen prozeduralen Premium-Fallback. Keine
 * runtime-CDN-Links, keine kaputte weiße Kugel.
 *
 * Default-Export → code-split via React.lazy (nur auf fähigen Viewports und
 * bei erlaubter Motion gemountet). DPR begrenzt, Geometrie moderat.
 */
import { Canvas, useFrame, useLoader, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { getSunDirection } from '../../lib/solarLighting';

const TEX = {
  day: '/textures/earth/earth-day.jpg',
  night: '/textures/earth/earth-night.png',
  clouds: '/textures/earth/earth-clouds.png',
  normal: '/textures/earth/earth-normal.jpg',
  specular: '/textures/earth/earth-specular.jpg',
};

// ── LIVE-Sonne: echter Tag/Nacht-Terminator aus der realen Uhrzeit ───
// Die Sonnenrichtung wird live aus der aktuellen Zeit berechnet (solarLighting,
// Default Deutschland) und driftet beschleunigt weiter (TIME_SCALE) → sichtbar
// „lebende" Erde mit wanderndem Terminator. frontBias hält Mitteleuropa auch
// abends/morgens lesbar im Streiflicht.
const BASE_TIME = Date.now();
const TIME_SCALE = 220; // 1 s Echtzeit ≈ 3,7 min Sonnenlauf — ruhige Live-Drift
const FRONT_BIAS = 0.34;

function computeSun(elapsed: number): { x: number; y: number; z: number } {
  const d = new Date(BASE_TIME + elapsed * 1000 * TIME_SCALE);
  return getSunDirection({ date: d, frontBias: FRONT_BIAS });
}

// Gemeinsam genutzte, pro Frame aktualisierte Sonnenrichtung (Weltkoordinaten).
const LIVE_SUN = (() => {
  const s = computeSun(0);
  return new THREE.Vector3(s.x, s.y, s.z).normalize();
})();

// Europa (≈12°E) frontal zur Kamera. Aus der three.js-Kugel-UV-Projektion:
// ein Punkt bei Längengrad L liegt bei θ=(L+180)°; er zeigt zur Kamera (+Z),
// wenn rotation.y = π/2 − θ. Für L≈12°E ⇒ ≈ −1.78 rad.
const EUROPE_ROT_Y = -1.78;
const EARTH_TILT = 0.44; // Nordhalbkugel (Europa) zur Bildmitte
const SPIN = 0.006; // sehr langsam (Europa bleibt im Fokus)

/** Aktualisiert LIVE_SUN pro Frame (eine Quelle für alle Layer). */
function SunController() {
  useFrame((state) => {
    const s = computeSun(state.clock.elapsedTime);
    LIVE_SUN.set(s.x, s.y, s.z).normalize();
  });
  return null;
}

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

function makeRadialTexture(inner: string, mid: string): THREE.CanvasTexture {
  const size = 128;
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d')!;
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, inner);
  g.addColorStop(0.35, mid);
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  const t = new THREE.CanvasTexture(c);
  t.needsUpdate = true;
  return t;
}

function makeGalaxyTexture(): THREE.CanvasTexture {
  const size = 256;
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d')!;
  ctx.translate(size / 2, size / 2);
  // weicher Kern
  const g = ctx.createRadialGradient(0, 0, 0, 0, 0, size / 2);
  g.addColorStop(0, 'rgba(220,230,255,0.9)');
  g.addColorStop(0.2, 'rgba(150,180,255,0.45)');
  g.addColorStop(0.6, 'rgba(90,120,200,0.18)');
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(0, 0, size / 2, 0, Math.PI * 2);
  ctx.fill();
  // Spiralarme
  ctx.globalCompositeOperation = 'lighter';
  for (let a = 0; a < 2; a++) {
    ctx.save();
    ctx.rotate(a * Math.PI);
    ctx.beginPath();
    for (let i = 0; i < 220; i++) {
      const t = i / 220;
      const ang = t * Math.PI * 2.2;
      const rad = t * (size / 2 - 8);
      const x = Math.cos(ang) * rad;
      const y = Math.sin(ang) * rad * 0.55;
      ctx.fillStyle = `rgba(${180 + Math.random() * 60},${200 + Math.random() * 40},255,${0.5 * (1 - t)})`;
      ctx.fillRect(x, y, 1.4, 1.4);
    }
    ctx.restore();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.needsUpdate = true;
  return tex;
}

// ── Erde (Tag/Nacht-Shader) ──────────────────────────────────────────

function Earth() {
  const [dayMap, nightMap, normalMap, specMap] = useLoader(THREE.TextureLoader, [TEX.day, TEX.night, TEX.normal, TEX.specular]);
  const ref = useRef<THREE.Mesh>(null!);

  const material = useMemo(() => {
    [dayMap, nightMap].forEach((t) => { t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 16; });
    [normalMap, specMap].forEach((t) => { t.anisotropy = 16; });
    return new THREE.ShaderMaterial({
      uniforms: {
        dayMap: { value: dayMap },
        nightMap: { value: nightMap },
        normalMap: { value: normalMap },
        specMap: { value: specMap },
        sunDir: { value: LIVE_SUN.clone() },
        cameraPos: { value: new THREE.Vector3() },
        atmoColor: { value: new THREE.Color('#2f7bd6') },
        bumpScale: { value: 0.85 },
      },
      vertexShader: /* glsl */ `
        varying vec2 vUv;
        varying vec3 vWorldNormal;
        varying vec3 vWorldPos;
        void main() {
          vUv = uv;
          vWorldNormal = normalize(mat3(modelMatrix) * normal);
          vec4 wp = modelMatrix * vec4(position, 1.0);
          vWorldPos = wp.xyz;
          gl_Position = projectionMatrix * viewMatrix * wp;
        }
      `,
      fragmentShader: /* glsl */ `
        uniform sampler2D dayMap;
        uniform sampler2D nightMap;
        uniform sampler2D normalMap;
        uniform sampler2D specMap;
        uniform vec3 sunDir;
        uniform vec3 cameraPos;
        uniform vec3 atmoColor;
        uniform float bumpScale;
        varying vec2 vUv;
        varying vec3 vWorldNormal;
        varying vec3 vWorldPos;

        // Tangentenraum ohne vorberechnete Tangenten (Schüler / derivative-based).
        mat3 cotangentFrame(vec3 N, vec3 p, vec2 uv) {
          vec3 dp1 = dFdx(p);
          vec3 dp2 = dFdy(p);
          vec2 duv1 = dFdx(uv);
          vec2 duv2 = dFdy(uv);
          vec3 dp2perp = cross(dp2, N);
          vec3 dp1perp = cross(N, dp1);
          vec3 T = dp2perp * duv1.x + dp1perp * duv2.x;
          vec3 B = dp2perp * duv1.y + dp1perp * duv2.y;
          float invmax = inversesqrt(max(dot(T, T), dot(B, B)));
          return mat3(T * invmax, B * invmax, N);
        }

        void main() {
          vec3 N = normalize(vWorldNormal);
          vec3 V = normalize(cameraPos - vWorldPos);

          // Relief: Normal-Map per Tangentenraum einrechnen → Terrain-Tiefe (3D)
          vec3 mapN = texture2D(normalMap, vUv).xyz * 2.0 - 1.0;
          mapN.xy *= bumpScale;
          vec3 Np = normalize(cotangentFrame(N, -vWorldPos, vUv) * mapN);

          vec3 L = normalize(sunDir);
          float d = dot(Np, L);
          float day = smoothstep(-0.12, 0.30, d);

          vec3 dayC = texture2D(dayMap, vUv).rgb * 0.98;
          vec3 nightC = texture2D(nightMap, vUv).rgb;
          // Stadtlichter heller (warm) für das „Live Earth bei Nacht"-Bild
          nightC = nightC * vec3(2.4, 2.1, 1.5) + vec3(0.012, 0.022, 0.05);

          vec3 col = mix(nightC, dayC, day);

          // Ozean-Glanz (Specular-Glint der Sonne auf Wasserflächen)
          float ocean = texture2D(specMap, vUv).r;
          vec3 R = reflect(-L, Np);
          float spec = pow(max(dot(R, V), 0.0), 22.0);
          col += vec3(0.85, 0.92, 1.0) * spec * ocean * day * 0.7;

          // warmer Terminator-Saum
          float term = smoothstep(0.0, 0.18, d) * (1.0 - smoothstep(0.18, 0.4, d));
          col += vec3(1.0, 0.55, 0.2) * term * 0.12;

          // Atmosphären-Fresnel am Rand (bläulich, sonnenseitig stärker)
          float fres = pow(1.0 - max(dot(N, V), 0.0), 3.0);
          col += atmoColor * fres * (0.25 + 0.5 * day);

          // sanfte Highlight-Kompression gegen Überstrahlung (Wüsten)
          col = col / (col + 0.55) * 1.55;

          gl_FragColor = vec4(col, 1.0);
        }
      `,
    });
  }, [dayMap, nightMap, normalMap, specMap]);

  useFrame((state, delta) => {
    if (!ref.current) return;
    ref.current.rotation.y += delta * SPIN;
    material.uniforms.cameraPos.value.copy(state.camera.position);
    material.uniforms.sunDir.value.copy(LIVE_SUN);
  });

  return (
    <mesh ref={ref} rotation={[0, EUROPE_ROT_Y, 0]} material={material}>
      <sphereGeometry args={[1, 160, 160]} />
    </mesh>
  );
}

// ── Wolkenebene (sonnenseitig, leicht versetzt rotierend) ────────────

function Clouds() {
  const cloudMap = useLoader(THREE.TextureLoader, TEX.clouds);
  const ref = useRef<THREE.Mesh>(null!);

  const material = useMemo(() => {
    return new THREE.ShaderMaterial({
      uniforms: { cloudMap: { value: cloudMap }, sunDir: { value: LIVE_SUN.clone() } },
      transparent: true,
      depthWrite: false,
      vertexShader: /* glsl */ `
        varying vec2 vUv;
        varying vec3 vWorldNormal;
        void main() {
          vUv = uv;
          vWorldNormal = normalize(mat3(modelMatrix) * normal);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: /* glsl */ `
        uniform sampler2D cloudMap;
        uniform vec3 sunDir;
        varying vec2 vUv;
        varying vec3 vWorldNormal;
        void main() {
          float c = texture2D(cloudMap, vUv).r;
          float day = smoothstep(-0.05, 0.35, dot(normalize(vWorldNormal), normalize(sunDir)));
          float alpha = c * (0.08 + 0.5 * day);
          vec3 col = vec3(1.0) * (0.55 + 0.45 * day);
          gl_FragColor = vec4(col, alpha);
        }
      `,
    });
  }, [cloudMap]);

  useFrame((_, delta) => {
    if (ref.current) ref.current.rotation.y += delta * (SPIN * 1.25);
    material.uniforms.sunDir.value.copy(LIVE_SUN);
  });

  return (
    <mesh ref={ref} rotation={[0, EUROPE_ROT_Y, 0]} material={material}>
      <sphereGeometry args={[1.012, 64, 64]} />
    </mesh>
  );
}

// ── Atmosphäre (Fresnel-Halo, BackSide) ──────────────────────────────

function Atmosphere() {
  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms: { glow: { value: new THREE.Color('#3aa0ff') }, sunDir: { value: LIVE_SUN.clone() } },
        side: THREE.BackSide,
        blending: THREE.AdditiveBlending,
        transparent: true,
        depthWrite: false,
        vertexShader: /* glsl */ `
          varying vec3 vNormal; varying vec3 vWorldNormal;
          void main() {
            vNormal = normalize(normalMatrix * normal);
            vWorldNormal = normalize(mat3(modelMatrix) * normal);
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }
        `,
        fragmentShader: /* glsl */ `
          uniform vec3 glow; uniform vec3 sunDir;
          varying vec3 vNormal; varying vec3 vWorldNormal;
          void main() {
            float fres = pow(0.72 - abs(vNormal.z), 2.0);
            float day = smoothstep(-0.3, 0.5, dot(normalize(vWorldNormal), normalize(sunDir)));
            gl_FragColor = vec4(glow, max(fres, 0.0) * (0.25 + 0.75 * day));
          }
        `,
      }),
    [],
  );
  useFrame(() => { material.uniforms.sunDir.value.copy(LIVE_SUN); });
  return (
    <mesh material={material}>
      <sphereGeometry args={[1.16, 48, 48]} />
    </mesh>
  );
}

// ── Sonnenflare (additives Sprite, folgt der Live-Sonne am Limb) ─────

function SunFlare() {
  const tex = useMemo(() => makeRadialTexture('rgba(255,247,224,1)', 'rgba(255,221,150,0.55)'), []);
  const ref = useRef<THREE.Sprite>(null!);
  useFrame(() => {
    if (ref.current) ref.current.position.copy(LIVE_SUN).multiplyScalar(1.16);
  });
  return (
    <sprite ref={ref} scale={[1.2, 1.2, 1.2]}>
      <spriteMaterial map={tex} transparent depthWrite={false} blending={THREE.AdditiveBlending} opacity={0.5} toneMapped={false} />
    </sprite>
  );
}

// ── Satelliten (orbitierende Live-Punkte mit Spur) ───────────────────

function Satellites() {
  const dotTex = useMemo(() => makeRadialTexture('rgba(220,245,255,1)', 'rgba(120,200,255,0.5)'), []);
  const refs = useRef<Array<THREE.Group | null>>([]);
  const sats = useMemo(
    () => [
      { r: 1.42, tilt: 0.9, speed: 0.22, offset: 0.0, color: '#9ad8ff' },
      { r: 1.7, tilt: -0.6, speed: 0.16, offset: 2.1, color: '#7dffe8' },
      { r: 1.34, tilt: 1.5, speed: 0.28, offset: 4.0, color: '#cfe8ff' },
    ],
    [],
  );
  useFrame((state) => {
    const t = state.clock.elapsedTime;
    sats.forEach((s, i) => {
      const g = refs.current[i];
      if (!g) return;
      const a = t * s.speed + s.offset;
      g.position.set(Math.cos(a) * s.r, Math.sin(a) * s.r * 0.35, Math.sin(a) * s.r);
    });
  });
  return (
    <group>
      {sats.map((s, i) => (
        <group key={i} rotation={[s.tilt, i * 1.2, 0]}>
          <group ref={(el) => { refs.current[i] = el; }}>
            <sprite scale={[0.07, 0.07, 0.07]}>
              <spriteMaterial map={dotTex} color={s.color} transparent depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} />
            </sprite>
          </group>
        </group>
      ))}
    </group>
  );
}

// ── Netzwerk-Nodes auf der Vorderseite + Linien zum Europa-Hub ───────

function NetworkLayer() {
  const dotTex = useMemo(() => makeRadialTexture('rgba(125,255,232,1)', 'rgba(45,212,191,0.5)'), []);
  const groupRef = useRef<THREE.Group>(null!);

  const { nodes, lines } = useMemo(() => {
    const hub = latLonToVec3(50, 10, 1.02).applyAxisAngle(new THREE.Vector3(0, 1, 0), EUROPE_ROT_Y);
    const pts = [
      [38, -20], [60, -60], [25, 30], [55, 40], [10, -45], [45, -90], [30, 70], [62, 15],
    ].map(([la, lo]) => latLonToVec3(la, lo, 1.04).applyAxisAngle(new THREE.Vector3(0, 1, 0), EUROPE_ROT_Y));
    const visible = pts.filter((p) => p.z > 0.15);
    const lineObjs = visible.map((p) => {
      const mid = hub.clone().add(p).multiplyScalar(0.5).normalize().multiplyScalar(1.18);
      const curve = new THREE.QuadraticBezierCurve3(hub, mid, p);
      const geo = new THREE.BufferGeometry().setFromPoints(curve.getPoints(24));
      return geo;
    });
    return { nodes: visible, lines: lineObjs };
  }, []);

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    groupRef.current?.children.forEach((c, i) => {
      if ((c as THREE.Sprite).isSprite) c.scale.setScalar(0.06 + Math.sin(t * 1.5 + i) * 0.015);
    });
  });

  return (
    <group>
      {lines.map((geo, i) => (
        <primitive key={`l${i}`} object={new THREE.Line(geo, new THREE.LineBasicMaterial({ color: '#2dd4bf', transparent: true, opacity: 0.28 }))} />
      ))}
      <group ref={groupRef}>
        {nodes.map((p, i) => (
          <sprite key={`n${i}`} position={p} scale={[0.06, 0.06, 0.06]}>
            <spriteMaterial map={dotTex} transparent depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} />
          </sprite>
        ))}
      </group>
    </group>
  );
}

// ── Orbit-Linien ─────────────────────────────────────────────────────

function OrbitRings() {
  const ref = useRef<THREE.Group>(null!);
  const rings = useMemo(() => {
    return [1.55, 1.95, 2.5].map((r, i) => {
      const pts: THREE.Vector3[] = [];
      for (let a = 0; a <= 96; a++) {
        const t = (a / 96) * Math.PI * 2;
        pts.push(new THREE.Vector3(Math.cos(t) * r, 0, Math.sin(t) * r));
      }
      const geo = new THREE.BufferGeometry().setFromPoints(pts);
      return { geo, tilt: 1.1 + i * 0.18, rotZ: i * 0.4, op: 0.18 - i * 0.03 };
    });
  }, []);
  useFrame((_, delta) => { if (ref.current) ref.current.rotation.y += delta * 0.03; });
  return (
    <group ref={ref}>
      {rings.map((r, i) => (
        <primitive
          key={i}
          object={new THREE.LineLoop(r.geo, new THREE.LineBasicMaterial({ color: '#2dd4bf', transparent: true, opacity: r.op }))}
          rotation={[r.tilt, 0, r.rotZ]}
        />
      ))}
    </group>
  );
}

// ── Sternenfeld ──────────────────────────────────────────────────────

function Starfield() {
  const ref = useRef<THREE.Points>(null!);
  const { positions, colors } = useMemo(() => {
    const N = 1400;
    const pos = new Float32Array(N * 3);
    const col = new Float32Array(N * 3);
    const c = new THREE.Color();
    for (let i = 0; i < N; i++) {
      const r = 12 + Math.random() * 28;
      const phi = Math.acos(2 * Math.random() - 1);
      const theta = Math.random() * Math.PI * 2;
      pos[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      pos[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
      pos[i * 3 + 2] = r * Math.cos(phi);
      const b = 0.5 + Math.random() * 0.5;
      c.setRGB(b, b, b * (0.85 + Math.random() * 0.15));
      col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
    }
    return { positions: pos, colors: col };
  }, []);
  useFrame((_, delta) => { if (ref.current) ref.current.rotation.y += delta * 0.004; });
  return (
    <points ref={ref}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
        <bufferAttribute attach="attributes-color" args={[colors, 3]} />
      </bufferGeometry>
      <pointsMaterial size={0.05} vertexColors transparent opacity={0.85} sizeAttenuation depthWrite={false} />
    </points>
  );
}

// ── Galaxie (oben rechts, fern) ──────────────────────────────────────

function Galaxy() {
  const tex = useMemo(() => makeGalaxyTexture(), []);
  return (
    <sprite position={[10, 5.5, -16]} scale={[9, 9, 9]}>
      <spriteMaterial map={tex} transparent depthWrite={false} blending={THREE.AdditiveBlending} opacity={0.55} toneMapped={false} />
    </sprite>
  );
}

// ── Hintergrund-Planeten + Mond ──────────────────────────────────────

function Saturn() {
  const ringGeo = useMemo(() => new THREE.RingGeometry(0.62, 1.05, 64), []);
  return (
    <group position={[-8, 2.2, -15]} rotation={[1.1, 0.3, 0.2]}>
      <mesh>
        <sphereGeometry args={[0.55, 32, 32]} />
        <meshStandardMaterial color="#c8a26a" roughness={0.9} metalness={0.1} emissive="#3a2c12" emissiveIntensity={0.25} />
      </mesh>
      <mesh geometry={ringGeo} rotation={[Math.PI / 2.1, 0, 0]}>
        <meshBasicMaterial color="#d8c089" side={THREE.DoubleSide} transparent opacity={0.55} />
      </mesh>
    </group>
  );
}

function DistantPlanet() {
  return (
    <mesh position={[7, -3.5, -18]}>
      <sphereGeometry args={[0.4, 24, 24]} />
      <meshStandardMaterial color="#5a6a8a" roughness={1} emissive="#10131c" emissiveIntensity={0.3} />
    </mesh>
  );
}

function Moon() {
  return (
    <mesh position={[3.0, -2.1, -1.5]}>
      <sphereGeometry args={[0.17, 32, 32]} />
      <meshStandardMaterial color="#b9bcc4" roughness={1} metalness={0} />
    </mesh>
  );
}

// ── Erd-Gruppe (Tilt) ────────────────────────────────────────────────

function EarthSystem() {
  return (
    <group rotation={[EARTH_TILT, 0, 0.06]}>
      <Earth />
      <Clouds />
      <Atmosphere />
      <NetworkLayer />
    </group>
  );
}

// ── Post-Processing: cinematic Bloom (Stadtlichter/Atmosphäre/Flare) ─

function PostFX() {
  const { gl, scene, camera, size } = useThree();
  const composer = useMemo(() => {
    const c = new EffectComposer(gl);
    c.addPass(new RenderPass(scene, camera));
    // strength, radius, threshold — nur helle Highlights glühen lassen
    c.addPass(new UnrealBloomPass(new THREE.Vector2(size.width, size.height), 0.62, 0.5, 0.82));
    return c;
  }, [gl, scene, camera]); // size via setSize unten
  useEffect(() => {
    composer.setSize(size.width, size.height);
    composer.setPixelRatio(Math.min(typeof window !== 'undefined' ? window.devicePixelRatio : 1, 1.5));
  }, [composer, size]);
  // priority > 0 → R3F überlässt das Rendern dem Composer
  useFrame(() => composer.render(), 1);
  return null;
}

// ── Szene ────────────────────────────────────────────────────────────

export default function EarthCanvas() {
  return (
    <Canvas
      camera={{ position: [0, 0.1, 4.75], fov: 30 }}
      gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
      dpr={[1, 1.5]}
      style={{ width: '100%', height: '100%', background: 'transparent' }}
    >
      <ambientLight intensity={0.25} />
      <directionalLight position={LIVE_SUN.clone().multiplyScalar(5)} intensity={2.2} color="#fff4e0" />
      <directionalLight position={[-4, -2, 2]} intensity={0.4} color="#1a6fff" />

      <SunController />
      <Starfield />
      <Galaxy />
      <Saturn />
      <DistantPlanet />
      <OrbitRings />
      <EarthSystem />
      <Satellites />
      <SunFlare />
      <Moon />
      <PostFX />
    </Canvas>
  );
}
