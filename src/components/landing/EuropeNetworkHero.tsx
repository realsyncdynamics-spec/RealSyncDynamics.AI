/**
 * Public `/` hero backdrop.
 * Photoreal Earth (shared mesh) with a slow idle spin.
 * Gold corridor overlay is gone. Copy stays on the left veil.
 */
import { lazy, Suspense, useEffect, useState } from 'react';
import { MODE_SHOT_FILTER, MODE_SHOT_OPACITY, modeAccent, modeVeil } from './landing-mode';

const HeroEarthScene = lazy(() => import('./HeroEarthScene'));

function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReduced(mq.matches);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, []);
  return reduced;
}

function useWebGlAvailable(): boolean {
  const [ok, setOk] = useState(false);
  useEffect(() => {
    try {
      const canvas = document.createElement('canvas');
      const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
      setOk(Boolean(gl));
    } catch {
      setOk(false);
    }
  }, []);
  return ok;
}

function StaticEarth() {
  return (
    <picture>
      <source srcSet="/europe-globe.webp" type="image/webp" />
      <img
        src="/europe-globe.jpg"
        alt=""
        width={1376}
        height={768}
        className="absolute inset-0 h-full w-full scale-[1.12] object-cover object-[82%_44%]"
        style={{ opacity: MODE_SHOT_OPACITY, filter: MODE_SHOT_FILTER }}
        decoding="async"
      />
    </picture>
  );
}

export function EuropeNetworkHero() {
  const reducedMotion = usePrefersReducedMotion();
  const webgl = useWebGlAvailable();
  const use3d = webgl && !reducedMotion;

  return (
    <div
      className="pointer-events-none absolute inset-0 overflow-hidden"
      aria-hidden="true"
      data-hero-visual="europe-network-static"
      data-hero-interactive="false"
    >
      <StaticEarth />

      {use3d && (
        <div className="absolute inset-y-[-8%] right-[-6%] w-[68%] min-w-[420px]">
          <Suspense fallback={null}>
            <HeroEarthScene reducedMotion={reducedMotion} />
          </Suspense>
        </div>
      )}

      <div
        className="absolute inset-0"
        style={{
          background: [
            `linear-gradient(102deg, ${modeVeil(100)} 0%, ${modeVeil(100)} 34%, ${modeVeil(92)} 46%, ${modeVeil(55)} 58%, transparent 74%)`,
            `linear-gradient(180deg, ${modeVeil(70)} 0%, transparent 22%, transparent 68%, ${modeVeil(96)} 100%)`,
            `radial-gradient(42% 70% at 18% -8%, rgba(255,255,255,0.11) 0%, transparent 62%)`,
            `radial-gradient(48% 42% at 78% 46%, ${modeAccent(14)} 0%, transparent 64%)`,
          ].join(','),
        }}
      />
    </div>
  );
}
