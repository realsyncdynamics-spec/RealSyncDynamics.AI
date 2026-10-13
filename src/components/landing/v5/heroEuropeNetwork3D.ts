/**
 * Landing v5 — echte 3D-Hero-Szene (three.js, eigener Chunk, lazy).
 *
 * Bildsprache wie der v2-Hero (dunkle Erde, goldenes Europa-Netz), aber als
 * echte WebGL-Szene statt statischem PNG:
 *  - Globus aus ~14k Gold-Partikeln (Landmaske aus der vorhandenen
 *    Specular-Textur /textures/hero-v4/earth_specular_2048.jpg — self-hosted, CSP-konform)
 *  - Europa zur Kamera ausgerichtet, leichte Achsneigung
 *  - Netz aus Bögen zwischen EU-Rechenzentrums-/Hauptstadt-Knoten, darauf
 *    laufende Lichtpulse (= „Evidence fließt“), Frankfurt als Hub hervorgehoben
 *  - Fresnel-Atmosphäre, Sternenfeld mit Tiefe
 *  - Zeiger-Parallaxe (Kamera + Globus), Scroll-Dolly, Idle-Rotation
 *
 * Performance/A11y: DPR ≤ 1.75, Rendern pausiert außerhalb des Viewports
 * und bei verstecktem Tab, `prefers-reduced-motion` → ein statisches Bild,
 * kein WebGL → Aufrufer zeigt das statische Fallback-Bild.
 */
import * as THREE from 'three';

const LAND_MASK = '/textures/hero-v4/earth_specular_2048.jpg';
const R = 2;

/** [Name, lat, lon] — Frankfurt zuerst (Hub). */
const NODES: ReadonlyArray<readonly [string, number, number]> = [
  ['Frankfurt', 50.11, 8.68],
  ['Berlin', 52.52, 13.4],
  ['Paris', 48.86, 2.35],
  ['Amsterdam', 52.37, 4.9],
  ['Brüssel', 50.85, 4.35],
  ['Wien', 48.21, 16.37],
  ['Zürich', 47.37, 8.54],
  ['Mailand', 45.46, 9.19],
  ['Madrid', 40.42, -3.7],
  ['Lissabon', 38.72, -9.14],
  ['Dublin', 53.35, -6.26],
  ['Kopenhagen', 55.68, 12.57],
  ['Stockholm', 59.33, 18.07],
  ['Helsinki', 60.17, 24.94],
  ['Warschau', 52.23, 21.01],
  ['Prag', 50.08, 14.44],
  ['Rom', 41.9, 12.5],
  ['Athen', 37.98, 23.73],
  ['Bukarest', 44.43, 26.1],
  ['Tallinn', 59.44, 24.75],
];

export interface HeroEuropeOptions {
  canvas: HTMLCanvasElement;
  /** Sichtbarkeit steuert das Rendern (Hero-Section). */
  visibilityTarget?: Element | null;
  /** Akzentfarbe (Gold-Default). */
  accent?: string;
}

function latLon(lat: number, lon: number, r = R): THREE.Vector3 {
  const phi = THREE.MathUtils.degToRad(90 - lat);
  const theta = THREE.MathUtils.degToRad(lon + 180);
  return new THREE.Vector3(-r * Math.sin(phi) * Math.cos(theta), r * Math.cos(phi), r * Math.sin(phi) * Math.sin(theta));
}

function loadLandMask(): Promise<((lat: number, lon: number) => boolean) | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.decoding = 'async';
    img.onload = () => {
      const w = 1024;
      const h = 512;
      const c = document.createElement('canvas');
      c.width = w;
      c.height = h;
      const ctx = c.getContext('2d', { willReadFrequently: true });
      if (!ctx) return resolve(null);
      ctx.drawImage(img, 0, 0, w, h);
      const data = ctx.getImageData(0, 0, w, h).data;
      resolve((lat, lon) => {
        const x = Math.min(w - 1, Math.max(0, Math.floor(((lon + 180) / 360) * w)));
        const y = Math.min(h - 1, Math.max(0, Math.floor(((90 - lat) / 180) * h)));
        return data[(y * w + x) * 4] < 110; // Specular: Wasser hell, Land dunkel
      });
    };
    img.onerror = () => resolve(null);
    img.src = LAND_MASK;
  });
}

