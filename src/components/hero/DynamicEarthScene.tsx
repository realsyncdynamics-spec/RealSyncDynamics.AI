/**
 * DynamicEarthScene — lädt die 3D-Erde (EarthCanvas) performant & robust:
 *   - code-split via React.lazy (Three.js bleibt aus dem initialen Bundle)
 *   - Suspense-Fallback = statischer Premium-Earth (kein Layout-Shift)
 *   - ErrorBoundary → statischer Fallback (fehlende WebGL/Texturen)
 *   - prefers-reduced-motion ODER kleiner Viewport → statischer Fallback
 *     (keine FPS-Last auf Mobile, ruhiges Bild bei Reduced-Motion)
 */
import { Component, Suspense, lazy, useEffect, useState, type ReactNode } from 'react';
import { useReducedMotion } from '../../lib/useReducedMotion';

const EarthCanvas = lazy(() => import('./EarthCanvas'));

class SceneErrorBoundary extends Component<{ children: ReactNode; fallback: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() { return this.state.failed ? this.props.fallback : this.props.children; }
}

/** Statischer Premium-Earth — Fallback (Mobile / Reduced-Motion / kein WebGL). */
export function StaticEarthFallback() {
  return (
    <div className="relative h-full w-full" aria-hidden>
      <div className="absolute left-1/2 top-1/2 aspect-square w-[78%] -translate-x-1/2 -translate-y-1/2">
        {/* Atmosphäre */}
        <div className="absolute inset-0 rounded-full bg-[radial-gradient(circle_at_50%_50%,rgba(58,160,255,0.35),transparent_62%)] blur-xl" />
        {/* Planet */}
        <div className="absolute inset-[6%] overflow-hidden rounded-full shadow-[0_0_120px_-10px_rgba(20,184,166,0.45)]"
          style={{
            backgroundImage:
              'radial-gradient(circle at 32% 30%, #1d5e7a 0%, #0c2f43 38%, #06121d 72%), url(/textures/earth/earth-day.jpg)',
            backgroundSize: 'cover',
            backgroundPosition: '38% 42%',
          }}
        >
          {/* Tag/Nacht-Schatten */}
          <div className="absolute inset-0 rounded-full bg-[radial-gradient(circle_at_30%_35%,transparent_40%,rgba(0,0,0,0.85)_85%)]" />
          {/* Sonnen-Saum */}
          <div className="absolute inset-0 rounded-full bg-[radial-gradient(circle_at_22%_28%,rgba(255,240,210,0.5),transparent_30%)]" />
        </div>
        <div className="absolute inset-[6%] rounded-full ring-1 ring-petrol-400/20" />
      </div>
    </div>
  );
}

export function DynamicEarthScene() {
  const reduce = useReducedMotion();
  const [enable3D, setEnable3D] = useState(false);

  useEffect(() => {
    if (!reduce && typeof window !== 'undefined' && window.innerWidth >= 768) {
      setEnable3D(true);
    }
  }, [reduce]);

  if (!enable3D) return <StaticEarthFallback />;

  return (
    <SceneErrorBoundary fallback={<StaticEarthFallback />}>
      <Suspense fallback={<StaticEarthFallback />}>
        <EarthCanvas />
      </Suspense>
    </SceneErrorBoundary>
  );
}

export default DynamicEarthScene;
