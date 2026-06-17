import { lazy, Suspense } from 'react';
import { AiCoreVisual } from './AiCoreVisual';
import { useHighEndViewport } from '../../hooks/useHighEndViewport';

// Three.js/R3F-Szene nur clientseitig + lazy laden (eigener vendor-three-Chunk).
const AiCoreScene = lazy(() => import('./AiCoreScene'));

interface Props {
  size?: number;
  className?: string;
}

/**
 * AiCore — zeigt die 3D-Szene (AiCoreScene) auf leistungsfähigen Viewports,
 * sonst die CSS-animierte SVG-Variante (AiCoreVisual). Der SVG-Fallback dient
 * gleichzeitig als Suspense-Fallback während des Lazy-Loads.
 *
 * Bewusst ohne eigenes Theming: passt durch transparenten Canvas-Hintergrund
 * in den dunklen Obsidian-Hero.
 */
export function AiCore({ size = 360, className }: Props) {
  const highEnd = useHighEndViewport();
  const fallback = <AiCoreVisual size={size} className={className} />;

  if (!highEnd) return fallback;

  return (
    <div className={className} style={{ width: size, maxWidth: '100%', aspectRatio: '1' }}>
      <Suspense fallback={fallback}>
        <AiCoreScene />
      </Suspense>
    </div>
  );
}
