import { useEffect, useRef, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import type { Group } from 'three';
import {
  DEFAULT_SCENE_MANIFEST,
  type SceneForm,
  type SceneManifest,
  type SceneMood,
} from './scene-manifest';

const MOOD_COLORS: Record<SceneMood, { background: string; ambient: string; key: string }> = {
  midnight: { background: '#090D16', ambient: '#53657E', key: '#C8E9FF' },
  warm: { background: '#211710', ambient: '#8F5F37', key: '#FFD39A' },
  daylight: { background: '#DCE7EB', ambient: '#FFFFFF', key: '#FFFFFF' },
};

function supportsWebGL(): boolean {
  try {
    const canvas = document.createElement('canvas');
    return Boolean(window.WebGLRenderingContext && (canvas.getContext('webgl') || canvas.getContext('experimental-webgl')));
  } catch {
    return false;
  }
}

function SceneObject({ manifest, rotation }: { manifest: SceneManifest; rotation: number }) {
  const group = useRef<Group>(null);
  const reducedMotion = useRef(false);
  useEffect(() => {
    reducedMotion.current = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
    const query = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    const update = () => { reducedMotion.current = query?.matches ?? false; };
    query?.addEventListener('change', update);
    return () => query?.removeEventListener('change', update);
  }, []);
  useFrame((_, delta) => {
    if (group.current && !reducedMotion.current && scene.motion > 0) {
      group.current.rotation.y += delta * scene.motion * 0.22;
    }
  });

  const accent = scene.accent;
  return (
    <group ref={group} rotation={[0.08, rotation, 0]}>
      {scene.form === 'portal' ? (
        <>
          <mesh position={[-0.78, 0, 0]}>
            <boxGeometry args={[0.16, 2.25, 0.16]} />
            <meshStandardMaterial color={accent} metalness={0.6} roughness={0.26} />
          </mesh>
          <mesh position={[0.78, 0, 0]}>
            <boxGeometry args={[0.16, 2.25, 0.16]} />
            <meshStandardMaterial color={accent} metalness={0.6} roughness={0.26} />
          </mesh>
          <mesh position={[0, 1.05, 0]}>
            <boxGeometry args={[1.72, 0.16, 0.16]} />
            <meshStandardMaterial color={accent} metalness={0.6} roughness={0.26} />
          </mesh>
          <mesh position={[0, -0.02, -0.14]}>
            <boxGeometry args={[1.36, 1.98, 0.06]} />
            <meshStandardMaterial color={accent} emissive={accent} emissiveIntensity={0.12} transparent opacity={0.22} roughness={0.2} />
          </mesh>
          <mesh position={[0, -1.15, 0]}>
            <boxGeometry args={[2.2, 0.08, 0.8]} />
            <meshStandardMaterial color="#697A8D" metalness={0.55} roughness={0.38} />
          </mesh>
        </>
      ) : scene.form === 'object' ? (
        <>
          <mesh>
            <torusKnotGeometry args={[0.68, 0.22, 160, 24]} />
            <meshPhysicalMaterial color={accent} metalness={0.62} roughness={0.2} clearcoat={0.8} />
          </mesh>
          <mesh position={[0, -1.18, 0]}>
            <cylinderGeometry args={[0.78, 0.92, 0.14, 64]} />
            <meshStandardMaterial color="#586A7B" metalness={0.65} roughness={0.3} />
          </mesh>
        </>
      ) : (
        <>
          <mesh rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[0.86, 0.026, 12, 96]} />
            <meshStandardMaterial color={accent} emissive={accent} emissiveIntensity={0.25} />
          </mesh>
          {[0, 1, 2].map((index) => {
            const angle = (index / 3) * Math.PI * 2;
            return (
              <mesh key={index} position={[Math.cos(angle) * 0.86, Math.sin(angle) * 0.86, 0]}>
                <icosahedronGeometry args={[0.23, 1]} />
                <meshPhysicalMaterial color={accent} metalness={0.45} roughness={0.22} />
              </mesh>
            );
          })}
          <mesh>
            <icosahedronGeometry args={[0.38, 2]} />
            <meshPhysicalMaterial color="#D9E7F2" metalness={0.4} roughness={0.28} />
          </mesh>
        </>
      )}
    </group>
  );
}

