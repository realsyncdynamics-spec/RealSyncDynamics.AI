/**
 * React/Vite-Port der 3D-Viewer-Engine aus
 * realsyncdynamics-spec/landingpage-3d-builder @ src/lib/viewer.ts
 * Nur WebGL-Vorschau; keine Next.js-Runtime, Persistenz, Auth oder Exportpipeline.
 */
import * as THREE from "three";

// Gemeinsamer 3D-Viewer für Builder-Vorschau und HTML-Export.
// Alle Ansichten teilen sich EINEN WebGL-Kontext: Jedes Objekt wird in den
// gemeinsamen Renderer gezeichnet und anschließend in das 2D-Canvas der
// jeweiligen Ansicht kopiert. So gibt es kein Kontextlimit pro Sektion.

export type ViewerShape = "sphere" | "torus" | "box" | "icosahedron";
export type ViewerObject = { shape: ViewerShape; color: string; scale: number; speed: number };
export type ViewerHandle = { update: (object: ViewerObject) => void; dispose: () => void };

type View = {
  element: HTMLElement;
  canvas: HTMLCanvasElement;
  context: CanvasRenderingContext2D;
  mesh: THREE.Mesh<THREE.BufferGeometry, THREE.MeshStandardMaterial>;
  object: ViewerObject;
};

type Shared = {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  width: number;
  height: number;
};

const views = new Set<View>();
let shared: Shared | null = null;
let frame = 0;
let previous = 0;

function createGeometry(shape: ViewerShape): THREE.BufferGeometry {
  if (shape === "sphere") return new THREE.SphereGeometry(1, 32, 24);
  if (shape === "torus") return new THREE.TorusGeometry(0.8, 0.3, 20, 64);
  if (shape === "box") return new THREE.BoxGeometry(1.5, 1.5, 1.5);
  return new THREE.IcosahedronGeometry(1, 0);
}

function getShared(): Shared | null {
  if (shared) return shared;
  let renderer: THREE.WebGLRenderer;
  try {
    renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
  } catch {
    return null;
  }
  renderer.setPixelRatio(1);
  renderer.setScissorTest(true);
  const scene = new THREE.Scene();
  scene.add(new THREE.AmbientLight(0xffffff, 1.4));
  const light = new THREE.DirectionalLight(0xffffff, 2.5);
  light.position.set(3, 4, 5);
  scene.add(light);
  const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 100);
  camera.position.z = 5;
  shared = { renderer, scene, camera, width: 0, height: 0 };
  return shared;
}

function isVisible(element: HTMLElement): boolean {
  const rect = element.getBoundingClientRect();
  return rect.width > 0 && rect.height > 0 && rect.bottom > 0 && rect.top < window.innerHeight && rect.right > 0 && rect.left < window.innerWidth;
}

function draw(view: View, state: Shared) {
  const ratio = Math.min(window.devicePixelRatio || 1, 2);
  const width = Math.round(view.element.clientWidth * ratio);
  const height = Math.round(view.element.clientHeight * ratio);
  if (!width || !height) return;
  if (view.canvas.width !== width || view.canvas.height !== height) {
    view.canvas.width = width;
    view.canvas.height = height;
  }
  // Der gemeinsame Puffer wächst nur, damit er nicht pro Ansicht neu angelegt wird.
  if (width > state.width || height > state.height) {
    state.width = Math.max(width, state.width);
    state.height = Math.max(height, state.height);
    state.renderer.setSize(state.width, state.height, false);
  }
  state.camera.aspect = width / height;
  state.camera.updateProjectionMatrix();
  state.renderer.setViewport(0, 0, width, height);
  state.renderer.setScissor(0, 0, width, height);
  state.scene.add(view.mesh);
  state.renderer.render(state.scene, state.camera);
  state.scene.remove(view.mesh);
  // WebGL zählt von unten links, das 2D-Canvas von oben links.
  view.context.clearRect(0, 0, width, height);
  view.context.drawImage(state.renderer.domElement, 0, state.height - height, width, height, 0, 0, width, height);
}

function tick(now: number) {
  const state = shared;
  if (!state) return;
  const delta = Math.min((now - previous) / 1000, 0.1);
  previous = now;
  views.forEach((view) => {
    view.mesh.rotation.y += delta * view.object.speed;
    view.mesh.rotation.x += delta * view.object.speed * 0.35;
    if (isVisible(view.element)) draw(view, state);
  });
  frame = requestAnimationFrame(tick);
}

function applyObject(view: View, object: ViewerObject) {
  if (object.shape !== view.object.shape) {
    view.mesh.geometry.dispose();
    view.mesh.geometry = createGeometry(object.shape);
  }
  view.mesh.material.color.set(object.color);
  view.mesh.scale.setScalar(object.scale);
  view.object = { ...object };
}

/**
 * Hängt eine 3D-Ansicht in `element` ein. Gibt `null` zurück, wenn WebGL
 * oder das 2D-Canvas nicht verfügbar sind – der Aufrufer zeigt dann einen Ersatz.
 */
export function mount(element: HTMLElement, object: ViewerObject): ViewerHandle | null {
  // Prüfe den 2D-Puffer VOR dem WebGL-Renderer, damit ein fehlender Canvas-Kontext
  // keinen geteilten Renderer ohne View zurücklässt.
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");
  if (!context) return null;
  const state = getShared();
  if (!state) return null;
  canvas.style.width = "100%";
  canvas.style.height = "100%";
  canvas.style.display = "block";
  const material = new THREE.MeshStandardMaterial({ color: object.color, roughness: 0.3, metalness: 0.25 });
  const mesh = new THREE.Mesh(createGeometry(object.shape), material);
  mesh.scale.setScalar(object.scale);
  const view: View = { element, canvas, context, mesh, object: { ...object } };
  element.appendChild(canvas);
  views.add(view);
  if (views.size === 1) {
    previous = performance.now();
    frame = requestAnimationFrame(tick);
  }
  return {
    update: (next) => applyObject(view, next),
    dispose: () => {
      if (!views.delete(view)) return;
      mesh.geometry.dispose();
      material.dispose();
      canvas.remove();
      if (views.size === 0) {
        cancelAnimationFrame(frame);
        state.renderer.dispose();
        state.renderer.forceContextLoss();
        shared = null;
      }
    },
  };
}
