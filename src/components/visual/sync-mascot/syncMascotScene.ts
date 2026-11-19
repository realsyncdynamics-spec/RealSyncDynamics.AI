/**
 * SYNC — 3D-Bühne für das Maskottchen (Route /sync).
 *
 * Eigener Chunk: wird nur per `import()` aus `src/pages/SyncMascot.tsx` geladen.
 * Bildet das Verhalten der Vorlage (model-viewer) mit three direkt nach:
 *   camera-orbit="20deg 79deg auto" · field-of-view="32deg"
 *   neutrale Umgebungsbeleuchtung · Ziehen dreht · Mausrad zoomt · touch-action pan-y
 *   Animation `Scene` (Winken) genau einmal, Ende über das `finished`-Event.
 *
 * Abweichend von der Vorlage steht SYNC auf einer weißen Hochglanz-Bühne: weicher
 * Kontaktschatten unter dem Modell, Belichtung für hellen Grund (EXPOSURE).
 *
 * Gerendert wird nur bei Bedarf (Kamera bewegt, Animation läuft, Größe geändert)
 * und nur, solange die Bühne sichtbar und der Tab aktiv ist.
 */
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';

export interface SyncMascotOptions {
  /** URL der GLB-Datei. */
  src: string;
  /** Modell ist geladen und das erste Bild steht. */
  onLoad(): void;
  /** WebGL fehlt oder das Modell konnte nicht geladen werden. */
  onError(): void;
  /** Die Winken-Animation ist einmal durchgelaufen. */
  onWaveFinished(): void;
}

export interface SyncMascotHandle {
  /** Spielt das Winken von vorn genau einmal. `false`, solange kein Modell geladen ist. */
  wave(): boolean;
  dispose(): void;
}

const FOV_DEG = 32;
const ORBIT_THETA = THREE.MathUtils.degToRad(20);
const ORBIT_PHI = THREE.MathUtils.degToRad(79);
/** Wie model-viewer: nicht ganz bis über den Kopf bzw. unter die Füße. */
const MIN_POLAR = THREE.MathUtils.degToRad(22.5);
const MAX_POLAR = THREE.MathUtils.degToRad(157.5);
const MIN_ZOOM_FACTOR = 0.45;
const KEY_ROTATE_STEP = THREE.MathUtils.degToRad(10);
const KEY_ZOOM_STEP = 0.9;
const WAVE_CLIP = 'Scene';
/** Vorlage: 1.15 auf dunklem Grund. Auf Weiß etwas tiefer, damit das Petrol satt bleibt. */
const EXPOSURE = 1.0;
const SHADOW_OPACITY = 0.3;
/** Luft um die Hüllkugel: Beim Winken neigt sich der Kopf aus der Ruhe-Box, unten steht der Hinweistext. */
const FRAMING_MARGIN = 1.2;

