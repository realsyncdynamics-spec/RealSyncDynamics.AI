/**
 * Hintergrund der Governance-AI-Vorschau — Erde vor der Milchstraße.
 *
 * Die Szene trägt drei Elemente und sonst nichts: die Erde mit Nachtseite zur
 * Kamera (Europa im Stadtlicht), ein Sternenfeld mit echter Tiefe und die ISS,
 * die periodisch vorbeizieht. Planeten, Monde und HUD-Chips, die frühere
 * Fassungen mitführten, sind entfallen — sie waren im gerenderten Bild nicht
 * mehr sichtbar und haben die Szene nur schwerer gemacht.
 *
 * ## Warum eine eigene Szene statt `HeroEarthBackdropScene`
 *
 * Die Szene auf `/` steht unter Design-Lock: Sie rahmt Europa fest (kein
 * Amerika-Drift), fährt eine Gold-Palette und läuft mit `frameloop="demand"`.
 * Diese Vorschau braucht das Gegenteil — Cyan, durchlaufende Bewegung, ISS.
 * Beides in einer Komponente unterzubringen hieße, die Live-Startseite für
 * eine Vorschau umzubauen. Die Texturen teilen sich beide (`earthTextures.ts`,
 * lokal unter `public/textures/`), das ist der Teil, der Gewicht hat.
 *
 * ## Verhalten, wenn etwas fehlt
 *
 * Kein WebGL, kein `matchMedia`, keine Textur: Der Hintergrund fällt auf eine
 * schwarze Fläche mit Cyan-Schimmer zurück. Die Seite bleibt in jedem Fall
 * lesbar — die Szene ist Dekoration, nie Inhalt.
 */
import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { useTexture } from '@react-three/drei';
import * as THREE from 'three';
import {
  detectEarthQuality,
  getEarthTextureSet,
  type EarthTextureSet,
} from '../visual/earthTextures';
import { prefersReducedMotion } from './prefers-reduced-motion';

/** Deterministischer PRNG — die Milchstraße soll bei jedem Aufruf gleich aussehen. */
function seeded(seed: number): () => number {
  let s = seed;
  return () => (s = (s * 16807) % 2147483647) / 2147483647;
}

/**
 * Milchstraße als Equirect-Panorama, prozedural auf ein Canvas gezeichnet.
 *
 * Ein echtes Panoramafoto wäre mehrere Megabyte schwer für eine Fläche, die
 * hinter der Seite zu 90 % abgedeckt ist. Das Band aus Nebelschleiern,
 * Dunkelwolken und verdichteten Sternen liest sich an dieser Größe identisch.
 */
