/**
 * Public landing hero backdrop — Earth + universe scenery only.
 *
 * Full-bleed, non-interactive. No Governance Sphere HUD, no drag globe,
 * no DEMO/SIMULATED chrome. Graded to Dark/Gold/Cream (no NASA cyan).
 * Text readability comes from the dark veil.
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

/** Prefer static imagery on narrow viewports — cheaper and still cinematic. */
function usePreferStaticBackdrop(): boolean {
  const [staticOnly, setStaticOnly] = useState(false);
  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;
    const mq = window.matchMedia('(max-width: 900px)');
    const update = () => setStaticOnly(mq.matches);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, []);
  return staticOnly;
}

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
          className="h-full w-full scale-[1.18] object-cover object-[62%_42%] opacity-90"
        />
      </picture>
    </div>
  );
}

function Starfield() {
  return (
    <div
      className="hero-earth-stars pointer-events-none absolute inset-0 opacity-40"
      aria-hidden="true"
      style={{
        backgroundImage: [
          'radial-gradient(1px 1px at 12% 18%, rgba(242,238,230,0.35), transparent)',
          'radial-gradient(1px 1px at 28% 42%, rgba(228,207,162,0.28), transparent)',
          'radial-gradient(1.5px 1.5px at 48% 12%, rgba(239,230,213,0.32), transparent)',
          'radial-gradient(1px 1px at 63% 28%, rgba(228,207,162,0.22), transparent)',
          'radial-gradient(1px 1px at 78% 16%, rgba(242,238,230,0.28), transparent)',
          'radial-gradient(1px 1px at 88% 48%, rgba(228,207,162,0.18), transparent)',
          'radial-gradient(1.5px 1.5px at 18% 68%, rgba(242,238,230,0.2), transparent)',
          'radial-gradient(1px 1px at 42% 78%, rgba(228,207,162,0.2), transparent)',
          'radial-gradient(1px 1px at 71% 72%, rgba(239,230,213,0.22), transparent)',
          'radial-gradient(1px 1px at 91% 82%, rgba(242,238,230,0.16), transparent)',
        ].join(','),
        backgroundSize: '100% 100%',
      }}
    />
  );
}

export function HeroEarthBackdrop() {
  const reducedMotion = usePrefersReducedMotion();
  const webgl = useWebGlAvailable();
  const preferStatic = usePreferStaticBackdrop();
  const use3d = webgl && !reducedMotion && !preferStatic;

  return (
    <div
      className="hero-earth-backdrop pointer-events-none absolute inset-0 overflow-hidden"
      aria-hidden="true"
      data-hero-visual="earth-universe"
      data-earth-palette="landing-gold"
    >
      {/* Deep space base — LANDING_BG family, no cool navy */}
      <div
        className="absolute inset-0"
        style={{
          background:
            'radial-gradient(ellipse at 68% 58%, #0c0e12 0%, #07090d 42%, #05070b 100%)',
        }}
      />
      <Starfield />

      {/* Soft gold/amber atmosphere wash only — no blue/cyan */}
      <div
        className="absolute inset-0 opacity-45 mix-blend-screen"
        style={{
          background: [
            'radial-gradient(42% 36% at 72% 62%, rgba(180,154,107,0.18) 0%, transparent 70%)',
            'radial-gradient(28% 24% at 58% 78%, rgba(228,207,162,0.16) 0%, transparent 72%)',
            'radial-gradient(22% 18% at 78% 48%, rgba(239,230,213,0.08) 0%, transparent 65%)',
          ].join(', '),
        }}
      />

      <div className="absolute inset-0">
        {use3d ? (
          <Suspense fallback={<StaticEarthPlane />}>
            <div className="hero-earth-canvas absolute inset-0 scale-[1.05]">
              <HeroEarthBackdropScene reducedMotion={reducedMotion} />
            </div>
          </Suspense>
        ) : (
          <StaticEarthPlane />
        )}
      </div>

      {/* Readability veil — keeps centered cream type legible */}
      <div
        className="absolute inset-0"
        style={{
          background: [
            'radial-gradient(ellipse 70% 55% at 50% 42%, rgba(5,7,11,0.72) 0%, rgba(5,7,11,0.42) 45%, rgba(5,7,11,0.18) 70%, transparent 100%)',
            'linear-gradient(180deg, rgba(5,7,11,0.55) 0%, rgba(5,7,11,0.22) 28%, rgba(5,7,11,0.35) 68%, #05070b 100%)',
            'linear-gradient(90deg, rgba(5,7,11,0.55) 0%, transparent 22%, transparent 78%, rgba(5,7,11,0.45) 100%)',
          ].join(', '),
        }}
      />
    </div>
  );
}