/** Glühender runder Punkt als Sprite-Textur. */
function dotTexture(): THREE.Texture {
  const s = 64;
  const c = document.createElement('canvas');
  c.width = c.height = s;
  const g = c.getContext('2d')!;
  const grd = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
  grd.addColorStop(0, 'rgba(255,255,255,1)');
  grd.addColorStop(0.25, 'rgba(255,255,255,0.85)');
  grd.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, s, s);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function mountHeroEurope({ canvas, visibilityTarget, accent = '#d6ae52' }: HeroEuropeOptions): () => void {
  let disposed = false;
  let raf = 0;
  const cleanups: Array<() => void> = [];
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.75));
  renderer.setClearColor(0x000000, 0);
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const scene = new THREE.Scene();
  const cam = new THREE.PerspectiveCamera(36, 1, 0.1, 200);
  cam.position.set(0, 0, 8.6);

  const gold = new THREE.Color(accent);
  const dot = dotTexture();

  // Globus-Gruppe: Europa zur Kamera drehen, dann leicht neigen.
  const globe = new THREE.Group();
  const face = new THREE.Quaternion().setFromUnitVectors(latLon(50, 11, 1).normalize(), new THREE.Vector3(-0.35, 0.3, 1).normalize()); // Europa leicht oben-links auf der Kugel = zur Textseite hin
  globe.quaternion.copy(face);
  const tilt = new THREE.Group();
  tilt.rotation.set(0, 0, 0.05); // Europa oben-rechts im Bild, wie v2
  tilt.add(globe);
  const rig = new THREE.Group();
  rig.position.set(1.55, -0.15, 0);
  rig.add(tilt);
  scene.add(rig);

  // Dunkler Kern (verdeckt Rückseite) + Fresnel-Atmosphäre.
  globe.add(new THREE.Mesh(new THREE.SphereGeometry(R * 0.985, 64, 64), new THREE.MeshBasicMaterial({ color: 0x0b0b0c })));
  const atmo = new THREE.Mesh(
    new THREE.SphereGeometry(R * 1.12, 64, 64),
    new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.BackSide,
      uniforms: { uColor: { value: gold.clone() } },
      vertexShader: `varying vec3 vN; void main(){ vN = normalize(normalMatrix*normal); gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
      fragmentShader: `uniform vec3 uColor; varying vec3 vN; void main(){ float i = pow(0.72 - dot(vN, vec3(0.0,0.0,1.0)), 3.0); gl_FragColor = vec4(uColor, 1.0) * i * 0.45; }`,
    }),
  );
  tilt.add(atmo);

  // Sterne (drei Tiefenebenen).
  {
    const n = 1400;
    const pos = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      const r = 30 + Math.random() * 60;
      const t = Math.random() * Math.PI * 2;
      const p = Math.acos(2 * Math.random() - 1);
      pos.set([r * Math.sin(p) * Math.cos(t), r * Math.sin(p) * Math.sin(t), -Math.abs(r * Math.cos(p))], i * 3);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    scene.add(new THREE.Points(g, new THREE.PointsMaterial({ size: 0.14, map: dot, transparent: true, opacity: 0.55, depthWrite: false, color: 0xffffff })));
  }

  // Knoten + Bögen + Pulse.
  const nodeVecs = NODES.map(([, la, lo]) => latLon(la, lo, R * 1.005));
  {
    const pos = new Float32Array(nodeVecs.length * 3);
    nodeVecs.forEach((v, i) => pos.set([v.x, v.y, v.z], i * 3));
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    globe.add(new THREE.Points(g, new THREE.PointsMaterial({ size: 0.09, map: dot, color: gold, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })));
    // Hub-Halo Frankfurt
    const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: dot, color: gold, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    halo.position.copy(nodeVecs[0]);
    halo.scale.setScalar(0.3);
    globe.add(halo);
  }

  interface Arc { curve: THREE.QuadraticBezierCurve3; pulse: THREE.Sprite; speed: number; offset: number }
  const arcs: Arc[] = [];
  const pairs: Array<[number, number]> = [];
  for (let i = 1; i < NODES.length; i++) pairs.push([0, i]); // Hub-Speichen
  [[1, 14], [2, 8], [8, 9], [3, 11], [11, 12], [12, 13], [13, 19], [5, 18], [16, 17], [6, 7], [10, 2], [15, 5]].forEach((p) => pairs.push(p as [number, number]));
  const arcMat = new THREE.LineBasicMaterial({ color: gold, transparent: true, opacity: 0.38, blending: THREE.AdditiveBlending, depthWrite: false });
  pairs.forEach(([a, b], k) => {
    const va = nodeVecs[a];
    const vb = nodeVecs[b];
    const mid = va.clone().add(vb).multiplyScalar(0.5);
    const lift = 1 + Math.min(0.32, va.distanceTo(vb) * 0.22);
    mid.normalize().multiplyScalar(R * lift);
    const curve = new THREE.QuadraticBezierCurve3(va, mid, vb);
    globe.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(curve.getPoints(48)), arcMat));
    const pulse = new THREE.Sprite(new THREE.SpriteMaterial({ map: dot, color: 0xfff1c9, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    pulse.scale.setScalar(0.07);
    globe.add(pulse);
    arcs.push({ curve, pulse, speed: 0.12 + ((k * 37) % 10) / 60, offset: (k * 0.137) % 1 });
  });

  // Land-Partikel asynchron (Maske laden), danach einblenden.
  let landMat: THREE.PointsMaterial | null = null;
  void loadLandMask().then((isLand) => {
    if (disposed) return;
    const N = 42000;
    const pts: number[] = [];
    const golden = Math.PI * (3 - Math.sqrt(5));
    for (let i = 0; i < N; i++) {
      const y = 1 - (i / (N - 1)) * 2;
      const rr = Math.sqrt(1 - y * y);
      const th = golden * i;
      const lat = THREE.MathUtils.radToDeg(Math.asin(y));
      const lon = THREE.MathUtils.radToDeg(Math.atan2(Math.sin(th) * rr, Math.cos(th) * rr));
      if (isLand && !isLand(lat, lon)) continue;
      if (!isLand && i % 3) continue;
      const v = latLon(lat, lon);
      pts.push(v.x, v.y, v.z);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
    landMat = new THREE.PointsMaterial({ size: 0.034, map: dot, color: gold.clone().lerp(new THREE.Color('#ffffff'), 0.15), transparent: true, opacity: 0, depthWrite: false });
    globe.add(new THREE.Points(g, landMat));
    if (reduce) render(0);
  });

  // Größe
  const resize = () => {
    const w = canvas.clientWidth || innerWidth;
    const h = canvas.clientHeight || innerHeight;
    renderer.setSize(w, h, false);
    cam.aspect = w / h;
    // Mobil: Globus zentrierter und kleiner hinter den Text.
    const narrow = w < 820;
    rig.position.set(narrow ? 0.4 : 1.9, narrow ? -1.2 : 0.1, narrow ? -2 : -0.6);
    cam.updateProjectionMatrix();
  };
  resize();
  const ro = new ResizeObserver(resize);
  ro.observe(canvas);
  cleanups.push(() => ro.disconnect());

  // Interaktion
  const pointer = { x: 0, y: 0, tx: 0, ty: 0 };
  const onMove = (e: PointerEvent) => {
    pointer.tx = (e.clientX / innerWidth) * 2 - 1;
    pointer.ty = (e.clientY / innerHeight) * 2 - 1;
  };
  addEventListener('pointermove', onMove, { passive: true });
  cleanups.push(() => removeEventListener('pointermove', onMove));

  let visible = true;
  if (visibilityTarget && 'IntersectionObserver' in window) {
    const io = new IntersectionObserver((es) => {
      visible = es.some((e) => e.isIntersecting);
      if (visible && !raf && !reduce) raf = requestAnimationFrame(loop);
    });
    io.observe(visibilityTarget);
    cleanups.push(() => io.disconnect());
  }

  const clock = new THREE.Clock();
  let spin = 0;
  function render(t: number) {
    const scrollK = Math.min(1, scrollY / Math.max(1, innerHeight));
    pointer.x += (pointer.tx - pointer.x) * 0.05;
    pointer.y += (pointer.ty - pointer.y) * 0.05;
    globe.rotation.y = 0; // Basis bleibt Quaternion; Spin über tilt-Gruppe
    tilt.rotation.y = spin + pointer.x * 0.16;
    tilt.rotation.x = pointer.y * 0.08 - scrollK * 0.3;
    cam.position.x = pointer.x * 0.35;
    cam.position.y = -pointer.y * 0.25;
    cam.position.z = 8.6 + scrollK * 2.2;
    cam.lookAt(0, 0, 0);
    for (const a of arcs) {
      const p = (t * a.speed + a.offset) % 1;
      a.pulse.position.copy(a.curve.getPoint(p));
      (a.pulse.material as THREE.SpriteMaterial).opacity = Math.sin(p * Math.PI);
    }
    if (landMat && landMat.opacity < 0.95) landMat.opacity = reduce ? 0.95 : Math.min(0.95, landMat.opacity + 0.02);
    renderer.render(scene, cam);
  }

  function loop() {
    raf = 0;
    if (disposed) return;
    if (!visible || document.hidden) return;
    const dt = Math.min(clock.getDelta(), 0.05);
    spin = Math.sin(clock.elapsedTime * 0.06) * 0.14; // ruhiges Pendeln um Europa
    render(clock.elapsedTime);
    raf = requestAnimationFrame(loop);
    void dt;
  }

  const onVis = () => {
    if (!document.hidden && !raf && !reduce) raf = requestAnimationFrame(loop);
  };
  document.addEventListener('visibilitychange', onVis);
  cleanups.push(() => document.removeEventListener('visibilitychange', onVis));

  if (reduce) render(0);
  else raf = requestAnimationFrame(loop);

  return () => {
    disposed = true;
    cancelAnimationFrame(raf);
    cleanups.forEach((c) => c());
    scene.traverse((o) => {
      const m = o as THREE.Mesh;
      m.geometry?.dispose?.();
      const mat = m.material as THREE.Material | THREE.Material[] | undefined;
      (Array.isArray(mat) ? mat : mat ? [mat] : []).forEach((x) => x.dispose());
    });
    dot.dispose();
    renderer.dispose();
  };
}
