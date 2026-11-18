/**
 * Voice-Agent-Seite — 3D-Assistent im Hero. Eigener Chunk: wird nur per
 * `import()` aus VoiceBotStage geladen, wenn das Gerät geeignet ist und keine
 * reduzierte Bewegung gewünscht ist (Prüfung `canRun3D`). Sonst bleibt das Standbild.
 *
 * Figur: weißer Roboter mit dunklem Visier, steigt aus einem dunklen Kasten,
 * schwebt, folgt dem Zeiger mit dem Kopf, blinzelt, winkt, springt, tanzt und
 * dreht sich. `setSpeaking(true)` bewegt Mund, Brustlicht und Kopf für eine
 * spätere Sprachausgabe; die Szene selbst spielt keinen Ton ab.
 *
 * Rendert nur, solange die Bühne sichtbar und der Tab aktiv ist.
 */
import * as THREE from 'three';

export type BotMove = 'jump' | 'dance' | 'spin';

export interface VoiceBotHandle {
  /** Bot aus dem Kasten holen (true) oder zurückschicken (false). */
  setOut(out: boolean): void;
  /** Eine Bewegung abspielen (nur wenn der Bot draußen ist). */
  play(move: BotMove): void;
  /** Sprechanimation an/aus (Anschluss für eine spätere Stimme). */
  setSpeaking(speaking: boolean): void;
  dispose(): void;
}

const ACCENT = 0x4fd1dc;
const MOVE_SECONDS: Record<BotMove, number> = { jump: 1.1, dance: 3.2, spin: 1.4 };
const MOVES: readonly BotMove[] = ['jump', 'dance', 'spin', 'jump'];

