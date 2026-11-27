import { useEffect, useRef, useState, type ReactElement } from 'react';
import { mount, type ViewerHandle, type ViewerObject } from './viewer';

/**
 * Kleiner React-Adapter nach src/app/Scene.tsx des bestehenden 3D-Builders.
 * WebGL wird erst beim Mounten des opt-in-Tabs initialisiert.
 * Kein Serveraufruf, kein localStorage und keine Projektmutation.
 */
export function ThreeScenePreview({ object }: { object: ViewerObject }): ReactElement {
  const containerRef = useRef<HTMLDivElement>(null);
  const handleRef = useRef<ViewerHandle | null>(null);
  const latestRef = useRef(object);
  const [unavailable, setUnavailable] = useState(false);
  latestRef.current = object;

  useEffect(() => {
    const element = containerRef.current;
    if (!element) return;
    const viewer = mount(element, latestRef.current);
    handleRef.current = viewer;
    setUnavailable(!viewer);

    return () => {
      viewer?.dispose();
      handleRef.current = null;
    };
  }, []);

  useEffect(() => {
    handleRef.current?.update(object);
  }, [object.shape, object.color, object.scale, object.speed]);

  return (
    <div
      ref={containerRef}
      role="img"
      aria-label="3D-Objektvorschau"
      data-testid="builder-3d-canvas"
      className="relative h-full min-h-[280px] w-full overflow-hidden"
    >
      {unavailable ? (
        <div role="status" className="grid h-full min-h-[280px] place-items-center px-6 text-center">
          <div className="grid gap-3 justify-items-center">
            <svg aria-hidden="true" width="100" height="100" viewBox="0 0 100 100">
              <circle cx="50" cy="50" r="36" fill={object.color} fillOpacity="0.35" stroke={object.color} strokeWidth="2" />
            </svg>
            <p className="text-sm text-white/60">3D-Vorschau nicht verfügbar (WebGL oder Canvas fehlt). SVG-Ersatzansicht.</p>
          </div>
        </div>
      ) : null}
    </div>
  );
}
