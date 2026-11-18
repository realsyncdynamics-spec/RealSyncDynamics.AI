/**
 * Voice-Agent-Seite — 3D-Assistent im Hero. Eigener Chunk: wird nur per
 * `import()` aus VoiceBotStage geladen, wenn das Gerät geeignet ist und keine
 * reduzierte Bewegung gewünscht ist (Prüfung `canRun3D`). Sonst bleibt das Standbild.
 *
 * Figur nach dem Standbild der Startseite (`public/landing-v3/hero-still.jpg`):
 * weißer Roboter mit dunklem Visier, Antenne, dünnen Armen mit dunklen
 * Kugelhänden und einem Orbit-Ring mit kreisenden Kugeln. Farben im
 * Neon-Design (styles/neon-theme.css): leuchtende Cyan-Augen, Lila/Cyan-Orbit,
 * Glaswürfel mit Neon-Kanten, Lichtreflexe in Lila und Cyan.
 * Bewegungen: erscheint mit einem Hüpfer, schwebt, folgt dem Zeiger mit dem Kopf,
 * blinzelt, winkt, springt, tanzt und dreht sich. `setSpeaking(true)` bewegt Mund,
 * Brustpunkt und Kopf für eine spätere Sprachausgabe; die Szene spielt keinen Ton ab.
 *
 * Rendert nur, solange die Bühne sichtbar und der Tab aktiv ist.
 */
import * as THREE from 'three';

export type BotMove = 'jump' | 'dance' | 'spin';

export interface VoiceBotHandle {
  /** Eine Bewegung abspielen. */
  play(move: BotMove): void;
  /** Sprechanimation an/aus (Anschluss für eine spätere Stimme). */
  setSpeaking(speaking: boolean): void;
  dispose(): void;
}

// Neon-Palette wie styles/neon-theme.css (.ln-cube, .ln-orb)
const WHITE = 0xf4f6fa;
const NAVY = 0x10142a;
const CYAN = 0x67e8f9;
const CYAN_EDGE = 0xa5f3fc;
const VIOLET = 0xc084fc;
const MAGENTA = 0xf0abfc;
const MOVE_SECONDS: Record<BotMove, number> = { jump: 1.1, dance: 3.2, spin: 1.4 };
const IDLE_MOVES: readonly BotMove[] = ['jump', 'dance', 'spin', 'jump'];
const ARM_REST_RIGHT = 2.35; // erhobener Arm wie im Standbild
const ARM_REST_LEFT = -0.45;

