import { lazy, Suspense } from 'react';
import { EarthHeroVisual } from './EarthHeroVisual';
import { useHighEndViewport } from '../../hooks/useHighEndViewport';

// Three.js/R3F-Szene nur clientseitig + lazy laden (eigener vendor-three-Chunk).
const EarthScene = lazy(() => import('./EarthScene'));

interface Props {
  size?: number;
  className?: string;
}

/**
 * EarthCore — zeigt die Europa-Erde als 3D-Szene (EarthScene) auf
 * leistungsfähigen Viewports, sonst die leichte SVG-Variante (EarthHeroVisual).
 * Der SVG-Fallback dient gleichzeitig als Suspense-Fallback während des
 * Lazy-Loads und als Mobile-Fallback (kein WebGL-Overhead).
 *
 * Analog zu AiCore aufgebaut: transparenter Canvas-Hintergrund, kein eigenes
 * Theming — fügt sich in den dunklen Space-Hero ein.
 */
export function EarthCore({ size = 520, className }: Props) {
  const highEnd = useHighEndViewport();
  const fallback = <EarthHeroVisual size={size} className={className} />;

  if (!highEnd) return fallback;

  return (
    <div className={className} style={{ width: size, maxWidth: '100%', aspectRatio: '1' }}>
      <Suspense fallback={fallback}>
        <EarthScene />
      </Suspense>
    </div>
  );
}