function useMilkyWayTexture(): THREE.Texture | null {
  return useMemo(() => {
    if (typeof document === 'undefined') return null;
    const canvas = document.createElement('canvas');
    canvas.width = 4096;
    canvas.height = 2048;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, 4096, 2048);
    const rand = seeded(97);

    // Band, leicht gekippt: erst Nebel, dann Dunkelwolken, dann Sterne.
    ctx.save();
    ctx.translate(2048, 1024);
    ctx.rotate(-0.28);

    for (let i = 0; i < 1400; i++) {
      const x = (rand() - 0.5) * 5200;
      const y = (rand() - 0.5) * 2 * (90 + 120 * rand() ** 2.2);
      const r = 40 + rand() * 160;
      const grad = ctx.createRadialGradient(x, y, 0, x, y, r);
      const warm = rand() < 0.55;
      grad.addColorStop(
        0,
        warm
          ? `rgba(210,190,170,${0.025 + rand() * 0.04})`
          : `rgba(150,170,220,${0.02 + rand() * 0.035})`,
      );
      grad.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = grad;
      ctx.fillRect(x - r, y - r, r * 2, r * 2);
    }

    for (let i = 0; i < 260; i++) {
      const x = (rand() - 0.5) * 5200;
      const y = (rand() - 0.5) * 160;
      const r = 30 + rand() * 110;
      const grad = ctx.createRadialGradient(x, y, 0, x, y, r);
      grad.addColorStop(0, `rgba(0,0,0,${0.25 + rand() * 0.35})`);
      grad.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = grad;
      ctx.fillRect(x - r, y - r, r * 2, r * 2);
    }

    for (let i = 0; i < 26000; i++) {
      const x = (rand() - 0.5) * 5200;
      const y = (rand() - 0.5) * 2 * (60 + 260 * rand() ** 1.6);
      const r = rand() < 0.02 ? 1.4 + rand() * 1.2 : 0.3 + rand() * 0.8;
      const alpha = 0.35 + rand() * 0.65;
      ctx.fillStyle =
        rand() < 0.15 ? `rgba(255,225,190,${alpha})` : `rgba(235,240,255,${alpha})`;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();

    // Streusterne über die ganze Kugel, damit das Band nicht freisteht.
    for (let i = 0; i < 9000; i++) {
      const x = rand() * 4096;
      const y = rand() * 2048;
      const r = rand() < 0.03 ? 1.4 + rand() * 1.4 : 0.3 + rand() * 0.9;
      const alpha = 0.3 + rand() * 0.7;
      const roll = rand();
      ctx.fillStyle =
        roll < 0.2
          ? `rgba(255,225,190,${alpha})`
          : roll < 0.3
            ? `rgba(190,205,255,${alpha})`
            : `rgba(240,244,255,${alpha})`;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.mapping = THREE.EquirectangularReflectionMapping;
    return texture;
  }, []);
}

function MilkyWay({ animate }: { animate: boolean }) {
  const scene = useThree((state) => state.scene);
  const texture = useMilkyWayTexture();

  useEffect(() => {
    if (!texture) return;
    scene.background = texture;
    scene.backgroundIntensity = 0.28;
    scene.backgroundRotation = new THREE.Euler(0.35, 0, 0.2);
    return () => {
      scene.background = null;
      texture.dispose();
    };
  }, [scene, texture]);

  useFrame(() => {
    if (!animate || !scene.backgroundRotation) return;
    scene.backgroundRotation.y += 0.00004;
  });

  return null;
}

const STAR_COUNT = 1800;

/**
 * Sternenfeld mit echter Tiefe: Die Punkte fliegen auf die Kamera zu und
 * werden hinter ihr wieder nach hinten gesetzt. Das ist die einzige Bewegung,
 * die dem Hintergrund Raum gibt — die Erde selbst dreht sich fast unmerklich.
 */
function Starfield({ animate }: { animate: boolean }) {
  const points = useRef<THREE.Points>(null);

  const geometry = useMemo(() => {
    const positions = new Float32Array(STAR_COUNT * 3);
    const colors = new Float32Array(STAR_COUNT * 3);
    const sizes = new Float32Array(STAR_COUNT);
    const rand = seeded(1337);

    for (let i = 0; i < STAR_COUNT; i++) {
      positions[i * 3] = (rand() - 0.5) * 160;
      positions[i * 3 + 1] = (rand() - 0.5) * 100;
      positions[i * 3 + 2] = -rand() * 200;

      const roll = rand();
      const colour =
        roll < 0.2 ? [1, 0.85, 0.7] : roll < 0.5 ? [0.75, 0.85, 1] : [0.95, 0.96, 1];
      colors.set(colour, i * 3);
      sizes[i] = rand() < 0.04 ? 2.4 + rand() * 1.6 : 0.5 + rand() * 1.2;
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geo.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));
    return geo;
  }, []);

  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        vertexColors: true,
        uniforms: { uTime: { value: 0 }, uPixelRatio: { value: 1 } },
        vertexShader: `
          attribute float aSize;
          varying vec3 vColor;
          varying float vTwinkle;
          uniform float uTime;
          uniform float uPixelRatio;
          void main() {
            vColor = color;
            vec4 mv = modelViewMatrix * vec4(position, 1.0);
            vTwinkle = 0.55 + 0.45 * sin(uTime * 1.7 + position.x * 3.1 + position.y * 2.3);
            gl_PointSize = aSize * uPixelRatio * (140.0 / -mv.z);
            gl_Position = projectionMatrix * mv;
          }
        `,
        fragmentShader: `
          varying vec3 vColor;
          varying float vTwinkle;
          void main() {
            float d = length(gl_PointCoord - 0.5);
            float a = smoothstep(0.5, 0.0, d);
            gl_FragColor = vec4(vColor, a * vTwinkle * 0.45);
          }
        `,
      }),
    [],
  );

  useEffect(() => () => {
    geometry.dispose();
    material.dispose();
  }, [geometry, material]);

  useFrame((state, delta) => {
    const mesh = points.current;
    if (!mesh) return;
    material.uniforms.uPixelRatio.value = state.gl.getPixelRatio();
    if (!animate) return;

    material.uniforms.uTime.value = state.clock.elapsedTime;
    mesh.rotation.z += delta * 0.006;

    const array = geometry.attributes.position.array as Float32Array;
    for (let i = 2; i < array.length; i += 3) {
      array[i] += delta * 2;
      if (array[i] > 8) array[i] -= 200;
    }
    geometry.attributes.position.needsUpdate = true;
  });

  return <points ref={points} geometry={geometry} material={material} />;
}

