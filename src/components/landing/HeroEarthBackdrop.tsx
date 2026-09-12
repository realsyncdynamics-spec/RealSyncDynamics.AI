/**
 * Public landing hero backdrop — full-bleed photoreal Earth (desktop fill).
 *
 * Scenery only: no Governance Sphere HUD, drag globe, DEMO chrome, or cream
 * sun disc. Subtle warm rim light is OK; the planet must dominate.
 */
import { lazy, Suspense, useEffect, useState } from 'react';

const HeroEarthBackdropScene = lazy(() => import('./HeroEarthBackdropScene'));

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
  const [ok, setOk] = useState(true);
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

/** Night-Europe static plane — same product on mobile / no-WebGL / reduced motion. */
function StaticEarthPlane() {
  return (
    <div className="hero-earth-static absolute inset-0" aria-hidden="true">
      <picture>
        <source srcSet="/europe-globe.webp" type="image/webp" />
        <img
          src="/europe-globe.jpg"
          alt=""
          width={1376}
          height={768}
          decoding="async"
          fetchPriority="low"
          className="h-full w-full scale-[1.45] object-cover object-[48%_42%] opacity-100"
        />
      </picture>
      {/* Soft readability gradient only — no cream sunrise wash */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background: [
            'linear-gradient(105deg, transparent 12%, rgba(5,7,11,0.18) 48%, rgba(5,7,11,0.5) 78%, rgba(5,7,11,0.68) 100%)',
            'radial-gradient(42% 36% at 18% 58%, rgba(228,207,162,0.1) 0%, transparent 62%)',
          ].join(', '),
        }}
      />
    </div>
  );
}

function Starfield() {
  return (
    <div
      className="hero-earth-stars pointer-events-none absolute inset-0 opacity-45"
      aria-hidden="true"
      style={{
        backgroundImage: [
          'radial-gradient(1px 1px at 8% 12%, rgba(242,238,230,0.35), transparent)',
          'radial-gradient(1px 1px at 18% 28%, rgba(228,207,162,0.28), transparent)',
          'radial-gradient(1.5px 1.5px at 32% 8%, rgba(239,230,213,0.3), transparent)',
          'radial-gradient(1px 1px at 55% 18%, rgba(228,207,162,0.22), transparent)',
          'radial-gradient(1px 1px at 72% 10%, rgba(242,238,230,0.26), transparent)',
          'radial-gradient(1px 1px at 88% 22%, rgba(228,207,162,0.18), transparent)',
          'radial-gradient(1.5px 1.5px at 12% 55%, rgba(242,238,230,0.2), transparent)',
          'radial-gradient(1px 1px at 42% 70%, rgba(228,207,162,0.18), transparent)',
          'radial-gradient(1px 1px at 78% 62%, rgba(239,230,213,0.2), transparent)',
          'radial-gradient(1px 1px at 94% 78%, rgba(242,238,230,0.14), transparent)',
        ].join(','),
        backgroundSize: '100% 100%',
      }}
    />
  );
}

/**
 * Restrained warm rim only — must never hide continents / city lights.
 * No hard sun disc, no cream blob, no screen-blend wash.
 */
function WarmRimLight() {
  return (
    <div className="hero-sunrise pointer-events-none absolute inset-0" aria-hidden="true">
      <div
        className="absolute inset-0"
        style={{
          background: [
            'radial-gradient(ellipse 55% 48% at 8% 52%, rgba(36,26,16,0.55) 0%, transparent 58%)',
            'radial-gradient(ellipse 70% 50% at 82% 28%, rgba(12,14,18,0.5) 0%, transparent 55%)',
          ].join(', '),
        }}
      />
      {/* Thin limb glow — atmosphere hint, not a sun */}
      <div
        className="absolute"
        style={{
          left: '-4%',
          top: '28%',
          width: 'min(28vw, 320px)',
          height: 'min(42vw, 480px)',
          borderRadius: '50%',
          background:
            'radial-gradient(ellipse at 70% 50%, rgba(228,207,162,0.22) 0%, rgba(180,140,80,0.08) 38%, transparent 68%)',
          filter: 'blur(28px)',
          opacity: 0.55,
        }}
      />
    </div>
  );
}

export function HeroEarthBackdrop() {
  const reducedMotion = usePrefersReducedMotion();
  const webgl = useWebGlAvailable();
  // Same photoreal Earth on mobile and desktop — static only when WebGL / motion blocked.
  const use3d = webgl && !reducedMotion;

  return (
    <div
      className="hero-earth-backdrop pointer-events-none absolute inset-0 overflow-hidden"
      aria-hidden="true"
      data-hero-visual="earth-universe"
      data-earth-palette="landing-gold"
      data-hero-lighting="night-rim"
    >
      {/* Deep space base — planet must own the frame */}
      <div
        className="absolute inset-0"
        style={{
          background:
            'radial-gradient(ellipse at 28% 48%, #0c0e12 0%, #08090d 42%, #05070b 72%, #04060a 100%)',
        }}
      />
      <Starfield />
      <WarmRimLight />

      <div className="absolute inset-0">
        {use3d ? (
          <Suspense fallback={<StaticEarthPlane />}>
            <div className="hero-earth-canvas absolute inset-[-6%_-4%] scale-[1.22]">
              <HeroEarthBackdropScene reducedMotion={reducedMotion} />
            </div>
          </Suspense>
        ) : (
          <StaticEarthPlane />
        )}
      </div>

      {/* Readability veil — keep type legible without burying the planet */}
      <div
        className="absolute inset-0"
        style={{
          background: [
            'radial-gradient(ellipse 42% 30% at 50% 24%, rgba(5,7,11,0.28) 0%, rgba(5,7,11,0.08) 55%, transparent 78%)',
            'linear-gradient(180deg, rgba(5,7,11,0.28) 0%, transparent 14%, transparent 78%, rgba(5,7,11,0.55) 100%)',
            'linear-gradient(90deg, transparent 0%, transparent 82%, rgba(5,7,11,0.22) 100%)',
          ].join(', '),
        }}
      />
    </div>
  );
}
