/**
 * 3D-Orbit der Startseite v8 („Ein System. Alles im Einklang.").
 *
 * Nachbau der Hero-Grafik aus dem Owner-Entwurf vom 09.11.2026: ein weißer
 * Stern mit Halo und Lichtstreifen, flache Bahnen in einer leicht geneigten
 * Ebene, eine steil gekippte Bahn, eine weite, schwache Außenbahn, Lichtpunkte
 * auf den Bahnen und ein dünnes Sternfeld.
 *
 * Bewegung: Lichtpunkte laufen auf ihren Bahnen, die steile Bahn dreht sich
 * langsam im Raum (ihre Ellipse atmet), das System präzediert minimal, der
 * Halo pulsiert, die Kamera folgt der Maus um wenige Zehntel.
 *
 * - Transparenter Canvas: der Seitenhintergrund kommt aus dem CSS.
 * - Reduced Motion: ein ruhendes Bild, keine Schleife.
 * - Verborgener Tab: keine Frames.
 * - Ohne WebGL wirft der Renderer; der Aufrufer zeigt dann den CSS-Fallback.
 */
import * as THREE from 'three';

export interface OrbitSceneOptions {
  canvas: HTMLCanvasElement;
  /** Element, dessen Größe den Canvas bestimmt. */
  container: HTMLElement;
}

const CAM_Z = 40;

const seeded = (seed: number) => {
  let s = seed;
  return () => (s = (s * 16807) % 2147483647) / 2147483647;
};

/** Radialer Verlauf als Textur für Stern, Halo und Lichtpunkte. */
function glowTexture(stops: Array<[number, string]>, w = 256, h = 256): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const g = c.getContext('2d')!;
  const grad = g.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, Math.min(w, h) / 2);
  for (const [o, col] of stops) grad.addColorStop(o, col);
  g.fillStyle = grad;
  g.fillRect(0, 0, w, h);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** Horizontaler Lichtstreifen (anamorphotischer Flare). */