/**
 * Atmosphäre als reine Rückseiten-Streuung.
 *
 * Ein Fresnel-Rand auf der Vorderseite brannte im Sonnenlicht zu einem weißen
 * Halbring aus. Nur die Rückseite zu rendern lässt den Rand dort leuchten, wo
 * die Sonne steht, und sonst nirgends.
 */
function atmosphereMaterial(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    transparent: true,
    side: THREE.BackSide,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    uniforms: { uSun: { value: new THREE.Vector3(-1, 0.55, 0.6).normalize() } },
    vertexShader: `
      varying vec3 vNormalView;
      varying vec3 vNormalWorld;
      void main() {
        vNormalView = normalize(normalMatrix * normal);
        vNormalWorld = normalize((modelMatrix * vec4(normal, 0.0)).xyz);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      varying vec3 vNormalView;
      varying vec3 vNormalWorld;
      uniform vec3 uSun;
      void main() {
        float facing = dot(vNormalView, vec3(0.0, 0.0, 1.0));
        float rim = pow(max(0.0, 0.7 - facing), 2.6);
        float lit = clamp(dot(vNormalWorld, uSun) * 0.5 + 0.5, 0.0, 1.0);
        vec3 tint = mix(vec3(0.03, 0.15, 0.30), vec3(0.30, 0.75, 0.95), lit);
        gl_FragColor = vec4(tint, 1.0) * rim * 1.2 * (0.3 + 0.7 * lit);
      }
    `,
  });
}

/**
 * Europa zur Kamera.
 *
 * Der Wert gehört zu den Texturen aus `public/textures/`: Bei `rotY = 0` liegt
 * Längengrad 0 nahe −X, die Amerikas zeigen also zur Kamera. −1.72 dreht
 * Mitteleuropa nach vorn. `HeroEarthBackdropScene` rechnet mit derselben
 * Grundlage (dort −1.58 für die Sichel statt frontal).
 *
 * Die Erde dreht sich deshalb **nicht** frei weiter, sondern wiegt nur um
 * diesen Wert. Eine frei laufende Drehung war der Grund, warum die Szene auf
 * `/` abgeschaltet wurde: Nach einer Minute stand Amerika im Bild und die
 * Seite behauptete „EU-native" vor der falschen Halbkugel.
 */
const EUROPE_FACING_Y = -1.72;

/** Amplitude des Wiegens um die Europa-Achse (Radiant). */
const EUROPE_SWAY = 0.03;

/**
 * Wo die Erde steht — eine Rechnung für Kugel und ISS.
 *
 * Die Kugel sitzt rechts und ragt bewusst über den Rand hinaus: Sie ist
 * Horizont, kein Objekt in der Mitte. Links bleibt der Raum frei, den die
 * Textspalte braucht. Auf hochformatigen Viewports rückt sie weiter nach
 * außen und wird kleiner, sonst liegt sie unter der Headline.
 *
 * Die ISS zieht ihre Bahn um dieselben Werte — stünden sie zweimal im Code,
 * liefe die Station beim nächsten Tuning neben der Erde her.
 */
