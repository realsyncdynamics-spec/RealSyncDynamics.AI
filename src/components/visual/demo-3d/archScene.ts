/**
 * RealSyncDynamics.AI – 3D-Landingpage-Demo
 * Framework-unabhängige Three.js-Szene (fiktives Architekturbüro).
 * Wird vom React-Wrapper lazy geladen. Alle Ressourcen werden in dispose() freigegeben.
 */
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';

export type LightMood = 'tag' | 'abend' | 'nacht';
export type BackgroundStyle = 'tiefblau' | 'anthrazit' | 'hell';
import { detectQuality, type QualityTier } from './capabilities';
export type { QualityTier };

export interface SceneConfig {
  primaryColor: string; // Hex, z. B. #22d3ee
  lightMood: LightMood;
  rotationSpeed: number; // 0 … 2
  background: BackgroundStyle;
}

export interface HotspotDef {
  id: string;
  label: string;
  position: [number, number, number];
}

export interface ProjectedHotspot {
  id: string;
  x: number; // px innerhalb des Containers
  y: number;
  visible: boolean;
}

export interface SceneHandle {
  setConfig(cfg: Partial<SceneConfig>): void;
  setScrollProgress(p: number): void;
  setReducedMotion(r: boolean): void;
  focusHotspot(id: string | null): void;
  /** Modell um einen Winkel (Radiant) weiterdrehen – für Tastatur-/Button-Bedienung. */
  rotateBy(rad: number): void;
  getQuality(): QualityTier;
  dispose(): void;
}

export interface CreateOptions {
  container: HTMLElement;
  config: SceneConfig;
  hotspots: HotspotDef[];
  reducedMotion: boolean;
  quality?: QualityTier;
  /** Qualitätsstufe fest vorgeben (z. B. für Bildschirmaufnahmen); schaltet die automatische Reduktion ab. */
  lockQuality?: boolean;
  onHotspots?: (list: ProjectedHotspot[]) => void;
  onQualityChange?: (q: QualityTier) => void;
}

const BG: Record<BackgroundStyle, { top: number; horizon: number; floor: number; ring: number; light: boolean }> = {
  tiefblau: { top: 0x030712, horizon: 0x10264a, floor: 0x081226, ring: 0x2b5a8f, light: false },
  anthrazit: { top: 0x0b0c0f, horizon: 0x2a2e36, floor: 0x16181c, ring: 0x4a515c, light: false },
  hell: { top: 0xcfdcea, horizon: 0xf4f7fa, floor: 0xdde4ec, ring: 0xaab7c6, light: true },
};

const MOOD: Record<
  LightMood,
  { key: number; keyI: number; hemiSky: number; hemiGround: number; hemiI: number; accentI: number; exposure: number; warm: number; tint: number; tintW: number }
> = {
  tag: { key: 0xffffff, keyI: 2.6, hemiSky: 0xcfe8ff, hemiGround: 0x223344, hemiI: 0.9, accentI: 0.5, exposure: 1.05, warm: 0.35, tint: 0x3a6ea8, tintW: 0.22 },
  abend: { key: 0xffb47a, keyI: 1.9, hemiSky: 0x7a5c8f, hemiGround: 0x1a1020, hemiI: 0.5, accentI: 1.2, exposure: 1.0, warm: 1.5, tint: 0x4a3358, tintW: 0.16 },
  nacht: { key: 0x8fb4ff, keyI: 0.6, hemiSky: 0x1b2a4a, hemiGround: 0x05070d, hemiI: 0.3, accentI: 2.6, exposure: 1.15, warm: 2.6, tint: 0x000000, tintW: 0 },
};

/** Kamerapfad: Scroll-Fortschritt 0…1 → Position + Blickpunkt */
const CAM_KEYS: { p: number; pos: [number, number, number]; look: [number, number, number] }[] = [
  { p: 0.0, pos: [6.2, 3.4, 7.4], look: [0, 1.7, 0] },
  { p: 0.33, pos: [4.1, 2.7, 5.6], look: [0.4, 1.8, 0] },
  { p: 0.66, pos: [-5.8, 6.6, 5.0], look: [-0.2, 2.6, 0] },
  { p: 1.0, pos: [-6.5, 2.0, -5.2], look: [0, 1.4, 0] },
];

const smooth = (t: number) => t * t * (3 - 2 * t);

