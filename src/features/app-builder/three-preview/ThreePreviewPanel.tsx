import { useState, type ReactElement } from 'react';
import { ThreeScenePreview } from './ThreeScenePreview';
import type { ViewerObject, ViewerShape } from './viewer';

// Vorhandenes Objektmodell aus landingpage-3d-builder; bewusst ohne dessen
// unabhängigen Zustand, localStorage, Next.js-Server oder HTML-Export.
const INITIAL_OBJECT: ViewerObject = {
  shape: 'sphere',
  color: '#a78bfa',
  scale: 1,
  speed: 0.4,
};

const SHAPES: { value: ViewerShape; label: string }[] = [
  { value: 'sphere', label: 'Kugel' },
  { value: 'torus', label: 'Torus' },
  { value: 'box', label: 'Würfel' },
  { value: 'icosahedron', label: 'Ikosaeder' },
];

/**
 * Opt-in-Prototyp innerhalb des bereits authentifizierten App Builders.
 * Keine Änderungen am SiteOS/Puck-Modell oder am Governed-HTML-Iframe.
 */
export function ThreePreviewPanel(): ReactElement {
  const [object, setObject] = useState<ViewerObject>(INITIAL_OBJECT);

  return (
    <section data-testid="builder-3d-preview-panel" className="grid min-h-[360px] grid-rows-[auto_minmax(300px,1fr)_auto] gap-3 p-4">
      <header className="grid gap-1">
        <h2 className="text-sm font-semibold">3D-Objektvorschau · Preview</h2>
        <p className="text-xs leading-5 text-white/55">
          Wiederverwendeter Three.js-Viewer aus dem bestehenden 3D-Landingpage-Builder.
          Diese Vorschau ist nur lokal im aktuellen Tab: Sie ändert keine Website-Dateien,
          wird nicht gespeichert und veröffentlicht nichts.
        </p>
      </header>

      <div className="min-h-[300px] overflow-hidden rounded-lg border border-white/10 bg-[#151322]">
        <ThreeScenePreview object={object} />
      </div>

      <div className="grid gap-3 sm:grid-cols-2" aria-label="3D-Einstellungen">
        <label className="grid gap-1 text-xs text-white/70">
          Form
          <select
            value={object.shape}
            onChange={(event) => {
              const next = SHAPES.find(({ value }) => value === event.target.value);
              if (next) setObject((current) => ({ ...current, shape: next.value }));
            }}
            className="min-h-11 rounded border border-white/20 bg-[#101114] px-2 text-sm text-white"
          >
            {SHAPES.map((shape) => (
              <option key={shape.value} value={shape.value}>{shape.label}</option>
            ))}
          </select>
        </label>

        <label className="grid gap-1 text-xs text-white/70">
          Farbe
          <input
            type="color"
            value={object.color}
            onChange={(event) => {
              if (/^#[0-9a-f]{6}$/i.test(event.target.value)) {
                setObject((current) => ({ ...current, color: event.target.value }));
              }
            }}
            className="h-11 w-full rounded border border-white/20 bg-[#101114] p-1"
          />
        </label>

        <label className="grid gap-1 text-xs text-white/70">
          Größe: {object.scale.toFixed(1)}
          <input
            aria-label="Größe"
            type="range"
            min="0.5"
            max="1.5"
            step="0.1"
            value={object.scale}
            onChange={(event) => setObject((current) => ({ ...current, scale: Number(event.target.value) }))}
            className="min-h-11 w-full accent-[#a78bfa]"
          />
        </label>

        <label className="grid gap-1 text-xs text-white/70">
          Drehgeschwindigkeit: {object.speed.toFixed(1)}
          <input
            aria-label="Drehgeschwindigkeit"
            type="range"
            min="0"
            max="1.5"
            step="0.1"
            value={object.speed}
            onChange={(event) => setObject((current) => ({ ...current, speed: Number(event.target.value) }))}
            className="min-h-11 w-full accent-[#a78bfa]"
          />
        </label>
      </div>
    </section>
  );
}

export default ThreePreviewPanel;
