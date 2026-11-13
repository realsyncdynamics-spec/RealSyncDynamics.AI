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
  getQuality(): QualityTier;
  dispose(): void;
}

export interface CreateOptions {
  container: HTMLElement;
  config: SceneConfig;
  hotspots: HotspotDef[];
  reducedMotion: boolean;
  quality?: QualityTier;
  onHotspots?: (list: ProjectedHotspot[]) => void;
  onQualityChange?: (q: QualityTier) => void;
}

const BG: Record<BackgroundStyle, { bg: number; fog: number; floor: number; grid: number }> = {
  tiefblau: { bg: 0x050b1a, fog: 0x050b1a, floor: 0x0a1428, grid: 0x1e3a5f },
  anthrazit: { bg: 0x111317, fog: 0x111317, floor: 0x1a1d22, grid: 0x30353d },
  hell: { bg: 0xe9eef4, fog: 0xe9eef4, floor: 0xdfe5ec, grid: 0xb9c4d1 },
};

const MOOD: Record<LightMood, { key: number; keyI: number; hemiSky: number; hemiGround: number; hemiI: number; accentI: number; exposure: number }> = {
  tag: { key: 0xffffff, keyI: 2.6, hemiSky: 0xcfe8ff, hemiGround: 0x223344, hemiI: 0.9, accentI: 0.6, exposure: 1.05 },
  abend: { key: 0xffb47a, keyI: 2.0, hemiSky: 0x7a5c8f, hemiGround: 0x1a1020, hemiI: 0.55, accentI: 1.4, exposure: 1.0 },
  nacht: { key: 0x8fb4ff, keyI: 0.7, hemiSky: 0x1b2a4a, hemiGround: 0x05070d, hemiI: 0.35, accentI: 3.2, exposure: 1.15 },
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
  scene.environmentIntensity = 0.55;

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

  // Boden + Raster
  const floorMat = m(new THREE.MeshStandardMaterial({ color: 0x0a1428, roughness: 0.85, metalness: 0.1 }));
  const floor = new THREE.Mesh(g(new THREE.CircleGeometry(14, 64)), floorMat);
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  scene.add(floor);
  const grid = new THREE.GridHelper(28, 56, 0x1e3a5f, 0x1e3a5f);
  (grid.material as THREE.Material).transparent = true;
  (grid.material as THREE.Material).opacity = 0.35;
  mats.push(grid.material as THREE.Material);
  geos.push(grid.geometry);
  grid.position.y = 0.002;
  scene.add(grid);

  // Architekturmodell
  const model = new THREE.Group();
  scene.add(model);

  const concrete = m(new THREE.MeshStandardMaterial({ color: 0xd9dde3, roughness: 0.55, metalness: 0.05 }));
  const glass =
    quality === 'high'
      ? m(
          new THREE.MeshPhysicalMaterial({
            color: 0xbfe9ff,
            roughness: 0.06,
            metalness: 0,
            transmission: 0.92,
            thickness: 0.25,
            ior: 1.45,
            transparent: true,
            opacity: 1,
          }),
        )
      : m(
          new THREE.MeshStandardMaterial({
            color: 0x9fd8ff,
            roughness: 0.08,
            metalness: 0.6,
            transparent: true,
            opacity: 0.38,
          }),
        );
  const accentMat = m(
    new THREE.MeshStandardMaterial({ color: 0x22d3ee, emissive: 0x22d3ee, emissiveIntensity: 0.9, roughness: 0.3 }),
  );
  const steel = m(new THREE.MeshStandardMaterial({ color: 0x3b4452, roughness: 0.35, metalness: 0.85 }));

  // Auskragende Geschossplatten (Cantilever)
  const slabs: [number, number, number, number, number][] = [
    // w, d, x, y, z
    [3.6, 2.6, 0, 0.12, 0],
    [3.0, 2.2, 0.55, 1.25, 0.15],
    [3.4, 2.0, -0.35, 2.35, -0.1],
    [2.4, 1.8, 0.25, 3.4, 0.05],
  ];
  const slabGeo = g(new THREE.BoxGeometry(1, 1, 1));
  slabs.forEach(([w, d, x, y, z]) => {
    const s = new THREE.Mesh(slabGeo, concrete);
    s.scale.set(w, 0.16, d);
    s.position.set(x, y, z);
    s.castShadow = s.receiveShadow = true;
    model.add(s);
  });
  // Glasvolumen zwischen den Platten
  const glassGeo = g(new THREE.BoxGeometry(1, 1, 1));
  const volumes: [number, number, number, number, number, number][] = [
    [3.1, 1.0, 2.2, 0.1, 0.68, 0],
    [2.6, 0.95, 1.8, 0.5, 1.8, 0.12],
    [2.9, 0.9, 1.65, -0.3, 2.87, -0.08],
  ];
  volumes.forEach(([w, h, d, x, y, z]) => {
    const v = new THREE.Mesh(glassGeo, glass);
    v.scale.set(w, h, d);
    v.position.set(x, y, z);
    model.add(v);
  });
  // Stützen
  const colGeo = g(new THREE.CylinderGeometry(0.04, 0.04, 1, 12));
  [
    [-1.4, -0.9], [1.4, -0.9], [-1.4, 0.9], [1.4, 0.9],
  ].forEach(([x, z]) => {
    for (let lvl = 0; lvl < 3; lvl++) {
      const c = new THREE.Mesh(colGeo, steel);
      c.scale.y = 1.0;
      c.position.set(x * (lvl === 2 ? 0.8 : 0.9), 0.7 + lvl * 1.1, z * 0.8);
      c.castShadow = true;
      model.add(c);
    }
  });
  // Leuchtende Akzentkanten (Primärfarbe)
  const edgeGeo = g(new THREE.BoxGeometry(1, 1, 1));
  const edges: THREE.Mesh[] = [];
  slabs.slice(1).forEach(([w, d, x, y, z]) => {
    const e = new THREE.Mesh(edgeGeo, accentMat);
    e.scale.set(w + 0.02, 0.025, 0.025);
    e.position.set(x, y + 0.09, z + d / 2);
    edges.push(e);
    model.add(e);
  });
  // Dachgarten (stilisiert)
  const treeGeo = g(new THREE.IcosahedronGeometry(0.22, 1));
  const leaf = m(new THREE.MeshStandardMaterial({ color: 0x4f7d5b, roughness: 0.9, flatShading: true }));
  [[-0.6, -0.2], [-0.15, 0.4], [0.5, -0.35], [0.8, 0.3]].forEach(([x, z], i) => {
    const t = new THREE.Mesh(treeGeo, leaf);
    t.position.set(x, 3.68 + (i % 2) * 0.05, z);
    t.scale.setScalar(0.8 + (i % 3) * 0.15);
    t.castShadow = true;
    model.add(t);
  });
  // Energiesystem: Solarfeld neben dem Gebäude
  const panelGeo = g(new THREE.BoxGeometry(0.5, 0.03, 0.32));
  for (let i = 0; i < 3; i++)
    for (let j = 0; j < 2; j++) {
      const p = new THREE.Mesh(panelGeo, steel);
      p.position.set(-2.3 + i * 0.55, 0.25, 0.3 + j * 0.4);
      p.rotation.x = -0.35;
      model.add(p);
    }

  // Schwebende Glaselemente
  const floatGeo = g(new THREE.BoxGeometry(1, 1, 0.03));
  const floatMat = m(
    new THREE.MeshStandardMaterial({ color: 0xcfefff, roughness: 0.05, metalness: 0.7, transparent: true, opacity: 0.22 }),
  );
  const floaters: { mesh: THREE.Mesh; base: number; phase: number }[] = [];
  const floatCount = quality === 'low' ? 4 : 9;
  for (let i = 0; i < floatCount; i++) {
    const f = new THREE.Mesh(floatGeo, floatMat);
    const a = (i / floatCount) * Math.PI * 2;
    const r = 3.6 + (i % 3) * 0.7;
    f.position.set(Math.cos(a) * r, 1.2 + (i % 4) * 0.8, Math.sin(a) * r);
    f.scale.set(0.6 + (i % 3) * 0.3, 0.9 + (i % 2) * 0.5, 1);
    f.lookAt(0, f.position.y, 0);
    floaters.push({ mesh: f, base: f.position.y, phase: i * 1.3 });
    scene.add(f);
  }

  // Lichtpartikel
  const pCount = quality === 'high' ? 900 : quality === 'medium' ? 450 : 160;
  const pPos = new Float32Array(pCount * 3);
  const rand = seeded(20261113);
  for (let i = 0; i < pCount; i++) {
    const r = 2 + rand() * 7;
    const a = rand() * Math.PI * 2;
    pPos[i * 3] = Math.cos(a) * r;
    pPos[i * 3 + 1] = rand() * 6;
    pPos[i * 3 + 2] = Math.sin(a) * r;
  }
  const pGeo = g(new THREE.BufferGeometry());
  pGeo.setAttribute('position', new THREE.BufferAttribute(pPos, 3));
  const pMat = m(
    new THREE.PointsMaterial({
      color: 0x22d3ee,
      size: 0.035,
      sizeAttenuation: true,
      transparent: true,
      opacity: 0.75,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    }),
  );
  const particles = new THREE.Points(pGeo, pMat);
  scene.add(particles);

  // ---------- Konfiguration anwenden ----------
  function applyConfig() {
    const col = new THREE.Color(cfg.primaryColor);
    accentMat.color.copy(col);
    accentMat.emissive.copy(col);
    pMat.color.copy(col);
    accent.color.copy(col);

    const b = BG[cfg.background];
    scene.background = new THREE.Color(b.bg);
    scene.fog = new THREE.Fog(b.fog, 12, 30);
    floorMat.color.setHex(b.floor);
    (grid.material as THREE.LineBasicMaterial).color.setHex(b.grid);

    const md = MOOD[cfg.lightMood];
    key.color.setHex(md.key);
    key.intensity = md.keyI;
    hemi.color.setHex(md.hemiSky);
    hemi.groundColor.setHex(md.hemiGround);
    hemi.intensity = md.hemiI;
    accent.intensity = md.accentI;
    accentMat.emissiveIntensity = cfg.lightMood === 'nacht' ? 1.6 : cfg.lightMood === 'abend' ? 1.1 : 0.7;
    renderer.toneMappingExposure = md.exposure;
    pMat.opacity = cfg.background === 'hell' ? 0.5 : 0.75;
    pMat.blending = cfg.background === 'hell' ? THREE.NormalBlending : THREE.AdditiveBlending;
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
    if (quality === 'low') return;
    quality = quality === 'high' ? 'medium' : 'low';
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, dprCap()));
    renderer.setSize(width, height, false);
    renderer.shadowMap.enabled = false;
    key.castShadow = false;
    if (quality === 'low') {
      particles.geometry.setDrawRange(0, 160);
      floaters.forEach((f, i) => (f.mesh.visible = i < 4));
    }
    opts.onQualityChange?.(quality);
  }

  // ---------- Hotspots projizieren ----------
  const hsVec = new THREE.Vector3();
  const camDir = new THREE.Vector3();
  const toHs = new THREE.Vector3();
  let lastHsKey = '';
  function projectHotspots() {
    if (!opts.onHotspots) return;
    camera.getWorldDirection(camDir);
    const list: ProjectedHotspot[] = opts.hotspots.map((h) => {
      hsVec.set(...h.position).applyMatrix4(model.matrixWorld);
      toHs.copy(hsVec).sub(camera.position).normalize();
      const front = toHs.dot(camDir) > 0.15;
      hsVec.project(camera);
      const x = (hsVec.x * 0.5 + 0.5) * width;
      const y = (-hsVec.y * 0.5 + 0.5) * height;
      const inView = front && x > 8 && x < width - 8 && y > 8 && y < height - 8;
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
  let rotY = 0.35;

  // Startposition setzen
  sampleCam(0, camPos, camLook);
  camera.position.copy(camPos);
  camera.lookAt(camLook);
  let firstFrame = true;

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
    const distF = (aspect < 0.8 ? 1.6 : aspect < 1.2 ? 1.25 : 1) * (1 + 0.4 * (1 - heroWeight));
    camPos.sub(camLook).multiplyScalar(distF).add(camLook);
    if (aspect < 0.8) camLook.y -= 1.4 * (0.4 + 0.6 * heroWeight);
    else if (aspect >= 1.2) {
      rightVec.subVectors(camLook, camPos).cross(UP).normalize();
      const shift = 1.9 * heroWeight;
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
    const k = reduced || firstFrame ? 1 : 1 - Math.pow(0.02, dt);
    firstFrame = false;
    camera.position.lerp(camPos, k);
    lookCur.lerp(camLook, k);
    camera.lookAt(lookCur);

    // Automatische Rotation
    if (!reduced && !focusId) rotY += dt * 0.12 * cfg.rotationSpeed;
    model.rotation.y = rotY;

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
    projectHotspots();

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
    getQuality() {
      return quality;
    },
    dispose() {
      disposed = true;
      cancelAnimationFrame(raf);
      window.removeEventListener('pointermove', onPointer);
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