export interface SceneBuilderPanelProps {
  manifest: SceneManifest;
  onSave: (manifest: SceneManifest) => void | Promise<void>;
}

const FORM_OPTIONS: { id: SceneForm; title: string; note: string }[] = [
  { id: 'portal', title: 'Architektur', note: 'Portal' },
  { id: 'object', title: 'Produkt', note: 'Objekt' },
  { id: 'orbit', title: 'System', note: 'Orbit' },
];

export default function SceneBuilderPanel({ manifest, onSave }: SceneBuilderPanelProps) {
  const [scene, setScene] = useState(manifest);
  const [webgl, setWebgl] = useState(true);
  const [rotation, setRotation] = useState(0);
  const [saving, setSaving] = useState(false);
  const mood = MOOD_COLORS[scene.mood] ?? MOOD_COLORS[DEFAULT_SCENE_MANIFEST.mood];

  useEffect(() => setWebgl(supportsWebGL()), []);

  const update = (patch: Partial<SceneManifest>) => setScene((current) => ({ ...current, ...patch, version: 1 }));

  async function save() {
    setSaving(true);
    try {
      await onSave(scene);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="grid min-h-0 gap-0 xl:grid-cols-[minmax(0,1.4fr)_minmax(300px,0.8fr)]">
      <section className="relative min-h-[340px] overflow-hidden border-b border-white/10 xl:min-h-[520px] xl:border-b-0 xl:border-r" aria-label="3D Szenenvorschau">
        {scene.enabled && webgl ? (
          <Canvas
            camera={{ position: [0, 0.3, 4.8], fov: 38 }}
            dpr={[1, 1.5]}
            gl={{ antialias: true, alpha: false, powerPreference: 'low-power' }}
            style={{ background: mood.background }}
          >
            <ambientLight intensity={scene.mood === 'daylight' ? 1.5 : 0.75} color={mood.ambient} />
            <directionalLight position={[3, 4, 4]} intensity={scene.mood === 'daylight' ? 2 : 2.6} color={mood.key} />
            <pointLight position={[-3, -1, 2]} intensity={1.2} color={scene.accent} />
            <SceneObject manifest={scene} rotation={rotation} />
            <OrbitControls enablePan={false} minDistance={3.4} maxDistance={7} />
          </Canvas>
        ) : (
          <div className="grid min-h-[340px] place-items-center p-8 text-center xl:min-h-[520px]" style={{ background: mood.background }}>
            <div>
              <div className="mx-auto mb-5 grid size-32 place-items-center border" style={{ borderColor: scene.accent, color: scene.accent }}>
                <span className="font-mono text-xs tracking-[0.2em]">3D</span>
              </div>
              <p className="text-sm text-white/70">{webgl ? 'Leichte Darstellung aktiv' : 'WebGL nicht verfügbar · leichte Darstellung'}</p>
            </div>
          </div>
        )}
        <div className="pointer-events-none absolute left-4 top-4 font-mono text-[10px] tracking-[0.18em] text-white/50 uppercase">
          Scene preview · Manifest v1
        </div>
        <div className="absolute bottom-4 left-4 flex gap-2">
          <button type="button" aria-label="Szene nach links drehen" onClick={() => setRotation((value) => value - 0.45)} className="min-h-11 min-w-11 border border-white/20 bg-black/30 text-sm text-white">↶</button>
          <button type="button" aria-label="Szene nach rechts drehen" onClick={() => setRotation((value) => value + 0.45)} className="min-h-11 min-w-11 border border-white/20 bg-black/30 text-sm text-white">↷</button>
        </div>
      </section>

      <section className="grid content-start gap-5 p-4 sm:p-6">
        <header>
          <p className="font-mono text-[10px] tracking-[0.18em] text-[#7AA2FF] uppercase">3D Studio · Entwurf</p>
          <h2 className="mt-2 text-xl font-medium text-[#E2E2E2]">Szene gestalten</h2>
          <p className="mt-2 text-sm leading-6 text-white/55">Wähle eine Form, Lichtstimmung und Bewegung. Die Szene wird als kontrollierbares Manifest im Projekt abgelegt.</p>
        </header>

        <fieldset className="grid gap-2">
          <legend className="mb-2 font-mono text-[10px] tracking-[0.14em] text-white/45 uppercase">Szenenform</legend>
          <div className="grid grid-cols-3 gap-2">
            {FORM_OPTIONS.map((option) => (
              <button key={option.id} type="button" onClick={() => update({ form: option.id })} aria-pressed={scene.form === option.id} className={`min-h-16 border px-2 text-left ${scene.form === option.id ? 'border-[#0052FF] bg-[#0052FF]/15 text-white' : 'border-white/15 text-white/55'}`}>
                <span className="block text-xs">{option.title}</span>
                <span className="mt-1 block font-mono text-[9px] uppercase tracking-[0.12em] opacity-60">{option.note}</span>
              </button>
            ))}
          </div>
        </fieldset>

        <label className="grid gap-2">
          <span className="font-mono text-[10px] tracking-[0.14em] text-white/45 uppercase">Licht</span>
          <select value={scene.mood} onChange={(event) => update({ mood: event.target.value as SceneMood })} className="min-h-11 border border-white/15 bg-[#101114] px-3 text-sm text-white">
            <option value="midnight">Mitternacht · kühl</option>
            <option value="warm">Warm · materialbetont</option>
            <option value="daylight">Tageslicht · klar</option>
          </select>
        </label>

        <label className="grid gap-2">
          <span className="font-mono text-[10px] tracking-[0.14em] text-white/45 uppercase">Akzentfarbe</span>
          <span className="flex min-h-11 items-center gap-3 border border-white/15 bg-[#101114] px-3">
            <input type="color" value={scene.accent} onChange={(event) => update({ accent: event.target.value })} className="size-7 cursor-pointer border-0 bg-transparent p-0" aria-label="Akzentfarbe wählen" />
            <span className="font-mono text-xs text-white/65">{scene.accent}</span>
          </span>
        </label>

        <label className="grid gap-2">
          <span className="flex justify-between font-mono text-[10px] tracking-[0.14em] text-white/45 uppercase">
            <span>Motion</span><output>{Math.round(scene.motion * 100)}%</output>
          </span>
          <input type="range" min="0" max="1" step="0.05" value={scene.motion} onChange={(event) => update({ motion: Number(event.target.value) })} aria-label="Motion-Intensität" className="accent-[#0052FF]" />
          <span className="text-xs text-white/45">Systemeinstellung „Bewegung reduzieren“ wird berücksichtigt.</span>
        </label>

        <label className="flex min-h-11 items-center gap-3 text-sm text-white/70">
          <input type="checkbox" checked={scene.enabled} onChange={(event) => update({ enabled: event.target.checked })} className="size-4 accent-[#0052FF]" />
          3D in der Vorschau aktivieren
        </label>

        <div className="border-t border-white/10 pt-4">
          <p className="text-xs leading-5 text-white/45">Dieser Prototyp nutzt geprüfte, prozedurale Formen. Blender-/GLB-Import, KI-Szenengenerierung und Einbettung in den exportierten Seitenquelltext folgen als getrennte Ausbaustufen.</p>
          <button type="button" onClick={() => void save()} disabled={saving} className="mt-4 min-h-11 w-full bg-[#0052FF] px-4 text-sm font-medium text-white disabled:opacity-50">
            {saving ? 'Wird gespeichert …' : 'Szene im Projekt speichern'}
          </button>
        </div>
      </section>
    </div>
  );
}
