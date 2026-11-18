/**
 * Startseite v3 — 3D-Szene im Hero. Eigener Chunk: wird nur per
 * `import()` aus HeroStage geladen, wenn das Gerät geeignet ist und keine
 * reduzierte Bewegung gewünscht ist. Sonst bleibt das Standbild.
 *
 * Vier Figuren, je Produkt eine (Gestaltung aus dem Design-Export, vereinfacht):
 *   0 App Builder        gestapelte Flächen
 *   1 Bots & Voice       pulsierende Kugel mit Schallringen
 *   2 Optimizer          Knoten
 *   3 Governance OS      Kern mit drei Ringen
 *
 * Rendert nur, solange der Hero sichtbar und der Tab aktiv ist.
 */
import * as THREE from 'three';

export interface HeroSceneColors {
  bg: string;
  fg: string;
  fg2: string;
  fg3: string;
  line: string;
  surface: string;
}

export interface HeroSceneHandle {
  setActive(index: number): void;
  dispose(): void;
}

export function mountHeroScene(canvas: HTMLCanvasElement, colors: HeroSceneColors): HeroSceneHandle {
  const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, powerPreference: 'low-power' });
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 60);
  camera.position.set(0, 0.5, 6.2);
  camera.lookAt(0, 0, 0);

  scene.add(new THREE.HemisphereLight(0xffffff, new THREE.Color(colors.fg3), 0.6));
  const key = new THREE.DirectionalLight(0xffffff, 1.0);
  key.position.set(3, 4, 5);
  scene.add(key);
  const rim = new THREE.DirectionalLight(0xffffff, 0.6);
  rim.position.set(-4, 2, -4);
  scene.add(rim);

  const mat = (c: string, o: Partial<THREE.MeshStandardMaterialParameters> = {}) =>
    new THREE.MeshStandardMaterial({ color: new THREE.Color(c), metalness: 0.5, roughness: 0.3, ...o });

  const world = new THREE.Group();
  scene.add(world);
  const groups = [0, 1, 2, 3].map(() => {
    const g = new THREE.Group();
    world.add(g);
    return g;
  });

  // 0 App Builder
  const edge = new THREE.LineBasicMaterial({ color: new THREE.Color(colors.fg2), transparent: true, opacity: 0.7 });
  const slabs: THREE.Mesh[] = [];
  [-0.6, 0, 0.6].forEach((z, k) => {
    const geo = new THREE.BoxGeometry(1.9, 1.15, 0.05);
    const slab = new THREE.Mesh(geo, mat(k === 2 ? colors.fg : colors.surface, { metalness: 0.35 }));
    slab.position.set((k - 1) * 0.16, -(k - 1) * 0.1, z);
    slab.add(new THREE.LineSegments(new THREE.EdgesGeometry(geo), edge));
    groups[0]!.add(slab);
    slabs.push(slab);
  });
  groups[0]!.rotation.set(-0.12, 0.55, 0);

  // 1 Bots & Voice
  const sphereGeo = new THREE.SphereGeometry(0.92, 64, 48);
  const base = Float32Array.from(sphereGeo.attributes.position!.array as ArrayLike<number>);
  groups[1]!.add(new THREE.Mesh(sphereGeo, mat(colors.fg2, { metalness: 0.6, roughness: 0.22 })));
  const waves = [1.25, 1.5].map((r) => {
    const m = new THREE.Mesh(
      new THREE.TorusGeometry(r, 0.01, 8, 160),
      new THREE.MeshBasicMaterial({ color: new THREE.Color(colors.fg), transparent: true, opacity: 0.6 }),
    );
    m.rotation.x = Math.PI / 2;
    groups[1]!.add(m);
    return m;
  });

  // 2 Optimizer
  const knot = new THREE.Mesh(new THREE.TorusKnotGeometry(0.62, 0.2, 200, 24, 2, 3), mat(colors.fg, { metalness: 0.75, roughness: 0.2 }));
  groups[2]!.add(knot);

  // 3 Governance OS
  const core = new THREE.Mesh(new THREE.IcosahedronGeometry(0.42, 0), mat(colors.fg3, { flatShading: true }));
  groups[3]!.add(core);
  const rings = [0.75, 0.97, 1.2].map((r, k) => {
    const m = new THREE.Mesh(new THREE.TorusGeometry(r, 0.03, 16, 160), mat(k === 1 ? colors.fg : colors.fg2, { metalness: 0.7 }));
    m.rotation.set(k * 0.9 + 0.4, k * 0.7, 0);
    groups[3]!.add(m);
    return m;
  });

  // Boden
  const grid = new THREE.GridHelper(24, 48, new THREE.Color(colors.line), new THREE.Color(colors.surface));
  grid.position.y = -1.5;
  (grid.material as THREE.Material).transparent = true;
  (grid.material as THREE.Material).opacity = 0.45;
  scene.add(grid);

  const weights = [1, 0, 0, 0];
  let active = 0;
  let t = 0;
  let last = performance.now();
  let raf = 0;
  let visible = true;
  let disposed = false;

  const resize = () => {
    const w = Math.max(1, canvas.clientWidth);
    const h = Math.max(1, canvas.clientHeight);
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  };
  resize();
  const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(resize) : null;
  ro?.observe(canvas);

  const io =
    typeof IntersectionObserver !== 'undefined'
      ? new IntersectionObserver(([e]) => {
          visible = Boolean(e?.isIntersecting);
          if (visible) loop();
        })
      : null;
  io?.observe(canvas);

  const onVisibility = () => {
    if (!document.hidden) loop();
  };
  document.addEventListener('visibilitychange', onVisibility);

  function frame(dt: number) {
    t += dt;
    world.rotation.y = t * 0.28;
    for (let i = 0; i < 4; i++) {
      const target = i === active ? 1 : 0;
      weights[i]! += (target - weights[i]!) * Math.min(1, dt * (target ? 3.2 : 6));
      const w = weights[i]!;
      const e = w * w * (3 - 2 * w);
      const g = groups[i]!;
      g.visible = w > 0.01;
      g.scale.setScalar(Math.max(0.001, e));
      g.position.y = (1 - e) * -0.6;
    }
    if (groups[1]!.visible) {
      const pos = sphereGeo.attributes.position!;
      const a = pos.array as Float32Array;
      for (let i = 0; i < a.length; i += 3) {
        const k = 1 + 0.085 * Math.sin(7 * base[i + 1]! - t * 2.4) + 0.03 * Math.sin(5 * base[i]! + t * 1.7);
        a[i] = base[i]! * k;
        a[i + 1] = base[i + 1]! * k;
        a[i + 2] = base[i + 2]! * k;
      }
      pos.needsUpdate = true;
      sphereGeo.computeVertexNormals();
      waves.forEach((m, k) => {
        const u = (t * 0.35 + k * 0.5) % 1;
        m.scale.setScalar(0.8 + u * 0.6);
        (m.material as THREE.MeshBasicMaterial).opacity = 0.7 * (1 - u);
      });
    }
    slabs.forEach((s, k) => {
      s.position.z = (k - 1) * (0.6 + 0.12 * Math.sin(t * 0.9));
    });
    knot.rotation.set(t * 0.5, 0, t * 0.3);
    core.rotation.set(t * 0.6, t * 0.4, 0);
    rings.forEach((m, k) => {
      m.rotation.x += dt * (0.5 + k * 0.25);
      m.rotation.y += dt * (0.35 - k * 0.2);
    });
    grid.position.z = (t * 0.5) % 0.5;
    renderer.render(scene, camera);
  }

  function loop() {
    if (disposed || raf) return;
    const tick = () => {
      raf = 0;
      if (disposed || !visible || document.hidden) return;
      const now = performance.now();
      frame(Math.min(0.1, (now - last) / 1000));
      last = now;
      raf = requestAnimationFrame(tick);
    };
    last = performance.now();
    raf = requestAnimationFrame(tick);
  }
  loop();

  return {
    setActive(index: number) {
      active = ((index % 4) + 4) % 4;
    },
    dispose() {
      disposed = true;
      if (raf) cancelAnimationFrame(raf);
      ro?.disconnect();
      io?.disconnect();
      document.removeEventListener('visibilitychange', onVisibility);
      scene.traverse((o) => {
        const m = o as THREE.Mesh;
        m.geometry?.dispose?.();
        const mats = Array.isArray(m.material) ? m.material : m.material ? [m.material] : [];
        mats.forEach((x) => x.dispose());
      });
      renderer.dispose();
    },
  };
}