function streakTexture(): THREE.CanvasTexture {
  const w = 512;
  const h = 32;
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const g = c.getContext('2d')!;
  const gx = g.createLinearGradient(0, 0, w, 0);
  gx.addColorStop(0, 'rgba(255,255,255,0)');
  gx.addColorStop(0.5, 'rgba(255,255,255,1)');
  gx.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gx;
  g.fillRect(0, 0, w, h);
  // vertikal ausblenden
  g.globalCompositeOperation = 'destination-in';
  const gy = g.createLinearGradient(0, 0, 0, h);
  gy.addColorStop(0, 'rgba(0,0,0,0)');
  gy.addColorStop(0.5, 'rgba(0,0,0,1)');
  gy.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = gy;
  g.fillRect(0, 0, w, h);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function ringGeometry(radius: number, segments = 256): THREE.BufferGeometry {
  const pts: number[] = [];
  for (let i = 0; i < segments; i++) {
    const a = (i / segments) * Math.PI * 2;
    pts.push(Math.cos(a) * radius, Math.sin(a) * radius, 0);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
  return geo;
}

/**
 * Eine Bahn aus mehreren eng liegenden Linien — WebGL zeichnet Linien immer
 * 1 px breit; die Staffelung ergibt den weichen Glanz der Vorlage.
 */
function softRing(radius: number, opacity: number, spread = 0.035, layers = 3): THREE.Group {
  const g = new THREE.Group();
  for (let i = 0; i < layers; i++) {
    const off = (i - (layers - 1) / 2) * spread;
    const falloff = layers === 1 ? 1 : 1 - Math.abs(off) / (spread * layers);
    const mat = new THREE.LineBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: opacity * falloff,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    g.add(new THREE.LineLoop(ringGeometry(radius + off), mat));
  }
  return g;
}

export function mountOrbitScene({ canvas, container }: OrbitSceneOptions): () => void {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'low-power' });
  renderer.setClearColor(0x000000, 0);
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const scene = new THREE.Scene();
  const cam = new THREE.PerspectiveCamera(15, 1, 0.1, 400);
  // Tele-Perspektive: flache Ellipsen ohne verzerrte Vorderkante (wie im Entwurf).
  cam.position.set(0, 0, CAM_Z);

  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const disposables: Array<{ dispose: () => void }> = [];
  const track = <T extends { dispose: () => void }>(o: T) => (disposables.push(o), o);

  // ── Bahnsystem: flache Ebene, ~11° zur Kamera geneigt ────────────────────
  const system = new THREE.Group();
  scene.add(system);

  const plane = new THREE.Group();
  plane.rotation.x = Math.PI / 2 - 0.19;
  system.add(plane);

  plane.add(softRing(3.92, 0.85, 0.03, 4)); // helle Hauptbahn
  plane.add(softRing(3.62, 0.35, 0.03, 2));
  plane.add(softRing(3.2, 0.5, 0.03, 3));
  plane.add(softRing(2.35, 0.22, 0.03, 2));
  plane.add(softRing(1.55, 0.3, 0.02, 2));

  // weite Außenbahn, leicht verdreht (läuft links unten nach rechts oben)
  const outer = new THREE.Group();
  outer.rotation.z = 0.1;
  const outerPlane = new THREE.Group();
  outerPlane.rotation.x = Math.PI / 2 - 0.17;
  outerPlane.add(softRing(11.6, 0.1, 0.05, 3));
  outerPlane.add(softRing(10.6, 0.04, 0.05, 2));
  outer.add(outerPlane);
  system.add(outer);

  // zweite, leicht gekippte Bahn (überlagert die Hauptbahn)
  const tilt = new THREE.Group();
  tilt.rotation.z = -0.08;
  const tiltPlane = new THREE.Group();
  tiltPlane.rotation.x = Math.PI / 2 - 0.34;
  tiltPlane.add(softRing(2.75, 0.28, 0.03, 2));
  tilt.add(tiltPlane);
  system.add(tilt);

  // steile Bahn — fast hochkant, dreht sich langsam um ihre Achse
  const steep = new THREE.Group();
  steep.rotation.z = 0.98;
  const steepSpin = new THREE.Group();
  const steepPlane = new THREE.Group();
  steepPlane.rotation.x = Math.PI / 2 - 0.26;
  steepPlane.add(softRing(2.25, 0.6, 0.03, 3));
  steepPlane.add(softRing(1.95, 0.22, 0.03, 2));
  steepSpin.add(steepPlane);
  steep.add(steepSpin);
  system.add(steep);

  // ── Stern ────────────────────────────────────────────────────────────────
  const coreTex = track(
    glowTexture([
      [0, 'rgba(255,255,255,1)'],
      [0.18, 'rgba(255,255,255,1)'],
      [0.32, 'rgba(255,255,255,0.55)'],
      [0.6, 'rgba(255,255,255,0.08)'],
      [1, 'rgba(255,255,255,0)'],
    ]),
  );
  const haloTex = track(
    glowTexture([
      [0, 'rgba(255,255,255,0.55)'],
      [0.25, 'rgba(255,255,255,0.16)'],
      [0.6, 'rgba(255,255,255,0.03)'],
      [1, 'rgba(255,255,255,0)'],
    ]),
  );
  const sprite = (tex: THREE.Texture, opacity: number) =>
    new THREE.Sprite(
      track(
        new THREE.SpriteMaterial({
          map: tex,
          transparent: true,
          opacity,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
          depthTest: false,
        }),
      ),
    );

  const core = sprite(coreTex, 1);
  core.scale.set(3.1, 3.1, 1);
  const halo = sprite(haloTex, 0.9);
  halo.scale.set(8, 8, 1);
  const streakTex = track(streakTexture());
  const streakH = sprite(streakTex, 0.85);
  streakH.scale.set(7.5, 0.18, 1);
  const streakH2 = sprite(streakTex, 0.18);
  streakH2.scale.set(11, 0.4, 1);
  const streakV = sprite(streakTex, 0.35);
  streakV.scale.set(3.2, 0.12, 1);
  streakV.material.rotation = Math.PI / 2;
  for (const s of [halo, streakH2, streakH, streakV, core]) scene.add(s);

  // ── Lichtpunkte auf den Bahnen ───────────────────────────────────────────
  const dotTex = track(
    glowTexture([
      [0, 'rgba(255,255,255,1)'],
      [0.3, 'rgba(255,255,255,0.6)'],
      [1, 'rgba(255,255,255,0)'],
    ], 64, 64),
  );
  interface Mover {
    sprite: THREE.Sprite;
    parent: THREE.Object3D;
    radius: number;
    speed: number;
    phase: number;
  }
  const movers: Mover[] = [];
  const addMover = (parent: THREE.Object3D, radius: number, speed: number, phase: number, size: number, opacity: number) => {
    const s = sprite(dotTex, opacity);
    s.scale.set(size, size, 1);
    parent.add(s);
    movers.push({ sprite: s, parent, radius, speed, phase });
  };
  addMover(plane, 3.92, 0.11, 0.4, 0.32, 0.95);
  addMover(plane, 3.2, -0.07, 2.6, 0.22, 0.8);
  addMover(plane, 2.35, 0.16, 4.4, 0.16, 0.7);
  addMover(steepPlane, 2.25, 0.13, 1.2, 0.24, 0.85);
  addMover(outerPlane, 11.6, 0.018, 3.6, 0.26, 0.6);

  // ── Sternfeld ────────────────────────────────────────────────────────────
  const rnd = seeded(1109);
  const starCount = 260;
  const pos = new Float32Array(starCount * 3);
  const col = new Float32Array(starCount * 3);
  for (let i = 0; i < starCount; i++) {
    pos[i * 3] = (rnd() - 0.5) * 44;
    pos[i * 3 + 1] = (rnd() - 0.5) * 18;
    pos[i * 3 + 2] = -4 - rnd() * 14;
    const b = 0.25 + rnd() * 0.6;
    col[i * 3] = col[i * 3 + 1] = col[i * 3 + 2] = b;
  }
  const starGeo = track(new THREE.BufferGeometry());
  starGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  starGeo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const starMat = track(
    new THREE.PointsMaterial({
      size: 0.07,
      map: dotTex,
      vertexColors: true,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }),
  );
  const stars = new THREE.Points(starGeo, starMat);
  scene.add(stars);

  // ── Größe, Maus, Schleife ───────────────────────────────────────────────
  const resize = () => {
    const w = Math.max(1, container.clientWidth);
    const h = Math.max(1, container.clientHeight);
    renderer.setSize(w, h, false);
    cam.aspect = w / h;
    // schmale Viewports: weiter zurück, damit die Hauptbahn ins Bild passt
    const fit = Math.max(1, 8.6 / (2 * CAM_Z * Math.tan((7.5 * Math.PI) / 180) * cam.aspect));
    cam.position.z = CAM_Z * fit;
    cam.updateProjectionMatrix();
  };
  resize();
  const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(resize) : null;
  ro?.observe(container);
  if (!ro) addEventListener('resize', resize);

  const pointer = { x: 0, y: 0, tx: 0, ty: 0 };
  const onMove = (e: PointerEvent) => {
    pointer.tx = e.clientX / innerWidth - 0.5;
    pointer.ty = e.clientY / innerHeight - 0.5;
  };
  addEventListener('pointermove', onMove, { passive: true });

  const t0 = performance.now();
  const frame = (now: number) => {
    const t = (now - t0) / 1000;
    pointer.x += (pointer.tx - pointer.x) * 0.04;
    pointer.y += (pointer.ty - pointer.y) * 0.04;
    cam.position.x = pointer.x * 2.2;
    cam.position.y = -pointer.y * 1.4;
    cam.lookAt(0, 0, 0);

    system.rotation.z = Math.sin(t * 0.12) * 0.03;
    system.rotation.y = Math.sin(t * 0.09) * 0.05;
    steepSpin.rotation.y = t * 0.18;
    for (const m of movers) {
      const a = m.phase + t * m.speed * Math.PI * 2 * 0.25;
      m.sprite.position.set(Math.cos(a) * m.radius, Math.sin(a) * m.radius, 0);
    }
    const pulse = 1 + Math.sin(t * 1.3) * 0.04;
    halo.scale.set(8 * pulse, 8 * pulse, 1);
    core.scale.set(3.1 * (1 + Math.sin(t * 2.1) * 0.015), 3.1 * (1 + Math.sin(t * 2.1) * 0.015), 1);
    stars.rotation.z = t * 0.004;
    renderer.render(scene, cam);
  };

  let raf = 0;
  const loop = (now: number) => {
    raf = requestAnimationFrame(loop);
    if (document.hidden) return;
    frame(now);
  };
  if (reduce) frame(t0 + 4000);
  else raf = requestAnimationFrame(loop);

  return () => {
    cancelAnimationFrame(raf);
    removeEventListener('pointermove', onMove);
    if (ro) ro.disconnect();
    else removeEventListener('resize', resize);
    scene.traverse((o) => {
      if (o instanceof THREE.Line || o instanceof THREE.Points) {
        o.geometry.dispose();
        (o.material as THREE.Material).dispose();
      }
    });
    for (const d of disposables) d.dispose();
    renderer.dispose();
  };
}