export function mountSyncMascot(canvas: HTMLCanvasElement, options: SyncMascotOptions): SyncMascotHandle {
  const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
  renderer.setClearColor(0x000000, 0);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.NeutralToneMapping;
  renderer.toneMappingExposure = EXPOSURE;

  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  const room = new RoomEnvironment();
  const envTarget = pmrem.fromScene(room, 0.04);
  scene.environment = envTarget.texture;

  const camera = new THREE.PerspectiveCamera(FOV_DEG, 1, 0.01, 100);
  const controls = new OrbitControls(camera, canvas);
  controls.enablePan = false;
  controls.enableDamping = true;
  controls.dampingFactor = 0.1;
  controls.minPolarAngle = MIN_POLAR;
  controls.maxPolarAngle = MAX_POLAR;
  // OrbitControls setzt `touch-action: none`. Wie in der Vorlage bleibt
  // vertikales Scrollen der Seite über der Bühne möglich.
  canvas.style.touchAction = 'pan-y';

  let disposed = false;
  let dirty = true;
  let frame = 0;
  let visible = true;
  let model: THREE.Object3D | null = null;
  let mixer: THREE.AnimationMixer | null = null;
  let waveAction: THREE.AnimationAction | null = null;
  let waving = false;
  let shadow: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial> | null = null;
  /** Radius der Hüllkugel um die Mitte des Modells; 0, solange nichts geladen ist. */
  let radius = 0;
  let idealDistance = 0;
  /** Zeitstempel des letzten Bildes; 0 = Zeitmessung neu ansetzen (nach Pause oder Start). */
  let lastTime = 0;
  const spherical = new THREE.Spherical();
  const offset = new THREE.Vector3();

  /** Abstand, bei dem die Hüllkugel in Höhe und Breite ins Bild passt (model-viewer „auto“). */
  const computeIdealDistance = () => {
    const halfV = THREE.MathUtils.degToRad(FOV_DEG / 2);
    const halfH = Math.atan(Math.tan(halfV) * camera.aspect);
    return (radius / Math.sin(Math.min(halfV, halfH))) * FRAMING_MARGIN;
  };

  const applyLimits = () => {
    controls.maxDistance = idealDistance;
    controls.minDistance = idealDistance * MIN_ZOOM_FACTOR;
    camera.near = Math.max(0.01, idealDistance / 100);
    camera.far = idealDistance * 10;
    camera.updateProjectionMatrix();
  };

  const resize = () => {
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    if (width === 0 || height === 0) return;
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    if (radius > 0) {
      // Zoomstufe erhalten: Abstand im selben Verhältnis zum neuen Idealabstand.
      const previous = idealDistance;
      idealDistance = computeIdealDistance();
      offset.copy(camera.position).sub(controls.target);
      offset.multiplyScalar(idealDistance / previous);
      applyLimits();
      camera.position.copy(controls.target).add(offset);
    }
    dirty = true;
  };

  /** Dreht bzw. zoomt die Kamera um einen festen Schritt (Tastatur). */
  const nudge = (dTheta: number, dPhi: number, zoom: number) => {
    if (radius === 0) return;
    offset.copy(camera.position).sub(controls.target);
    spherical.setFromVector3(offset);
    spherical.theta += dTheta;
    spherical.phi = THREE.MathUtils.clamp(spherical.phi + dPhi, MIN_POLAR, MAX_POLAR);
    spherical.radius = THREE.MathUtils.clamp(spherical.radius * zoom, controls.minDistance, controls.maxDistance);
    offset.setFromSpherical(spherical);
    camera.position.copy(controls.target).add(offset);
    dirty = true;
  };

  const onKeyDown = (event: KeyboardEvent) => {
    if (event.altKey || event.ctrlKey || event.metaKey) return;
    switch (event.key) {
      case 'ArrowLeft': nudge(-KEY_ROTATE_STEP, 0, 1); break;
      case 'ArrowRight': nudge(KEY_ROTATE_STEP, 0, 1); break;
      case 'ArrowUp': nudge(0, -KEY_ROTATE_STEP, 1); break;
      case 'ArrowDown': nudge(0, KEY_ROTATE_STEP, 1); break;
      case '+': case 'PageUp': nudge(0, 0, KEY_ZOOM_STEP); break;
      case '-': case 'PageDown': nudge(0, 0, 1 / KEY_ZOOM_STEP); break;
      default: return;
    }
    event.preventDefault();
  };
  canvas.addEventListener('keydown', onKeyDown);

  const tick = (now: number) => {
    frame = 0;
    if (disposed) return;
    const delta = lastTime ? Math.min(0.1, (now - lastTime) / 1000) : 0;
    lastTime = now;
    if (waving && mixer) {
      mixer.update(delta);
      dirty = true;
    }
    if (controls.update()) dirty = true;
    if (dirty) {
      dirty = false;
      renderer.render(scene, camera);
    }
    schedule();
  };
  const schedule = () => {
    if (!disposed && frame === 0 && visible && !document.hidden) {
      frame = requestAnimationFrame(tick);
    }
  };

  const onVisibility = () => {
    lastTime = 0; // Pause nicht als Zeitsprung in die Animation geben
    schedule();
  };
  document.addEventListener('visibilitychange', onVisibility);

  const resizeObserver = typeof ResizeObserver === 'function' ? new ResizeObserver(resize) : null;
  resizeObserver?.observe(canvas);
  const intersectionObserver =
    typeof IntersectionObserver === 'function'
      ? new IntersectionObserver((entries) => {
          visible = entries.some((entry) => entry.isIntersecting);
          onVisibility();
        })
      : null;
  intersectionObserver?.observe(canvas);

  const onFinished = () => {
    if (disposed || !waving) return;
    waving = false;
    dirty = true;
    options.onWaveFinished();
  };

  new GLTFLoader().load(
    options.src,
    (gltf) => {
      if (disposed) {
        disposeObject(gltf.scene);
        return;
      }
      model = gltf.scene;
      scene.add(model);

      const clip = gltf.animations.find((c) => c.name === WAVE_CLIP) ?? gltf.animations[0];
      if (clip) {
        mixer = new THREE.AnimationMixer(model);
        mixer.addEventListener('finished', onFinished);
        waveAction = mixer.clipAction(clip);
        waveAction.setLoop(THREE.LoopOnce, 1);
        waveAction.clampWhenFinished = true;
        // Ausgangspose = erstes Bild der Animation, wie in der Vorlage.
        waveAction.play();
        waveAction.paused = true;
        mixer.update(0);
      }

      // Hüllkugel um die Mitte der Bounding-Box, eng an den tatsächlichen Eckpunkten.
      model.updateMatrixWorld(true);
      const center = new THREE.Box3().setFromObject(model).getCenter(new THREE.Vector3());
      const point = new THREE.Vector3();
      let maxSq = 0;
      model.traverse((node) => {
        const mesh = node as THREE.Mesh;
        const position = mesh.isMesh ? mesh.geometry.getAttribute('position') : undefined;
        if (!position) return;
        for (let i = 0; i < position.count; i += 1) {
          point.fromBufferAttribute(position, i).applyMatrix4(mesh.matrixWorld);
          maxSq = Math.max(maxSq, point.distanceToSquared(center));
        }
      });
      radius = Math.sqrt(maxSq) || 1;

      // Weicher Kontaktschatten auf Höhe der Füße; von unten nicht sichtbar.
      const box = new THREE.Box3().setFromObject(model);
      const size = box.getSize(new THREE.Vector3());
      const footprint = Math.max(size.x, size.z) * 1.5;
      shadow = new THREE.Mesh(
        new THREE.PlaneGeometry(footprint, footprint),
        new THREE.MeshBasicMaterial({
          map: createShadowTexture(),
          transparent: true,
          opacity: SHADOW_OPACITY,
          depthWrite: false,
          toneMapped: false,
        }),
      );
      shadow.rotation.x = -Math.PI / 2;
      shadow.position.set(center.x, box.min.y + size.y * 0.002, center.z);
      shadow.renderOrder = -1;
      scene.add(shadow);

      idealDistance = computeIdealDistance();
      controls.target.copy(center);
      spherical.set(idealDistance, ORBIT_PHI, ORBIT_THETA);
      camera.position.copy(center).add(offset.setFromSpherical(spherical));
      applyLimits();
      controls.update();

      renderer.render(scene, camera);
      dirty = false;
      options.onLoad();
    },
    undefined,
    () => {
      if (!disposed) options.onError();
    },
  );

  resize();
  schedule();

  return {
    wave() {
      if (disposed || !mixer || !waveAction) return false;
      waveAction.reset().play();
      waving = true;
      lastTime = 0;
      schedule();
      return true;
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      if (frame) cancelAnimationFrame(frame);
      document.removeEventListener('visibilitychange', onVisibility);
      canvas.removeEventListener('keydown', onKeyDown);
      resizeObserver?.disconnect();
      intersectionObserver?.disconnect();
      controls.dispose();
      if (mixer) {
        mixer.removeEventListener('finished', onFinished);
        mixer.stopAllAction();
        if (model) mixer.uncacheRoot(model);
      }
      if (model) {
        scene.remove(model);
        disposeObject(model);
      }
      if (shadow) {
        scene.remove(shadow);
        shadow.geometry.dispose();
        shadow.material.map?.dispose();
        shadow.material.dispose();
      }
      scene.environment = null;
      envTarget.dispose();
      room.dispose();
      pmrem.dispose();
      renderer.dispose();
    },
  };
}

function disposeObject(root: THREE.Object3D) {
  root.traverse((node) => {
    const mesh = node as THREE.Mesh;
    if (!mesh.isMesh) return;
    mesh.geometry.dispose();
    const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    for (const material of materials) {
      for (const value of Object.values(material)) {
        if (value instanceof THREE.Texture) value.dispose();
      }
      material.dispose();
    }
  });
}

/** Radialer Verlauf Schwarz → transparent als Textur für den Kontaktschatten. */
function createShadowTexture(): THREE.Texture {
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    const gradient = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    gradient.addColorStop(0, 'rgba(16,16,19,1)');
    gradient.addColorStop(0.45, 'rgba(16,16,19,0.45)');
    gradient.addColorStop(1, 'rgba(16,16,19,0)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, size, size);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}