/** Deterministischer Pseudozufall (mulberry32) – nur für die dekorative Partikelverteilung. */
function seeded(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function sampleCam(p: number, outPos: THREE.Vector3, outLook: THREE.Vector3) {
  const k = CAM_KEYS;
  let i = 0;
  while (i < k.length - 2 && p > k[i + 1].p) i++;
  const a = k[i];
  const b = k[i + 1];
  const t = smooth(THREE.MathUtils.clamp((p - a.p) / (b.p - a.p), 0, 1));
  outPos.set(
    THREE.MathUtils.lerp(a.pos[0], b.pos[0], t),
    THREE.MathUtils.lerp(a.pos[1], b.pos[1], t),
    THREE.MathUtils.lerp(a.pos[2], b.pos[2], t),
  );
  outLook.set(
    THREE.MathUtils.lerp(a.look[0], b.look[0], t),
    THREE.MathUtils.lerp(a.look[1], b.look[1], t),
    THREE.MathUtils.lerp(a.look[2], b.look[2], t),
  );
}

export function createArchScene(opts: CreateOptions): SceneHandle {
  const { container } = opts;
  let quality: QualityTier = opts.quality ?? detectQuality();
  let reduced = opts.reducedMotion;
  const cfg: SceneConfig = { ...opts.config };

  const renderer = new THREE.WebGLRenderer({
    antialias: quality !== 'low',
    alpha: false,
    powerPreference: 'high-performance',
  });
  const dprCap = () => (quality === 'high' ? 2 : quality === 'medium' ? 1.5 : 1);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, dprCap()));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.shadowMap.enabled = quality === 'high';
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.domElement.setAttribute('aria-hidden', 'true');
  renderer.domElement.style.display = 'block';
  renderer.domElement.style.width = '100%';
  renderer.domElement.style.height = '100%';
  container.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 80);

  // Umgebung für Reflexionen (prozedural, kein Asset-Download)
  const pmrem = new THREE.PMREMGenerator(renderer);
  const roomEnv = new RoomEnvironment();
  const envTex = pmrem.fromScene(roomEnv, 0.04).texture;
  scene.environment = envTex;
  scene.environmentIntensity = 0.7;

  // Licht
  const hemi = new THREE.HemisphereLight(0xffffff, 0x222222, 1);
  const key = new THREE.DirectionalLight(0xffffff, 2);
  key.position.set(5, 9, 4);
  key.castShadow = quality === 'high';
  key.shadow.mapSize.set(1024, 1024);
  key.shadow.camera.left = -6;
  key.shadow.camera.right = 6;
  key.shadow.camera.top = 6;
  key.shadow.camera.bottom = -6;
  key.shadow.bias = -0.0005;
  const accent = new THREE.PointLight(0x22d3ee, 1, 12, 1.6);
  accent.position.set(0, 1.2, 1.6);
  scene.add(hemi, key, accent);

  // Disposables sammeln
  const geos: THREE.BufferGeometry[] = [];
  const mats: THREE.Material[] = [];
  const g = <T extends THREE.BufferGeometry>(x: T) => (geos.push(x), x);
  const m = <T extends THREE.Material>(x: T) => (mats.push(x), x);

  const texs: THREE.Texture[] = [];
  /** Weicher radialer Verlauf als Textur (Kontaktschatten, Partikel) – prozedural, kein Asset. */
  function radialTexture(inner: string, outer: string) {
    const c = document.createElement('canvas');
    c.width = c.height = 128;
    const ctx = c.getContext('2d');
    if (ctx) {
      const grd = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
      grd.addColorStop(0, inner);
      grd.addColorStop(1, outer);
      ctx.fillStyle = grd;
      ctx.fillRect(0, 0, 128, 128);
    }
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    texs.push(t);
    return t;
  }

  // Himmel: Verlauf vom Horizont zum Zenit
  const skyMat = m(
    new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
      uniforms: { top: { value: new THREE.Color() }, horizon: { value: new THREE.Color() } },
      vertexShader: 'varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader:
        'uniform vec3 top; uniform vec3 horizon; varying vec3 vP;\nvoid main(){ float h = clamp(normalize(vP).y, 0.0, 1.0); gl_FragColor = vec4(mix(horizon, top, pow(h, 0.32)), 1.0);\n#include <colorspace_fragment>\n}',
    }),
  );
  const sky = new THREE.Mesh(g(new THREE.SphereGeometry(45, 32, 16)), skyMat);
  scene.add(sky);

  // Boden: leicht spiegelnd, läuft im Nebel in den Horizont aus; Lageplan-Ringe statt Raster
  const floorMat = m(new THREE.MeshStandardMaterial({ color: 0x081226, roughness: 0.42, metalness: 0.35 }));
  const floor = new THREE.Mesh(g(new THREE.CircleGeometry(32, 64)), floorMat);
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  scene.add(floor);
  const ringMat = m(new THREE.MeshBasicMaterial({ color: 0x2b5a8f, transparent: true, opacity: 0.4, depthWrite: false }));
  [4.2, 6.4, 9.2].forEach((r) => {
    const ring = new THREE.Mesh(g(new THREE.RingGeometry(r, r + 0.012, 128)), ringMat);
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.003;
    scene.add(ring);
  });

  // Architekturmodell
  const model = new THREE.Group();
  scene.add(model);
  const unit = g(new THREE.BoxGeometry(1, 1, 1));
  const box = (mat: THREE.Material, w: number, h: number, d: number, x: number, y: number, z: number, shadow = false) => {
    const b = new THREE.Mesh(unit, mat);
    b.scale.set(w, h, d);
    b.position.set(x, y, z);
    b.castShadow = shadow;
    b.receiveShadow = shadow;
    model.add(b);
    return b;
  };

  const concrete = m(new THREE.MeshStandardMaterial({ color: 0xe4e7eb, roughness: 0.6, metalness: 0.02 }));
  const coreMat = m(new THREE.MeshStandardMaterial({ color: 0x9aa1ab, roughness: 0.8 }));
  const stone = m(new THREE.MeshStandardMaterial({ color: 0x2b3038, roughness: 0.7, metalness: 0.1 }));
  const wood = m(new THREE.MeshStandardMaterial({ color: 0xb48a5c, roughness: 0.65 }));
  const steel = m(new THREE.MeshStandardMaterial({ color: 0x232a34, roughness: 0.35, metalness: 0.85 }));
  const glass =
    quality === 'high'
      ? m(new THREE.MeshPhysicalMaterial({ color: 0xd4efff, roughness: 0.04, metalness: 0, transmission: 0.94, thickness: 0.2, ior: 1.45, transparent: true }))
      : m(new THREE.MeshStandardMaterial({ color: 0x9fd0f0, roughness: 0.05, metalness: 0.9, transparent: true, opacity: 0.26, depthWrite: false }));
  const railMat = m(new THREE.MeshStandardMaterial({ color: 0xcfe9f7, roughness: 0.05, metalness: 0.8, transparent: true, opacity: 0.2, depthWrite: false }));
  const accentMat = m(new THREE.MeshStandardMaterial({ color: 0x22d3ee, emissive: 0x22d3ee, emissiveIntensity: 0.9, roughness: 0.3 }));
  const warmMat = m(new THREE.MeshStandardMaterial({ color: 0xfff1d6, emissive: 0xffc98a, emissiveIntensity: 1, roughness: 0.9 }));
  const water = m(new THREE.MeshStandardMaterial({ color: 0x0b2c3d, roughness: 0.04, metalness: 0.95 }));
  const pvMat = m(new THREE.MeshStandardMaterial({ color: 0x12305a, roughness: 0.18, metalness: 0.7 }));
  const grass = m(new THREE.MeshStandardMaterial({ color: 0x55805a, roughness: 0.95 }));
  const leaf = m(new THREE.MeshStandardMaterial({ color: 0x5f9467, roughness: 0.85 }));

  // Kontaktschatten (funktioniert in jeder Qualitätsstufe)
  const blobMat = m(
    new THREE.MeshBasicMaterial({ map: radialTexture('rgba(0,0,0,0.6)', 'rgba(0,0,0,0)'), transparent: true, depthWrite: false }),
  );
  const blob = new THREE.Mesh(g(new THREE.PlaneGeometry(10, 8)), blobMat);
  blob.rotation.x = -Math.PI / 2;
  blob.position.y = 0.006;
  model.add(blob);

  // Sockel mit Wasserbecken
  const occluders: THREE.Object3D[] = [];
  occluders.push(box(stone, 5.6, 0.1, 3.8, 0, 0.05, 0, true));
  box(water, 1.0, 0.012, 2.6, 2.15, 0.106, 0.2);

  // Auskragende Geschossplatten: [Breite, Tiefe, x, y, z]
  const slabs: [number, number, number, number, number][] = [
    [3.6, 2.6, 0, 0.16, 0],
    [3.0, 2.2, 0.55, 1.25, 0.15],
    [3.4, 2.0, -0.35, 2.35, -0.1],
    [2.4, 1.8, 0.25, 3.4, 0.05],
  ];
  slabs.forEach(([w, d, x, y, z], i) => {
    occluders.push(box(concrete, w, 0.12, d, x, y, z, true));
    if (i > 0) {
      box(wood, w - 0.06, 0.02, d - 0.06, x, y - 0.07, z); // Holzuntersicht
      // Glasbrüstung rundum
      const ry = y + 0.06 + 0.11;
      box(railMat, w, 0.22, 0.012, x, ry, z + d / 2 - 0.02);
      box(railMat, w, 0.22, 0.012, x, ry, z - d / 2 + 0.02);
      box(railMat, 0.012, 0.22, d, x + w / 2 - 0.02, ry, z);
      box(railMat, 0.012, 0.22, d, x - w / 2 + 0.02, ry, z);
    }
  });

  // Erschließungskern durch alle Geschosse
  occluders.push(box(coreMat, 0.7, 3.15, 0.6, 0.1, 1.79, -0.3, true));

  // Verglaste Geschosse: [Breite, Höhe, Tiefe, x, y, z] – mit Holzboden, Lichtdecke und Fassadenprofilen
  const volumes: [number, number, number, number, number, number][] = [
    [3.1, 0.97, 2.2, 0.1, 0.705, 0],
    [2.6, 0.98, 1.8, 0.5, 1.8, 0.12],
    [2.9, 0.93, 1.65, -0.3, 2.875, -0.08],
  ];
  const finStep = 0.44;
  const finSlots: [number, number, number, number, boolean][] = []; // x, y, z, Höhe, quer
  volumes.forEach(([w, h, d, x, y, z]) => {
    box(wood, w - 0.04, 0.015, d - 0.04, x, y - h / 2 + 0.012, z);
    box(warmMat, w - 0.5, 0.012, d - 0.5, x, y + h / 2 - 0.012, z);
    const glassBox = box(glass, w, h, d, x, y, z);
    glassBox.renderOrder = 2;
    const nx = Math.round(w / finStep);
    for (let i = 0; i <= nx; i++) {
      const fx = x - w / 2 + (w * i) / nx;
      finSlots.push([fx, y, z + d / 2, h, false], [fx, y, z - d / 2, h, false]);
    }
    const nz = Math.round(d / finStep);
    for (let i = 1; i < nz; i++) {
      const fz = z - d / 2 + (d * i) / nz;
      finSlots.push([x + w / 2, y, fz, h, true], [x - w / 2, y, fz, h, true]);
    }
  });
  const fins = new THREE.InstancedMesh(unit, steel, finSlots.length);
  const finM = new THREE.Matrix4();
  const finQ = new THREE.Quaternion();
  finSlots.forEach(([fx, fy, fz, fh, cross], i) => {
    finM.compose(new THREE.Vector3(fx, fy, fz), finQ, cross ? new THREE.Vector3(0.07, fh, 0.022) : new THREE.Vector3(0.022, fh, 0.07));
    fins.setMatrixAt(i, finM);
  });
  fins.castShadow = true;
  model.add(fins);

  // Warmes Innenlicht je Geschoss
  const warmLights: THREE.PointLight[] = [];
  volumes.slice(0, quality === 'low' ? 1 : 3).forEach(([, , , x, y, z]) => {
    const l = new THREE.PointLight(0xffc27a, 1, 3.2, 1.8);
    l.position.set(x + 0.6, y + 0.2, z + 0.3);
    warmLights.push(l);
    model.add(l);
  });

  // Leuchtende Akzentkanten (Primärfarbe)
  const edges: THREE.Mesh[] = [];
  slabs.slice(1).forEach(([w, d, x, y, z]) => {
    edges.push(box(accentMat, w + 0.01, 0.018, 0.018, x, y - 0.052, z + d / 2 + 0.004));
  });

  // Dachgarten
  box(grass, 1.9, 0.03, 1.3, 0.25, 3.475, 0.05);
  const crownGeo = g(new THREE.IcosahedronGeometry(1, 2));
  const trunkGeo = g(new THREE.CylinderGeometry(0.014, 0.02, 1, 8));
  (
    [
      [-0.35, -0.25, 0.2],
      [0.1, 0.35, 0.16],
      [0.75, -0.3, 0.22],
      [0.95, 0.35, 0.14],
    ] as [number, number, number][]
  ).forEach(([x, z, r]) => {
    const trunk = new THREE.Mesh(trunkGeo, steel);
    trunk.scale.y = 0.26;
    trunk.position.set(x, 3.62, z);
    const crown = new THREE.Mesh(crownGeo, leaf);
    crown.scale.set(r, r * 1.15, r);
    crown.position.set(x, 3.74 + r, z);
    crown.castShadow = true;
    model.add(trunk, crown);
  });

  // Energiesystem: aufgeständertes Solarfeld auf dem Sockel
  for (let i = 0; i < 3; i++)
    for (let j = 0; j < 2; j++) {
      const p = box(pvMat, 0.42, 0.016, 0.3, -2.42 + i * 0.46, 0.27, 0.35 + j * 0.42);
      p.rotation.x = -0.42;
      box(steel, 0.02, 0.16, 0.02, -2.42 + i * 0.46, 0.18, 0.42 + j * 0.42);
    }

  // Schwebende Glaselemente: fast unsichtbare Fläche mit leuchtender Kante
  const floatGeo = g(new THREE.PlaneGeometry(1, 1));
  const floatEdgeGeo = g(new THREE.EdgesGeometry(floatGeo));
  const floatMat = m(
    new THREE.MeshStandardMaterial({ color: 0xcfefff, roughness: 0.05, metalness: 0.9, transparent: true, opacity: 0.07, side: THREE.DoubleSide, depthWrite: false }),
  );
  const floatEdgeMat = m(new THREE.LineBasicMaterial({ color: 0x22d3ee, transparent: true, opacity: 0.5 }));
  const floaters: { mesh: THREE.Group; base: number; phase: number }[] = [];
  const floatCount = quality === 'low' ? 4 : 7;
  for (let i = 0; i < floatCount; i++) {
    const f = new THREE.Group();
    f.add(new THREE.Mesh(floatGeo, floatMat), new THREE.LineSegments(floatEdgeGeo, floatEdgeMat));
    const a = (i / floatCount) * Math.PI * 2 + 0.5;
    const r = 4.6 + (i % 3) * 0.9;
    f.position.set(Math.cos(a) * r, 1.4 + (i % 4) * 0.75, Math.sin(a) * r);
    f.scale.set(0.7 + (i % 3) * 0.3, 1.0 + (i % 2) * 0.6, 1);
    f.lookAt(0, f.position.y, 0);
    floaters.push({ mesh: f, base: f.position.y, phase: i * 1.3 });
    scene.add(f);
  }

  // Lichtpartikel (weiche Punkte)
  const pCount = quality === 'high' ? 700 : quality === 'medium' ? 380 : 150;
  const pPos = new Float32Array(pCount * 3);
  const rand = seeded(20261113);
  for (let i = 0; i < pCount; i++) {
    const r = 2.5 + rand() * 8;
    const a = rand() * Math.PI * 2;
    pPos[i * 3] = Math.cos(a) * r;
    pPos[i * 3 + 1] = 0.2 + rand() * 6.5;
    pPos[i * 3 + 2] = Math.sin(a) * r;
  }
  const pGeo = g(new THREE.BufferGeometry());
  pGeo.setAttribute('position', new THREE.BufferAttribute(pPos, 3));
  const pMat = m(
    new THREE.PointsMaterial({
      color: 0x22d3ee,
      map: radialTexture('rgba(255,255,255,1)', 'rgba(255,255,255,0)'),
      size: 0.06,
      sizeAttenuation: true,
      transparent: true,
      opacity: 0.6,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    }),
  );
  const particles = new THREE.Points(pGeo, pMat);
  scene.add(particles);

  // ---------- Konfiguration anwenden ----------
  const tmpCol = new THREE.Color();
  function applyConfig() {
    const col = new THREE.Color(cfg.primaryColor);
    accentMat.color.copy(col);
    accentMat.emissive.copy(col);
    pMat.color.copy(col);
    accent.color.copy(col);
    floatEdgeMat.color.copy(col);

    const b = BG[cfg.background];
    const md = MOOD[cfg.lightMood];
    const horizon = new THREE.Color(b.horizon).lerp(tmpCol.setHex(md.tint), b.light ? md.tintW * 0.25 : md.tintW);
    (skyMat.uniforms.top.value as THREE.Color).setHex(b.top);
    (skyMat.uniforms.horizon.value as THREE.Color).copy(horizon);
    scene.background = horizon;
    scene.fog = new THREE.Fog(horizon, 11, 30);
    floorMat.color.setHex(b.floor);
    ringMat.color.setHex(b.ring);
    blobMat.opacity = b.light ? 0.45 : 0.9;

    key.color.setHex(md.key);
    key.intensity = md.keyI;
    hemi.color.setHex(md.hemiSky);
    hemi.groundColor.setHex(md.hemiGround);
    hemi.intensity = md.hemiI;
    accent.intensity = md.accentI;
    accentMat.emissiveIntensity = cfg.lightMood === 'nacht' ? 1.8 : cfg.lightMood === 'abend' ? 1.2 : 0.7;
    warmMat.emissiveIntensity = md.warm;
    warmLights.forEach((l) => (l.intensity = md.warm * 0.9));
    renderer.toneMappingExposure = md.exposure;
    pMat.opacity = b.light ? 0.5 : 0.6;
    pMat.blending = b.light ? THREE.NormalBlending : THREE.AdditiveBlending;
    pMat.needsUpdate = true;
  }
  applyConfig();

  // ---------- Interaktion ----------
  let pointerX = 0;
  let pointerY = 0;
  const onPointer = (e: PointerEvent) => {
    const r = container.getBoundingClientRect();
    pointerX = ((e.clientX - r.left) / r.width) * 2 - 1;
    pointerY = ((e.clientY - r.top) / r.height) * 2 - 1;
  };
  window.addEventListener('pointermove', onPointer, { passive: true });

  // Ziehen zum Drehen (Maus und Touch). touch-action: pan-y lässt vertikales Scrollen unberührt.
  let rotY = 0.35;
  let rotVel = 0;
  let rotKick = 0;
  let dragging = false;
  let dragX = 0;
  let dragT = 0;
  container.style.touchAction = 'pan-y';
  container.style.cursor = 'grab';
  const onDown = (e: PointerEvent) => {
    if ((e.target as Element | null)?.closest?.('button')) return;
    dragging = true;
    dragX = e.clientX;
    dragT = performance.now();
    rotVel = 0;
    container.style.cursor = 'grabbing';
  };
  const onDrag = (e: PointerEvent) => {
    if (!dragging) return;
    const now = performance.now();
    const d = (e.clientX - dragX) * 0.006;
    rotY += d;
    rotVel = THREE.MathUtils.clamp(d / Math.max(0.008, (now - dragT) / 1000), -4, 4);
    dragX = e.clientX;
    dragT = now;
  };
  const onUp = () => {
    if (!dragging) return;
    dragging = false;
    if (performance.now() - dragT > 120) rotVel = 0;
    container.style.cursor = 'grab';
  };
  container.addEventListener('pointerdown', onDown);
  window.addEventListener('pointermove', onDrag, { passive: true });
  window.addEventListener('pointerup', onUp);
  window.addEventListener('pointercancel', onUp);

  let scrollTarget = 0;
  let scrollCurrent = 0;
  let focusId: string | null = null;

  // ---------- Größe ----------
  let width = 1;
  let height = 1;
  const resize = () => {
    width = Math.max(1, container.clientWidth);
    height = Math.max(1, container.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, dprCap()));
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    // Auf schmalen Bildschirmen etwas weiter weg
    camera.fov = width < 640 ? 50 : width < 1024 ? 44 : 38;
    camera.updateProjectionMatrix();
  };
  const ro = new ResizeObserver(resize);
  ro.observe(container);
  resize();

  // ---------- Sichtbarkeit: Render-Loop pausieren ----------
  let onScreen = true;
  const io = new IntersectionObserver((entries) => {
    onScreen = entries[0]?.isIntersecting ?? true;
    if (onScreen) start();
  });
  io.observe(container);
  const onVis = () => {
    if (!document.hidden) start();
  };
  document.addEventListener('visibilitychange', onVis);

  // ---------- Dynamische Qualitätsstufe ----------
  let frames = 0;
  let fpsT0 = performance.now();
  let lowStreak = 0;
  function downgrade() {
    if (quality === 'low' || opts.lockQuality) return;
    quality = quality === 'high' ? 'medium' : 'low';
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, dprCap()));
    renderer.setSize(width, height, false);
    renderer.shadowMap.enabled = false;
    key.castShadow = false;
    if (quality === 'low') {
      particles.geometry.setDrawRange(0, 150);
      floaters.forEach((f, i) => (f.mesh.visible = i < 4));
    }
    opts.onQualityChange?.(quality);
  }

  // ---------- Hotspots projizieren ----------
  const hsVec = new THREE.Vector3();
  const camDir = new THREE.Vector3();
  const toHs = new THREE.Vector3();
  let lastHsKey = '';
  const ray = new THREE.Raycaster();
  const hsWorld = new THREE.Vector3();
  const occluded = new Map<string, boolean>();
  let hsFrame = 0;
  function projectHotspots(show: boolean) {
    if (!opts.onHotspots) return;
    camera.getWorldDirection(camDir);
    // Verdeckung durch Decken, Kern und Sockel nur jedes 6. Bild prüfen
    if (hsFrame++ % 6 === 0) {
      opts.hotspots.forEach((h) => {
        hsWorld.set(...h.position).applyMatrix4(model.matrixWorld);
        const dist = hsWorld.distanceTo(camera.position);
        ray.set(camera.position, toHs.copy(hsWorld).sub(camera.position).normalize());
        ray.far = dist - 0.12;
        occluded.set(h.id, ray.intersectObjects(occluders, false).length > 0);
      });
    }
    const list: ProjectedHotspot[] = opts.hotspots.map((h) => {
      hsVec.set(...h.position).applyMatrix4(model.matrixWorld);
      toHs.copy(hsVec).sub(camera.position).normalize();
      const front = toHs.dot(camDir) > 0.15;
      hsVec.project(camera);
      const x = (hsVec.x * 0.5 + 0.5) * width;
      const y = (-hsVec.y * 0.5 + 0.5) * height;
      const inView = show && front && !occluded.get(h.id) && x > 8 && x < width - 8 && y > 8 && y < height - 8;
      return { id: h.id, x: Math.round(x), y: Math.round(y), visible: inView };
    });
    const k = list.map((l) => `${l.id}${l.x},${l.y},${l.visible}`).join('|');
    if (k !== lastHsKey) {
      lastHsKey = k;
      opts.onHotspots(list);
    }
  }

  // ---------- Loop ----------
  const clock = new THREE.Clock();
  const camPos = new THREE.Vector3();
  const camLook = new THREE.Vector3();
  const lookCur = new THREE.Vector3(0, 1.7, 0);
  const rightVec = new THREE.Vector3();
  const UP = new THREE.Vector3(0, 1, 0);
  let raf = 0;
  let running = false;
  let disposed = false;

  // Startposition setzen
  sampleCam(0, camPos, camLook);
  camera.position.copy(camPos);
  camera.lookAt(camLook);
  let firstFrame = true;
  const introStart = performance.now();
  const INTRO_MS = 2600;

  function frame() {
    if (disposed) return;
    if (!onScreen || document.hidden) {
      running = false;
      return;
    }
    raf = requestAnimationFrame(frame);
    const dt = Math.min(clock.getDelta(), 0.05);
    const t = clock.elapsedTime;

    // Scroll-Kamera (gedämpft, kein Scroll-Jacking: nur Lesen der Scroll-Position)
    const damp = reduced ? 1 : 1 - Math.pow(0.0025, dt);
    scrollCurrent += (scrollTarget - scrollCurrent) * damp;
    sampleCam(scrollCurrent, camPos, camLook);

    // Bildausschnitt an Format anpassen: Hochformat → weiter weg, Modell in die obere Hälfte;
    // Desktop-Hero → Modell nach rechts, damit die Überschrift frei bleibt
    const aspect = width / height;
    const heroWeight = 1 - smooth(THREE.MathUtils.clamp(scrollCurrent / 0.3, 0, 1));
    // Einflug beim Laden (entfällt bei reduzierter Bewegung)
    const introT = reduced ? 1 : THREE.MathUtils.clamp((performance.now() - introStart) / INTRO_MS, 0, 1);
    const intro = 1 - Math.pow(1 - introT, 3);
    const distF =
      (aspect < 0.8 ? 1.6 : aspect < 1.2 ? 1.25 : 1.12) * (1 + 0.32 * (1 - heroWeight)) * (1 + 0.9 * (1 - intro));
    camPos.y += 2.4 * (1 - intro);
    camPos.sub(camLook).multiplyScalar(distF).add(camLook);
    if (aspect < 0.8) camLook.y -= 1.4 * (0.4 + 0.6 * heroWeight);
    else if (aspect >= 1.2) {
      rightVec.subVectors(camLook, camPos).cross(UP).normalize();
      const shift = 2.5 * heroWeight;
      camLook.addScaledVector(rightVec, -shift);
      camPos.addScaledVector(rightVec, -shift * 0.35);
    }

    if (focusId) {
      const h = opts.hotspots.find((x) => x.id === focusId);
      if (h) {
        const hp = new THREE.Vector3(...h.position).applyMatrix4(model.matrixWorld);
        camLook.lerp(hp, 0.35);
      }
    }

    // Maus-Parallaxe
    const par = reduced ? 0 : 0.6;
    camPos.x += pointerX * par;
    camPos.y += -pointerY * par * 0.5;
    const k = reduced || firstFrame || introT < 1 ? 1 : 1 - Math.pow(0.02, dt);
    firstFrame = false;
    camera.position.lerp(camPos, k);
    lookCur.lerp(camLook, k);
    camera.lookAt(lookCur);

    // Automatische Rotation
    if (!reduced && !focusId && !dragging) rotY += dt * 0.12 * cfg.rotationSpeed;
    if (!dragging && rotVel !== 0) {
      rotY += rotVel * dt;
      rotVel *= Math.pow(0.04, dt);
      if (Math.abs(rotVel) < 0.01) rotVel = 0;
    }
    if (rotKick !== 0) {
      const step = reduced ? rotKick : rotKick * (1 - Math.pow(0.002, dt));
      rotY += step;
      rotKick = Math.abs(rotKick - step) < 0.002 ? 0 : rotKick - step;
    }
    model.rotation.y = rotY - 1.5 * (1 - intro);

    if (!reduced) {
      floaters.forEach((f) => {
        f.mesh.position.y = f.base + Math.sin(t * 0.6 + f.phase) * 0.12;
      });
      particles.rotation.y = t * 0.015;
      edges.forEach((e, i) => {
        (e.material as THREE.MeshStandardMaterial).emissiveIntensity =
          accentMat.emissiveIntensity * (0.85 + 0.15 * Math.sin(t * 1.6 + i));
      });
    }

    renderer.render(scene, camera);
    projectHotspots(introT >= 1);

    // FPS-Überwachung → automatische Reduktion
    frames++;
    const now = performance.now();
    if (now - fpsT0 > 2000) {
      const fps = (frames * 1000) / (now - fpsT0);
      frames = 0;
      fpsT0 = now;
      lowStreak = fps < 32 ? lowStreak + 1 : 0;
      if (lowStreak >= 2) {
        lowStreak = 0;
        downgrade();
      }
    }
  }

  function start() {
    if (running || disposed) return;
    running = true;
    clock.getDelta();
    raf = requestAnimationFrame(frame);
  }
  start();

  return {
    setConfig(next) {
      Object.assign(cfg, next);
      applyConfig();
      if (!running) renderer.render(scene, camera);
    },
    setScrollProgress(p) {
      scrollTarget = THREE.MathUtils.clamp(p, 0, 1);
    },
    setReducedMotion(r) {
      reduced = r;
    },
    focusHotspot(id) {
      focusId = id;
    },
    rotateBy(rad) {
      rotKick += rad;
      rotVel = 0;
    },
    getQuality() {
      return quality;
    },
    dispose() {
      disposed = true;
      cancelAnimationFrame(raf);
      window.removeEventListener('pointermove', onPointer);
      container.removeEventListener('pointerdown', onDown);
      window.removeEventListener('pointermove', onDrag);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
      container.style.cursor = '';
      container.style.touchAction = '';
      fins.dispose();
      texs.forEach((x) => x.dispose());
      document.removeEventListener('visibilitychange', onVis);
      ro.disconnect();
      io.disconnect();
      geos.forEach((x) => x.dispose());
      mats.forEach((x) => x.dispose());
      envTex.dispose();
      pmrem.dispose();
      roomEnv.traverse((o) => {
        const mesh = o as THREE.Mesh;
        mesh.geometry?.dispose?.();
        const mat = mesh.material as THREE.Material | THREE.Material[] | undefined;
        if (Array.isArray(mat)) mat.forEach((x) => x.dispose());
        else mat?.dispose?.();
      });
      renderer.dispose();
      renderer.forceContextLoss();
      renderer.domElement.remove();
    },
  };
}