function placeEarth(viewportWidth: number, aspect: number) {
  const portrait = aspect < 1.05;
  const scale = Math.min(4.2, viewportWidth * (portrait ? 0.24 : 0.3));
  return {
    scale,
    x: viewportWidth * 0.5 - scale * (portrait ? 0.25 : 0.55),
    y: -0.55 - scale * 0.12,
  };
}

/**
 * @param set Texturstufe. Der Aufrufer stellt sicher, dass Nacht-, Wolken- und
 *   Specular-Karte gesetzt sind — auf der `low`-Stufe, wo sie fehlen, läuft die
 *   Seite gar nicht erst mit WebGL.
 */
function Earth({ animate, set }: { animate: boolean; set: EarthTextureSet }) {
  const group = useRef<THREE.Group>(null);
  const surface = useRef<THREE.Mesh>(null);
  const clouds = useRef<THREE.Mesh>(null);
  const sun = useRef<THREE.DirectionalLight>(null);
  const viewport = useThree((state) => state.viewport);

  const maps = useTexture({
    map: set.day,
    emissiveMap: set.night ?? set.day,
    specularMap: set.specular ?? set.day,
  });
  const cloudMap = useTexture(set.clouds ?? set.day);

  const atmosphere = useMemo(atmosphereMaterial, []);
  useEffect(() => () => atmosphere.dispose(), [atmosphere]);

  useEffect(() => {
    maps.map.colorSpace = THREE.SRGBColorSpace;
    maps.emissiveMap.colorSpace = THREE.SRGBColorSpace;
    cloudMap.colorSpace = THREE.SRGBColorSpace;
  }, [maps, cloudMap]);

  const { scale, x: offsetX, y: offsetY } = placeEarth(viewport.width, viewport.aspect);

  useFrame((state, delta) => {
    if (!animate) return;
    const t = state.clock.elapsedTime;

    // Europa bleibt stehen — nur ein leichtes Wiegen, damit die Kugel lebt.
    if (surface.current) {
      surface.current.rotation.y = EUROPE_FACING_Y + Math.sin(t * 0.11) * EUROPE_SWAY;
    }
    // Die Wolken dürfen ziehen: Sie tragen keine Geografie.
    if (clouds.current) clouds.current.rotation.y += delta * 0.006;

    if (group.current) {
      group.current.rotation.x = 0.55 + Math.sin(t / 9) * 0.02;
      group.current.position.y = offsetY + Math.sin(t / 7) * 0.05;
    }

    // Die Sonne wandert hinter der Erde entlang: Europa bleibt bei Nacht, der
    // Terminator glüht oben links.
    if (sun.current) {
      const orbit = t * 0.05;
      sun.current.position.set(
        -6 + Math.cos(orbit) * 2,
        4 + Math.sin(orbit * 0.6) * 1.2,
        -7 + Math.sin(orbit) * 1.5,
      );
      atmosphere.uniforms.uSun.value.copy(sun.current.position).normalize();
    }
  });

  return (
    <>
      <ambientLight color={0x2a3a55} intensity={0.16} />
      <directionalLight ref={sun} color={0xfff4e6} intensity={2.6} position={[-8, 4.5, 5]} />
      <directionalLight color={0x2f6f9a} intensity={0.35} position={[5, 2, 8]} />

      <group
        ref={group}
        position={[offsetX, offsetY, 0]}
        rotation={[0.55, 0, -0.05]}
        scale={scale}
      >
        <mesh ref={surface} rotation={[0, EUROPE_FACING_Y, 0]}>
          <sphereGeometry args={[1, set.segments[0], set.segments[1]]} />
          <meshPhongMaterial
            map={maps.map}
            specularMap={maps.specularMap}
            specular={new THREE.Color(0x333333)}
            shininess={18}
            emissiveMap={maps.emissiveMap}
            emissive={new THREE.Color(0xffd9a0)}
            emissiveIntensity={1.9}
          />
        </mesh>

        <mesh ref={clouds} rotation={[0, EUROPE_FACING_Y, 0]}>
          <sphereGeometry args={[1.008, 96, 96]} />
          <meshLambertMaterial map={cloudMap} transparent opacity={0.35} depthWrite={false} />
        </mesh>

        <mesh material={atmosphere}>
          <sphereGeometry args={[1.035, 96, 96]} />
        </mesh>
      </group>
    </>
  );
}