export function mountVoiceBot(canvas: HTMLCanvasElement): VoiceBotHandle {
  const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, powerPreference: 'low-power' });
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.NoToneMapping;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 100);
  camera.position.set(0, 2.7, 9.8);
  camera.lookAt(0, 1.85, 0);

  scene.add(new THREE.HemisphereLight(0xffffff, 0xd6dde9, 2.6));
  const key = new THREE.DirectionalLight(0xffffff, 1.6);
  key.position.set(-1.5, 7, 6);
  key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  Object.assign(key.shadow.camera, { left: -3, right: 3, top: 3, bottom: -3, near: 1, far: 20 });
  scene.add(key);
  // Neon-Reflexe: Lila von links, Cyan von rechts
  const rimViolet = new THREE.PointLight(0xa855f7, 14, 10, 1.6);
  rimViolet.position.set(-2.6, 2.4, 1.6);
  scene.add(rimViolet);
  const rimCyan = new THREE.PointLight(0x22d3ee, 12, 10, 1.6);
  rimCyan.position.set(2.6, 1.8, 1.4);
  scene.add(rimCyan);

  const floor = new THREE.Mesh(new THREE.PlaneGeometry(30, 30), new THREE.ShadowMaterial({ opacity: 0.25 }));
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  scene.add(floor);
  const grid = new THREE.GridHelper(30, 60, 0x3b2a6b, 0x2a2350);
  grid.position.y = 0.001;
  (grid.material as THREE.Material).transparent = true;
  (grid.material as THREE.Material).opacity = 0.55;
  scene.add(grid);

  // Glaswürfel mit Neon-Kanten (wie .ln-cube): Kanten Cyan, Innenkante Lila, Flächen kaum sichtbar
  const cube = new THREE.Group();
  const CW = 3.3, CH = 3.6, CD = 2.6;
  const cubeGeo = new THREE.BoxGeometry(CW, CH, CD);
  const glass = new THREE.Mesh(cubeGeo, new THREE.MeshBasicMaterial({ color: 0x7c3aed, transparent: true, opacity: 0.06, depthWrite: false, side: THREE.DoubleSide }));
  cube.add(glass);
  const edgeMat = new THREE.LineBasicMaterial({ color: CYAN_EDGE, transparent: true, opacity: 0.95 });
  const magenta = new THREE.Color(MAGENTA);
  cube.add(new THREE.LineSegments(new THREE.EdgesGeometry(cubeGeo), edgeMat));
  const innerEdge = new THREE.LineSegments(
    new THREE.EdgesGeometry(new THREE.BoxGeometry(CW * 0.96, CH * 0.97, CD * 0.96)),
    new THREE.LineBasicMaterial({ color: VIOLET, transparent: true, opacity: 0.7 }),
  );
  cube.add(innerEdge);
  const back = new THREE.Mesh(
    new THREE.PlaneGeometry(CW * 0.62, CH * 0.62),
    new THREE.MeshBasicMaterial({ color: 0x22d3ee, transparent: true, opacity: 0.08, depthWrite: false }),
  );
  back.position.z = -CD / 2 + 0.02;
  cube.add(back);
  cube.position.set(0, CH / 2 + 0.01, 0);
  cube.rotation.y = 0.32;
  scene.add(cube);

  const white = new THREE.MeshStandardMaterial({ color: WHITE, roughness: 0.28, metalness: 0.02 });
  const navy = new THREE.MeshStandardMaterial({ color: NAVY, roughness: 0.15, metalness: 0.35 });
  const light = new THREE.MeshBasicMaterial({ color: CYAN });
  const chestMat = light.clone();
  const ringMat = new THREE.MeshBasicMaterial({ color: VIOLET, transparent: true, opacity: 0.95 });
  const ringMat2 = new THREE.MeshBasicMaterial({ color: CYAN, transparent: true, opacity: 0.6 });
  const mesh = (g: THREE.BufferGeometry, m: THREE.Material, p?: [number, number, number], s?: [number, number, number]) => {
    const o = new THREE.Mesh(g, m);
    if (p) o.position.set(...p);
    if (s) o.scale.set(...s);
    o.castShadow = true;
    return o;
  };

  const bot = new THREE.Group();
  scene.add(bot);

  // Körper (Ei-Form) mit hellblauem Punkt
  bot.add(mesh(new THREE.SphereGeometry(0.62, 48, 32), white, [0, 0.78, 0], [1, 1.15, 0.95]));
  const chest = mesh(new THREE.SphereGeometry(0.07, 20, 16), chestMat, [0, 0.95, 0.575], [1, 1, 0.3]);
  bot.add(chest);

  // Kopf: breit, Visier als Kapsel, Augen, Strich-Mund, Ohren, Antenne
  const head = new THREE.Group();
  head.position.y = 1.98;
  bot.add(head);
  head.add(mesh(new THREE.SphereGeometry(0.62, 48, 32), white, undefined, [1.2, 0.95, 1]));
  const visor = mesh(new THREE.CapsuleGeometry(0.19, 0.5, 8, 24), navy, [0, -0.02, 0.56], [1, 1, 0.6]);
  visor.rotation.z = Math.PI / 2;
  head.add(visor);
  const eyes = [-0.14, 0.14].map((x) => {
    const e = mesh(new THREE.SphereGeometry(0.065, 20, 16), light, [x, 0.0, 0.67], [1, 1, 0.3]);
    head.add(e);
    return e;
  });
  const mouth = mesh(new THREE.BoxGeometry(0.11, 0.026, 0.02), light, [0, -0.1, 0.672]);
  head.add(mouth);
  for (const side of [-1, 1]) {
    const ear = mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.14, 28), navy, [side * 0.74, -0.02, 0]);
    ear.rotation.z = Math.PI / 2;
    head.add(ear);
  }
  const antenna = new THREE.Group();
  antenna.position.set(0.05, 0.55, 0);
  antenna.rotation.z = -0.12;
  antenna.add(mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.42, 10), navy, [0, 0.2, 0]));
  const tip = mesh(new THREE.SphereGeometry(0.075, 18, 14), navy, [0, 0.44, 0]);
  antenna.add(tip);
  head.add(antenna);

  // Arme: dünne weiße Stäbe mit dunklen Kugelhänden
  const arms = [-1, 1].map((side) => {
    const shoulder = new THREE.Group();
    shoulder.position.set(side * 0.56, 1.2, 0);
    shoulder.add(mesh(new THREE.CylinderGeometry(0.055, 0.06, 0.62, 16), white, [0, -0.31, 0]));
    shoulder.add(mesh(new THREE.SphereGeometry(0.12, 24, 16), navy, [0, -0.66, 0]));
    bot.add(shoulder);
    return shoulder;
  });
  const leftArm = arms[0]!;
  const rightArm = arms[1]!;

  // Orbit-Ring mit kreisenden Kugeln
  const orbit = new THREE.Group();
  orbit.position.y = 0.72;
  orbit.rotation.set(1.36, 0, -0.14);
  orbit.add(new THREE.Mesh(new THREE.TorusGeometry(1.3, 0.014, 8, 160), ringMat));
  orbit.add(new THREE.Mesh(new THREE.TorusGeometry(1.36, 0.006, 6, 160), ringMat2));
  const spinner = new THREE.Group();
  orbit.add(spinner);
  [0, 2.1, 4.2].forEach((a) => {
    spinner.add(mesh(new THREE.SphereGeometry(0.15, 24, 16), white, [Math.cos(a) * 1.3, Math.sin(a) * 1.3, 0]));
    spinner.add(mesh(new THREE.SphereGeometry(0.045, 12, 10), light, [Math.cos(a) * 1.3, Math.sin(a) * 1.3, 0.15]));
  });
  bot.add(orbit);

  // Zustand
  const BASE = 0.32;
  let appear = 0, waveT = 0.6, blinkIn = 1.5, nextMove = 4;
  let move: BotMove | null = null, moveT = 0, speaking = false;
  let px = 0, py = 0, hx = 0, hy = 0;
  const t0 = performance.now();
  let last = t0;

  const easeOutBack = (x: number) => 1 + 2.7 * Math.pow(x - 1, 3) + 1.7 * Math.pow(x - 1, 2);

  const onPointer = (e: PointerEvent) => {
    const r = canvas.getBoundingClientRect();
    if (!r.width || !r.height) return;
    px = Math.max(-1, Math.min(1, ((e.clientX - r.left) / r.width) * 2 - 1));
    py = Math.max(-1, Math.min(1, ((e.clientY - r.top) / r.height) * 2 - 1));
  };
  window.addEventListener('pointermove', onPointer, { passive: true });

  function frame(now: number) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    const t = (now - t0) / 1000;

    appear = Math.min(1, appear + dt / 0.9);
    const grow = Math.max(0.001, easeOutBack(appear));

    if (appear >= 1 && !speaking && !move) {
      nextMove -= dt;
      if (nextMove < 0) {
        move = IDLE_MOVES[Math.floor(Math.random() * IDLE_MOVES.length)]!;
        moveT = 0;
        nextMove = 5 + Math.random() * 4;
      }
    }

    let jy = 0, sx = 0, ry = 0, squash = 1, armL = 0, armR = 0, nod = 0;
    if (move) {
      moveT += dt;
      const u = Math.min(1, moveT / MOVE_SECONDS[move]);
      if (move === 'jump') {
        if (u < 0.18) squash = 1 - 0.12 * Math.sin((u / 0.18) * Math.PI);
        else if (u < 0.82) {
          const v = (u - 0.18) / 0.64;
          jy = 0.6 * 4 * v * (1 - v);
          squash = 1 + 0.06 * Math.sin(v * Math.PI);
          armL = -1.4 * Math.sin(v * Math.PI);
          armR = 0.3 * Math.sin(v * Math.PI);
        } else squash = 1 - 0.08 * Math.sin(((u - 0.82) / 0.18) * Math.PI);
      } else if (move === 'dance') {
        const b = u * Math.PI * 6;
        sx = Math.sin(b / 2) * 0.28;
        ry = Math.sin(b / 2) * 0.4;
        jy = Math.abs(Math.sin(b)) * 0.14;
        squash = 1 - 0.04 * Math.abs(Math.cos(b));
        armL = -1.1 - Math.sin(b) * 0.7;
        armR = -0.6 + Math.sin(b) * 0.6;
        nod = Math.sin(b) * 0.16;
      } else {
        ry = u * Math.PI * 2;
        jy = 0.4 * Math.sin(u * Math.PI);
        armL = -1.2 * Math.sin(u * Math.PI);
      }
      if (u >= 1) move = null;
    }
    if (speaking) nod += Math.sin(t * 9) * 0.05 + Math.sin(t * 5.3) * 0.04;

    const hover = Math.sin(t * 1.6) * 0.06;
    bot.position.set(sx, BASE + hover + jy, 0);
    const stretch = 1 + (1 - squash) * 0.6;
    bot.scale.set(grow * stretch, grow * squash, grow * stretch);
    bot.rotation.y = -0.18 + Math.sin(t * 0.5) * 0.06 + ry;

    hx += (px * 0.5 - hx) * Math.min(1, dt * 5);
    hy += (py * 0.3 - hy) * Math.min(1, dt * 5);
    head.rotation.set(hy + nod, hx, -0.04);

    mouth.scale.set(speaking ? 0.7 + 0.3 * Math.abs(Math.sin(t * 6)) : 1, speaking ? 1 + 3 * Math.abs(Math.sin(t * 13) * Math.sin(t * 7.7)) : 1, 1);

    blinkIn -= dt;
    let lid = 1;
    if (blinkIn < 0) {
      lid = Math.abs(Math.sin(((blinkIn + 0.16) / 0.16) * Math.PI)) * 0.9 + 0.1;
      if (blinkIn < -0.16) blinkIn = 2.5 + Math.random() * 2.5;
    }
    for (const e of eyes) e.scale.y = lid;

    waveT += dt;
    const wave = waveT < 1.8 ? Math.sin(waveT * 9) * 0.35 * Math.sin((waveT / 1.8) * Math.PI) : 0;
    rightArm.rotation.z = ARM_REST_RIGHT + armR + wave + Math.sin(t * 1.6) * 0.04;
    leftArm.rotation.z = ARM_REST_LEFT + armL + Math.sin(t * 1.6 + 1) * 0.04;

    spinner.rotation.z = t * 0.6;
    const pulse = speaking ? 0.6 + 0.4 * Math.abs(Math.sin(t * 11)) : 0.85 + 0.15 * Math.sin(t * 3);
    chestMat.color.setHex(CYAN).multiplyScalar(pulse);
    edgeMat.color.setHex(CYAN_EDGE).lerp(magenta, 0.5 + 0.5 * Math.sin(t * 0.8));
    cube.rotation.y = 0.32 + Math.sin(t * 0.25) * 0.08;
    tip.scale.setScalar(1 + 0.12 * Math.sin(t * 4));

    renderer.render(scene, camera);
  }

  // Größe, Sichtbarkeit, Schleife
  const resize = () => {
    const w = canvas.clientWidth, h = canvas.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.fov = w < 420 ? 36 : 30;
    camera.updateProjectionMatrix();
  };
  const ro = new ResizeObserver(resize);
  ro.observe(canvas);
  resize();

  let visible = true, raf = 0;
  const loop = (now: number) => {
    frame(now);
    if (visible && !document.hidden) raf = requestAnimationFrame(loop);
  };
  const restart = () => {
    cancelAnimationFrame(raf);
    if (visible && !document.hidden) {
      last = performance.now();
      raf = requestAnimationFrame(loop);
    }
  };
  const io = new IntersectionObserver(([entry]) => {
    visible = Boolean(entry?.isIntersecting);
    restart();
  });
  io.observe(canvas);
  document.addEventListener('visibilitychange', restart);
  restart();

  return {
    play(m) {
      if (appear < 1) return;
      move = m;
      moveT = 0;
      if (m === 'jump') waveT = 0;
    },
    setSpeaking(s) {
      speaking = s;
      if (s) move = null;
    },
    dispose() {
      cancelAnimationFrame(raf);
      io.disconnect();
      ro.disconnect();
      document.removeEventListener('visibilitychange', restart);
      window.removeEventListener('pointermove', onPointer);
      scene.traverse((o) => {
        const m = o as THREE.Mesh;
        m.geometry?.dispose?.();
        const mat = m.material as THREE.Material | THREE.Material[] | undefined;
        if (Array.isArray(mat)) mat.forEach((x) => x.dispose());
        else mat?.dispose?.();
      });
      renderer.dispose();
    },
  };
}