export function mountVoiceBot(canvas: HTMLCanvasElement, opts: { gridColor: string }): VoiceBotHandle {
  const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, powerPreference: 'low-power' });
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.localClippingEnabled = true;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 100);
  camera.position.set(-0.75, 3, 10.6);
  camera.lookAt(-0.75, 2.2, 0);

  scene.add(new THREE.HemisphereLight(0xffffff, 0x8a93a8, 2.2));
  const key = new THREE.DirectionalLight(0xffffff, 2.4);
  key.position.set(3.5, 7, 5);
  key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  Object.assign(key.shadow.camera, { left: -4, right: 4, top: 4, bottom: -4, near: 1, far: 20 });
  scene.add(key);
  const rim = new THREE.PointLight(ACCENT, 6, 9, 1.5);
  rim.position.set(-2.8, 3.2, -1.5);
  scene.add(rim);

  const floor = new THREE.Mesh(new THREE.PlaneGeometry(40, 40), new THREE.ShadowMaterial({ opacity: 0.16 }));
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  scene.add(floor);
  const grid = new THREE.GridHelper(40, 40, opts.gridColor, opts.gridColor);
  grid.position.y = 0.001;
  scene.add(grid);

  // Kasten (oben offen) mit leuchtender Kante
  const dark = new THREE.MeshStandardMaterial({ color: 0x0b0d12, roughness: 0.32, metalness: 0.25 });
  const KW = 2.1, KH = 0.95, KT = 0.09;
  const box = new THREE.Group();
  const walls: Array<[number, number, number, number, number, number]> = [
    [KW, KT, KW, 0, KT / 2, 0],
    [KW, KH, KT, 0, KH / 2, KW / 2 - KT / 2],
    [KW, KH, KT, 0, KH / 2, -KW / 2 + KT / 2],
    [KT, KH, KW, KW / 2 - KT / 2, KH / 2, 0],
    [KT, KH, KW, -KW / 2 + KT / 2, KH / 2, 0],
  ];
  for (const [w, h, d, x, y, z] of walls) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), dark);
    m.position.set(x, y, z);
    m.castShadow = m.receiveShadow = true;
    box.add(m);
  }
  const edgeMat = new THREE.LineBasicMaterial({ color: ACCENT, transparent: true, opacity: 0.9 });
  const edge = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(KW, 0.001, KW)), edgeMat);
  edge.position.y = KH + 0.002;
  box.add(edge);
  scene.add(box);

  // Roboter — alles unterhalb des Kastenbodens wird abgeschnitten, damit er aus dem Kasten steigt
  const clip = [new THREE.Plane(new THREE.Vector3(0, 1, 0), -KT)];
  const white = new THREE.MeshStandardMaterial({ color: 0xf3f5f9, roughness: 0.22, metalness: 0.05, clippingPlanes: clip });
  const navy = new THREE.MeshStandardMaterial({ color: 0x141c30, roughness: 0.12, metalness: 0.35, clippingPlanes: clip });
  const glowMat = new THREE.MeshBasicMaterial({ color: ACCENT, clippingPlanes: clip });
  const chestMat = glowMat.clone();
  const mesh = (g: THREE.BufferGeometry, m: THREE.Material, p?: [number, number, number], s?: [number, number, number]) => {
    const o = new THREE.Mesh(g, m);
    if (p) o.position.set(...p);
    if (s) o.scale.set(...s);
    o.castShadow = true;
    return o;
  };

  const bot = new THREE.Group();
  scene.add(bot);
  bot.add(mesh(new THREE.SphereGeometry(0.6, 48, 32), white, [0, 0.66, 0], [1, 1.1, 0.94]));
  const chest = mesh(new THREE.TorusGeometry(0.13, 0.026, 12, 40), chestMat, [0, 0.78, 0.555]);
  bot.add(chest);
  bot.add(mesh(new THREE.CylinderGeometry(0.16, 0.2, 0.18, 24), navy, [0, 1.32, 0]));

  const head = new THREE.Group();
  head.position.y = 1.86;
  bot.add(head);
  head.add(mesh(new THREE.SphereGeometry(0.6, 48, 32), white, undefined, [1.18, 0.9, 1]));
  head.add(mesh(new THREE.SphereGeometry(0.5, 48, 32), navy, [0, -0.01, 0.37], [1.12, 0.66, 0.62]));
  const eyes = [-0.18, 0.18].map((x) => {
    const e = mesh(new THREE.SphereGeometry(0.072, 20, 16), glowMat, [x, 0.03, 0.68], [1, 1.5, 0.6]);
    head.add(e);
    return e;
  });
  const mouth = mesh(new THREE.TorusGeometry(0.09, 0.018, 8, 24, Math.PI), glowMat, [0, -0.13, 0.685]);
  mouth.rotation.z = Math.PI;
  head.add(mouth);
  for (const side of [-1, 1]) {
    const ear = mesh(new THREE.CylinderGeometry(0.13, 0.13, 0.12, 28), navy, [side * 0.7, 0, 0]);
    ear.rotation.z = Math.PI / 2;
    head.add(ear);
    const ring = mesh(new THREE.TorusGeometry(0.09, 0.018, 8, 28), glowMat, [side * 0.765, 0, 0]);
    ring.rotation.y = Math.PI / 2;
    head.add(ring);
  }
  head.add(mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.34, 10), navy, [0, 0.68, 0]));
  const tip = mesh(new THREE.SphereGeometry(0.07, 16, 12), glowMat, [0, 0.88, 0]);
  head.add(tip);
  const arms = [-1, 1].map((side) => {
    const shoulder = new THREE.Group();
    shoulder.position.set(side * 0.66, 0.98, 0);
    shoulder.add(mesh(new THREE.SphereGeometry(0.17, 24, 16), white, [side * 0.1, -0.3, 0], [0.62, 1.25, 0.62]));
    bot.add(shoulder);
    return shoulder;
  });
  const leftArm = arms[0]!;
  const rightArm = arms[1]!;

  // Zustand
  const BASE = KH + 0.08, LOW = -2.4;
  let outT = 0, target = 1, waveT = 1.0, blinkIn = 1.5, nextMove = 4;
  let move: BotMove | null = null, moveT = 0, speaking = false;
  let px = 0, py = 0, hx = 0, hy = 0;
  const t0 = performance.now();
  let last = t0;

  const easeOutBack = (x: number) => 1 + 2.5 * Math.pow(x - 1, 3) + 1.5 * Math.pow(x - 1, 2);

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

    outT = Math.max(0, Math.min(1, outT + Math.sign(target - outT) * (dt / (target ? 1.3 : 0.9))));
    const k = target ? easeOutBack(outT) : outT * outT;

    if (target && outT >= 1 && !speaking && !move) {
      nextMove -= dt;
      if (nextMove < 0) {
        move = MOVES[Math.floor(Math.random() * MOVES.length)]!;
        moveT = 0;
        nextMove = 5 + Math.random() * 4;
      }
    }

    let jy = 0, sx = 0, ry = 0, squash = 1, armL = 0, armR = 0, nod = 0;
    if (move) {
      moveT += dt;
      const u = Math.min(1, moveT / MOVE_SECONDS[move]);
      if (move === 'jump') {
        if (u < 0.18) squash = 1 - 0.14 * Math.sin((u / 0.18) * Math.PI);
        else if (u < 0.82) {
          const v = (u - 0.18) / 0.64;
          jy = 0.9 * 4 * v * (1 - v);
          squash = 1 + 0.08 * Math.sin(v * Math.PI);
          armL = armR = 1.6 * Math.sin(v * Math.PI);
        } else squash = 1 - 0.1 * Math.sin(((u - 0.82) / 0.18) * Math.PI);
      } else if (move === 'dance') {
        const b = u * Math.PI * 6;
        sx = Math.sin(b / 2) * 0.32;
        ry = Math.sin(b / 2) * 0.45;
        jy = Math.abs(Math.sin(b)) * 0.18;
        squash = 1 - 0.05 * Math.abs(Math.cos(b));
        armL = 1.2 + Math.sin(b) * 0.9;
        armR = 1.2 - Math.sin(b) * 0.9;
        nod = Math.sin(b) * 0.18;
      } else {
        ry = u * Math.PI * 2;
        jy = 0.5 * Math.sin(u * Math.PI);
        armL = armR = 1.3 * Math.sin(u * Math.PI);
      }
      if (u >= 1) move = null;
    }
    if (speaking) {
      nod += Math.sin(t * 9) * 0.05 + Math.sin(t * 5.3) * 0.04;
      armR = Math.max(armR, 0.35 + 0.25 * Math.sin(t * 2.3));
    }

    const hover = Math.sin(t * 1.7) * 0.06 * outT;
    bot.position.set(sx, LOW + (BASE - LOW) * k + hover + jy, 0);
    const stretch = 1 + (1 - squash) * 0.6;
    bot.scale.set(stretch, squash, stretch);
    bot.rotation.y = (1 - outT) * 1.2 + Math.sin(t * 0.6) * 0.06 + ry;

    hx += (px * 0.5 - hx) * Math.min(1, dt * 5);
    hy += (py * 0.3 - hy) * Math.min(1, dt * 5);
    head.rotation.set(hy + nod, hx, 0);

    mouth.scale.y = speaking ? 0.6 + 0.9 * Math.abs(Math.sin(t * 13) * Math.sin(t * 7.7)) : 1;

    blinkIn -= dt;
    let lid = 1;
    if (blinkIn < 0) {
      lid = Math.abs(Math.sin(((blinkIn + 0.16) / 0.16) * Math.PI)) * 0.9 + 0.1;
      if (blinkIn < -0.16) blinkIn = 2.5 + Math.random() * 2.5;
    }
    for (const e of eyes) e.scale.y = 1.5 * lid;

    waveT += dt;
    const waving = waveT < 1.6 ? 1.9 * Math.sin((waveT / 1.6) * Math.PI) : 0;
    const wiggle = waveT < 1.6 ? Math.sin(waveT * 10) * 0.5 * Math.sin((waveT / 1.6) * Math.PI) : 0;
    rightArm.rotation.z = 0.15 + Math.max(armR, waving) + wiggle;
    leftArm.rotation.z = -0.15 - armL + Math.sin(t * 1.7) * 0.05;

    const pulse = speaking ? 0.55 + 0.45 * Math.abs(Math.sin(t * 11)) : 0.6 + 0.4 * Math.sin(t * 3);
    chestMat.color.setRGB(0.31 * pulse + 0.1, 0.82 * pulse + 0.1, 0.86 * pulse + 0.1);
    tip.scale.setScalar(0.85 + 0.25 * Math.sin(t * 4));
    edgeMat.opacity = 0.35 + 0.55 * (1 - outT) + 0.1 * Math.sin(t * 2);

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
    setOut(out) {
      target = out ? 1 : 0;
      if (out) waveT = 0;
    },
    play(m) {
      if (target && outT > 0.95) {
        move = m;
        moveT = 0;
      }
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
