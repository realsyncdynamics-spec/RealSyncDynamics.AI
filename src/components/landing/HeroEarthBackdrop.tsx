/**
 * Public landing hero backdrop — scaled Earth + sunrise universe scenery.
 *
 * Full-bleed, non-interactive. No Governance Sphere HUD, no drag globe,
 * no DEMO/SIMULATED chrome. Graded to Dark/Gold/Cream (no NASA cyan).
 * Sun rises behind the globe and lights both Earth and the headline plane.
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

/** Prefer static imagery on narrow viewports — cheaper; still sunrise-lit via CSS. */
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
          className="h-full w-full scale-[1.38] object-cover object-[58%_48%] opacity-95"
        />
      </picture>
      {/* CSS terminator — left lit by sunrise, right night */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background: [
            'linear-gradient(105deg, transparent 28%, rgba(5,7,11,0.55) 62%, rgba(5,7,11,0.82) 100%)',
            'radial-gradient(48% 42% at 22% 68%, rgba(255,176,96,0.22) 0%, transparent 70%)',
          ].join(', '),
        }}
      />
    </div>
  );
}

function Starfield() {
  return (
    <div
      className="hero-earth-stars pointer-events-none absolute inset-0 opacity-35"
      aria-hidden="true"
      style={{
        backgroundImage: [
          'radial-gradient(1px 1px at 12% 18%, rgba(242,238,230,0.32), transparent)',
          'radial-gradient(1px 1px at 28% 42%, rgba(228,207,162,0.22), transparent)',
          'radial-gradient(1.5px 1.5px at 48% 12%, rgba(239,230,213,0.28), transparent)',
          'radial-gradient(1px 1px at 63% 28%, rgba(228,207,162,0.18), transparent)',
          'radial-gradient(1px 1px at 78% 16%, rgba(242,238,230,0.24), transparent)',
          'radial-gradient(1px 1px at 88% 48%, rgba(228,207,162,0.14), transparent)',
          'radial-gradient(1.5px 1.5px at 18% 68%, rgba(242,238,230,0.16), transparent)',
          'radial-gradient(1px 1px at 42% 78%, rgba(228,207,162,0.16), transparent)',
          'radial-gradient(1px 1px at 71% 72%, rgba(239,230,213,0.18), transparent)',
          'radial-gradient(1px 1px at 91% 82%, rgba(242,238,230,0.12), transparent)',
        ].join(','),
        backgroundSize: '100% 100%',
      }}
    />
  );
}

/** Cinematic sunrise wash — lights headline plane + Earth limb. */
function SunriseGlow() {
  return (
    <div className="hero-sunrise pointer-events-none absolute inset-0" aria-hidden="true">
      {/* Core sun disc glow — lower-left behind scaled Earth */}
      <div
        className="hero-sunrise-core absolute"
        style={{
          left: '8%',
          bottom: '12%',
          width: 'min(52vw, 620px)',
          height: 'min(52vw, 620px)',
          borderRadius: '50%',
          background:
            'radial-gradient(circle, rgba(255,246,224,0.55) 0%, rgba(255,192,120,0.28) 28%, rgba(255,138,66,0.12) 52%, transparent 72%)',
          filter: 'blur(2px)',
          mixBlendMode: 'screen',
        }}
      />
      {/* Atmospheric bloom rising toward the headline */}
      <div
        className="absolute inset-0 opacity-90 mix-blend-screen"
        style={{
          background: [
            'radial-gradient(55% 48% at 22% 72%, rgba(255,176,96,0.32) 0%, rgba(228,207,162,0.12) 38%, transparent 68%)',
            'radial-gradient(42% 36% at 38% 48%, rgba(255,241,214,0.16) 0%, transparent 65%)',
            'radial-gradient(70% 40% at 50% 28%, rgba(239,230,213,0.1) 0%, transparent 60%)',
            'linear-gradient(18deg, rgba(255,154,85,0.14) 0%, transparent 42%)',
          ].join(', '),
        }}
      />
      {/* Soft light shaft toward centered H1 */}
      <div
        className="hero-sunrise-shaft absolute inset-x-0 top-[8%] mx-auto h-[42%] max-w-[720px] opacity-70 mix-blend-screen"
        style={{
          background:
            'radial-gradient(ellipse 70% 90% at 50% 100%, rgba(255,232,196,0.22) 0%, rgba(228,207,162,0.08) 45%, transparent 72%)',
          filter: 'blur(18px)',
        }}
      />
    </div>
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
      data-hero-lighting="sunrise"
    >
      {/* Deep space base — LANDING_BG family, no cool navy */}
      <div
        className="absolute inset-0"
        style={{
          background:
            'radial-gradient(ellipse at 28% 70%, #12100e 0%, #0a0b0f 38%, #05070b 100%)',
        }}
      />
      <Starfield />
      <SunriseGlow />

      <div className="absolute inset-0">
        {use3d ? (
          <Suspense fallback={<StaticEarthPlane />}>
            <div className="hero-earth-canvas absolute inset-0 scale-[1.12]">
              <HeroEarthBackdropScene reducedMotion={reducedMotion} />
            </div>
          </Suspense>
        ) : (
          <StaticEarthPlane />
        )}
      </div>

      {/* Readability veil — keep cream type legible; leave sunrise corridor open */}
      <div
        className="absolute inset-0"
        style={{
          background: [
            'radial-gradient(ellipse 62% 48% at 50% 36%, rgba(5,7,11,0.55) 0%, rgba(5,7,11,0.28) 48%, rgba(5,7,11,0.12) 72%, transparent 100%)',
            'linear-gradient(180deg, rgba(5,7,11,0.48) 0%, rgba(5,7,11,0.12) 26%, rgba(5,7,11,0.28) 68%, #05070b 100%)',
            'linear-gradient(90deg, rgba(5,7,11,0.22) 0%, transparent 18%, transparent 78%, rgba(5,7,11,0.5) 100%)',
          ].join(', '),
        }}
      />
    </div>
  );
}
