/**
 * Landing v9 — 3D-Logo „RealSync Dynamics & AI“ (three.js, eigener Chunk, lazy).
 *
 * Zwei ineinandergreifende Ringe aus gebürstetem Titan („Real“ + „Sync“).
 * Reflexe aus einer kleinen Studio-Umgebung (PMREM aus Leuchtflächen),
 * keine externen Texturen — CSP-konform, kein Netzwerkzugriff.
 *
 * Bewegung: einmaliges Eindrehen beim Laden, danach langsames Schweben und
 * leichte Zeiger-Neigung (nur Hover-Geräte). `prefers-reduced-motion` →
 * ein einziges statisches Bild. Rendern pausiert außerhalb des Viewports
 * und bei verstecktem Tab.
 */
import * as THREE from 'three';

interface MountOptions {
  canvas: HTMLCanvasElement;
  /** Element, dessen Größe die Zeichenfläche bestimmt und dessen Sichtbarkeit das Rendern steuert. */
  container: HTMLElement;
}

const INTRO_MS = 2600;
const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);

export function mountLogoRings({ canvas, container }: MountOptions): () => void {
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const hover = matchMedia('(hover: hover)').matches;

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.1;
  renderer.setClearColor(0x000000, 0);

  // Studio-Umgebung: dunkler Raum, drei Leuchtflächen (eine kühl-blau).
  const env = new THREE.Scene();
  const envGeos: THREE.BufferGeometry[] = [];
  const envMats: THREE.Material[] = [];
  const roomGeo = new THREE.BoxGeometry(20, 20, 20);
  const roomMat = new THREE.MeshBasicMaterial({ color: 0x07090c, side: THREE.BackSide });
  envGeos.push(roomGeo);
  envMats.push(roomMat);
  env.add(new THREE.Mesh(roomGeo, roomMat));
  const softbox = (w: number, h: number, color: number, k: number, pos: [number, number, number]) => {
    const geo = new THREE.PlaneGeometry(w, h);
    const mat = new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(k), side: THREE.DoubleSide });
    envGeos.push(geo);
    envMats.push(mat);
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(...pos);
    mesh.lookAt(0, 0, 0);
    env.add(mesh);
  };
  softbox(10, 3, 0xffffff, 4.0, [0, 8, 2]);
  softbox(2, 9, 0xffffff, 2.6, [-8, 1, 3]);
  softbox(2, 9, 0xa9c2ff, 1.8, [8, 0, 2]);
  softbox(9, 1.2, 0xffffff, 1.4, [0, -2, -8]);
  const pmrem = new THREE.PMREMGenerator(renderer);
  const envTarget = pmrem.fromScene(env, 0.025);
  envGeos.forEach((g) => g.dispose());
  envMats.forEach((m) => m.dispose());

  const scene = new THREE.Scene();
  scene.environment = envTarget.texture;

  const titanium = new THREE.MeshPhysicalMaterial({
    color: 0xd3d7dd,
    metalness: 1,
    roughness: 0.24,
    clearcoat: 0.5,
    clearcoatRoughness: 0.18,
    envMapIntensity: 1.15,
  });
  const graphite = new THREE.MeshPhysicalMaterial({
    color: 0x8a9099,
    metalness: 1,
    roughness: 0.32,
    clearcoat: 0.4,
    clearcoatRoughness: 0.25,
  });

  const ringGeo = new THREE.TorusGeometry(1, 0.11, 64, 256);
  const ringA = new THREE.Mesh(ringGeo, titanium);
  ringA.position.x = -0.5;
  const ringB = new THREE.Mesh(ringGeo, graphite);
  ringB.position.x = 0.5;
  ringB.rotation.x = Math.PI / 2;
  const logo = new THREE.Group();
  logo.add(ringA, ringB);
  scene.add(logo);

  const camera = new THREE.PerspectiveCamera(28, 1, 0.1, 100);
  const halfFovTan = Math.tan(THREE.MathUtils.degToRad(14));

  const resize = () => {
    const w = Math.max(1, container.clientWidth);
    const h = Math.max(1, container.clientHeight);
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    // Logo (~3,9 Einheiten breit inkl. Rand) passt immer in die Breite.
    camera.position.set(0, 0, Math.max(5.8, 3.9 / (2 * halfFovTan * camera.aspect)));
    camera.updateProjectionMatrix();
  };

  const pointer = { x: 0, y: 0, tx: 0, ty: 0 };
  const onPointer = (e: PointerEvent) => {
    pointer.tx = e.clientX / window.innerWidth - 0.5;
    pointer.ty = e.clientY / window.innerHeight - 0.5;
  };

  const pose = (ms: number) => {
    const e = easeOut(Math.min(1, ms / INTRO_MS));
    const drift = Math.max(0, ms - INTRO_MS) / 1000;
    pointer.x += (pointer.tx - pointer.x) * 0.05;
    pointer.y += (pointer.ty - pointer.y) * 0.05;
    logo.rotation.y = -1.9 * (1 - e) + 0.55 + Math.sin(drift * 0.22) * 0.32 + pointer.x * 0.35;
    logo.rotation.x = 0.28 * e + 0.5 * (1 - e) + Math.sin(drift * 0.17) * 0.05 + pointer.y * 0.2;
    logo.rotation.z = -0.12 * e;
    logo.scale.setScalar(0.82 + 0.18 * e);
  };

  let raf = 0;
  let start: number | null = null;
  let visible = true;
  const frame = (ts: number) => {
    if (start === null) start = ts;
    pose(ts - start);
    renderer.render(scene, camera);
    raf = visible && !document.hidden ? requestAnimationFrame(frame) : 0;
  };
  const resume = () => {
    if (!reduce && !raf && visible && !document.hidden) raf = requestAnimationFrame(frame);
  };

  const renderStatic = () => {
    pose(INTRO_MS);
    renderer.render(scene, camera);
  };

  resize();
  if (reduce) {
    renderStatic();
  } else {
    pose(0);
    renderer.render(scene, camera);
    resume();
  }

  const ro = new ResizeObserver(() => {
    resize();
    if (reduce) renderStatic();
  });
  ro.observe(container);

  const io = new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting;
    if (visible) resume();
  });
  io.observe(container);

  const onVisibility = () => resume();
  document.addEventListener('visibilitychange', onVisibility);
  if (!reduce && hover) window.addEventListener('pointermove', onPointer, { passive: true });

  return () => {
    cancelAnimationFrame(raf);
    ro.disconnect();
    io.disconnect();
    document.removeEventListener('visibilitychange', onVisibility);
    window.removeEventListener('pointermove', onPointer);
    ringGeo.dispose();
    titanium.dispose();
    graphite.dispose();
    envTarget.dispose();
    pmrem.dispose();
    renderer.dispose();
  };
}