/** Überflug alle 42 s, davon 16 s im Bild. */
const ISS_PERIOD = 42;
const ISS_VISIBLE = 16;

/**
 * ISS aus Primitiven: Träger, Module, acht Solarpaneele, Radiatoren.
 *
 * Ein geladenes Modell wäre für eine Silhouette, die 16 Sekunden lang wenige
 * Dutzend Pixel groß ist, nicht zu rechtfertigen.
 */
function Iss({ animate }: { animate: boolean }) {
  const group = useRef<THREE.Group>(null);
  const viewport = useThree((state) => state.viewport);

  const { scale: earthScale, x: earthX, y: earthY } = placeEarth(
    viewport.width,
    viewport.aspect,
  );

  useFrame((state) => {
    const mesh = group.current;
    if (!mesh) return;
    if (!animate) {
      mesh.visible = false;
      return;
    }

    const t = state.clock.elapsedTime;
    const phase = t % ISS_PERIOD;
    if (phase >= ISS_VISIBLE) {
      mesh.visible = false;
      return;
    }

    const progress = phase / ISS_VISIBLE;
    const orbit = -0.55 + progress * 1.9;
    mesh.visible = true;
    mesh.position.set(
      earthX + Math.cos(orbit) * earthScale * 1.12 - earthScale * 0.15,
      earthY + Math.sin(orbit) * earthScale * 0.62 - 0.1,
      earthScale * 1.05,
    );
    mesh.rotation.set(0.35, orbit * 0.5 + t * 0.15, 0.2);
    mesh.scale.setScalar(0.09 + Math.sin(progress * Math.PI) * 0.05);
  });

  const panels = useMemo(() => {
    const out: Array<[number, number]> = [];
    for (const x of [-1.05, -0.62, 0.62, 1.05]) for (const y of [0.32, -0.32]) out.push([x, y]);
    return out;
  }, []);

  return (
    <group ref={group} visible={false}>
      <mesh>
        <boxGeometry args={[2.4, 0.06, 0.06]} />
        <meshStandardMaterial color={0xd8dde3} metalness={0.7} roughness={0.35} />
      </mesh>

      {panels.map(([x, y]) => (
        <mesh key={`${x}:${y}`} position={[x, y, 0]}>
          <boxGeometry args={[0.34, 0.5, 0.008]} />
          <meshStandardMaterial
            color={0x1a2a4a}
            metalness={0.6}
            roughness={0.25}
            emissive={0x0a1630}
            emissiveIntensity={0.4}
          />
        </mesh>
      ))}

      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.06, 0.06, 0.9, 16]} />
        <meshStandardMaterial color={0xd8dde3} metalness={0.7} roughness={0.35} />
      </mesh>

      <mesh rotation={[0, 0, Math.PI / 2]} position={[0, 0, 0.25]}>
        <cylinderGeometry args={[0.07, 0.07, 0.3, 16]} />
        <meshStandardMaterial color={0xc9a24a} metalness={0.8} roughness={0.3} />
      </mesh>

      <mesh rotation={[0, 0, Math.PI / 2]} position={[0.28, 0, 0.42]}>
        <cylinderGeometry args={[0.055, 0.055, 0.5, 16]} />
        <meshStandardMaterial color={0xd8dde3} metalness={0.7} roughness={0.35} />
      </mesh>

      {[-0.3, 0.3].map((x) => (
        <mesh key={x} position={[x, -0.35, -0.08]} rotation={[0, 0.4, 0]}>
          <boxGeometry args={[0.06, 0.6, 0.008]} />
          <meshStandardMaterial color={0xeeeeee} metalness={0.2} roughness={0.6} />
        </mesh>
      ))}
    </group>
  );
}

function Scene({ animate, set }: { animate: boolean; set: EarthTextureSet }) {
  return (
    <>
      <MilkyWay animate={animate} />
      <Starfield animate={animate} />
      <Suspense fallback={null}>
        <Earth animate={animate} set={set} />
      </Suspense>
      <Iss animate={animate} />
    </>
  );
}

function hasWebGl(): boolean {
  if (typeof document === 'undefined') return false;
  try {
    const canvas = document.createElement('canvas');
    return Boolean(canvas.getContext('webgl2') ?? canvas.getContext('webgl'));
  } catch {
    return false;
  }
}

/**
 * Die Szene wird erst nach dem Leerlauf montiert.
 *
 * Sonst konkurriert das Kompilieren der Shader mit dem ersten Klick auf den
 * Audit-CTA — im Playwright-Lauf ist das der Unterschied zwischen einem
 * sofort greifenden Button und einem Timeout.
 */
function useIdleMount(): boolean {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const idle = window.requestIdleCallback;
    if (typeof idle === 'function') {
      const handle = idle(() => setReady(true), { timeout: 1200 });
      return () => window.cancelIdleCallback?.(handle);
    }
    const timer = window.setTimeout(() => setReady(true), 200);
    return () => window.clearTimeout(timer);
  }, []);
  return ready;
}

export function GovernanceAiBackdrop() {
  const mounted = useIdleMount();
  const [webgl, setWebgl] = useState(false);
  const [reduced, setReduced] = useState(false);
  const [set, setSet] = useState<EarthTextureSet | null>(null);

  useEffect(() => {
    setReduced(prefersReducedMotion());
    setWebgl(hasWebGl());

    // Bewusst **ohne** `reducedMotion`: Die Präferenz sagt „nicht animieren",
    // nicht „nichts zeigen". Wer sie gesetzt hat, bekommt dieselbe Erde — nur
    // stillstehend (`frameloop="demand"`). Die Stufe richtet sich allein nach
    // dem Gerät.
    //
    // Auf der `low`-Stufe — Sparmodus, 2G, schwaches Mobilgerät — bleibt es bei
    // der Grundfläche. Eine WebGL-Szene ohne Nachtlichter und Wolken sähe dort
    // nicht nach dieser Seite aus und kostete trotzdem Akku und Bandbreite.
    const quality = detectEarthQuality();
    setSet(quality === 'low' ? null : getEarthTextureSet(quality));
  }, []);

  return (
    <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden bg-black" aria-hidden="true">
      {/* Grundfläche: trägt den Blick auch, bevor die Szene steht oder wenn
          sie gar nicht kommt. */}
      <div
        className="absolute inset-0"
        style={{
          background:
            'radial-gradient(70% 60% at 68% 52%, rgba(11,17,25,1) 0%, rgba(4,7,10,1) 55%, #000 100%)',
        }}
      />

      {mounted && webgl && set && (
        <Canvas
          className="absolute inset-0"
          camera={{ fov: 38, position: [0, 0, 9], near: 0.1, far: 400 }}
          dpr={[1, 1.75]}
          frameloop={reduced ? 'demand' : 'always'}
          gl={{ antialias: true, alpha: true }}
          onCreated={({ gl }) => {
            gl.toneMapping = THREE.ACESFilmicToneMapping;
            gl.toneMappingExposure = 1.05;
            gl.outputColorSpace = THREE.SRGBColorSpace;
          }}
        >
          <Scene animate={!reduced} set={set} />
        </Canvas>
      )}

      {/* Scrim: hält den Text links lesbar, ohne die Szene global abzudunkeln. */}
      <div
        className="absolute inset-0"
        style={{
          background:
            'linear-gradient(100deg, rgba(0,0,0,.72) 0%, rgba(0,0,0,.55) 40%, rgba(0,0,0,.2) 62%, transparent 78%)',
        }}
      />
    </div>
  );
}
