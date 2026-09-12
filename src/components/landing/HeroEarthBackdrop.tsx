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
            'linear-gradient(108deg, transparent 18%, rgba(5,7,11,0.35) 48%, rgba(5,7,11,0.78) 78%, rgba(5,7,11,0.9) 100%)',
            'radial-gradient(52% 48% at 18% 72%, rgba(255,186,110,0.38) 0%, rgba(255,154,85,0.14) 42%, transparent 70%)',
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

/** Cinematic sunrise wash — lights headline plane + Earth limb. Must read
 *  even when WebGL falls back to software / static (CI screenshot hosts). */
function SunriseGlow() {
  return (
    <div className="hero-sunrise pointer-events-none absolute inset-0" aria-hidden="true">
      {/* Core sun disc — lower-left rising behind scaled Earth */}
      <div
        className="hero-sunrise-core absolute"
        style={{
          left: '2%',
          bottom: '6%',
          width: 'min(68vw, 780px)',
          height: 'min(68vw, 780px)',
          borderRadius: '50%',
          background:
            'radial-gradient(circle, rgba(255,250,236,0.95) 0%, rgba(255,210,140,0.72) 16%, rgba(255,160,70,0.42) 36%, rgba(228,140,60,0.16) 54%, transparent 70%)',
          filter: 'blur(1px)',
          mixBlendMode: 'screen',
        }}
      />
      {/* Secondary corona bloom */}
      <div
        className="absolute"
        style={{
          left: '-4%',
          bottom: '0%',
          width: 'min(90vw, 980px)',
          height: 'min(70vw, 720px)',
          borderRadius: '50%',
          background:
            'radial-gradient(circle, rgba(255,176,96,0.45) 0%, rgba(255,138,66,0.18) 40%, transparent 68%)',
          filter: 'blur(28px)',
          mixBlendMode: 'screen',
        }}
      />
      {/* Atmospheric bloom rising toward the headline */}
      <div
        className="absolute inset-0 mix-blend-screen"
        style={{
          background: [
            'radial-gradient(60% 52% at 20% 74%, rgba(255,186,110,0.48) 0%, rgba(228,207,162,0.2) 36%, transparent 66%)',
            'radial-gradient(48% 40% at 42% 42%, rgba(255,241,214,0.28) 0%, transparent 62%)',
            'radial-gradient(80% 46% at 50% 22%, rgba(255,232,196,0.2) 0%, transparent 58%)',
            'linear-gradient(22deg, rgba(255,154,85,0.28) 0%, rgba(255,200,120,0.1) 28%, transparent 52%)',
          ].join(', '),
        }}
      />
      {/* Soft light shaft toward centered H1 */}
      <div
        className="hero-sunrise-shaft absolute inset-x-0 top-[4%] mx-auto h-[48%] max-w-[820px] mix-blend-screen"
        style={{
          background:
            'radial-gradient(ellipse 78% 100% at 50% 100%, rgba(255,236,200,0.42) 0%, rgba(255,192,120,0.18) 40%, transparent 72%)',
          filter: 'blur(14px)',
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

      {/* Front sunrise — screen-blend so the sun still reads if WebGL flakes */}
      <div
        className="pointer-events-none absolute inset-0 mix-blend-screen"
        aria-hidden="true"
        style={{
          background: [
            'radial-gradient(circle at 14% 78%, rgba(255,250,236,0.55) 0%, rgba(255,200,120,0.28) 14%, rgba(255,150,70,0.12) 28%, transparent 46%)',
            'radial-gradient(ellipse 55% 40% at 28% 70%, rgba(255,176,96,0.22) 0%, transparent 60%)',
            'radial-gradient(ellipse 70% 35% at 48% 30%, rgba(255,232,196,0.14) 0%, transparent 55%)',
          ].join(', '),
        }}
      />

      {/* Readability veil — keep cream type legible; leave sunrise corridor open */}
      <div
        className="absolute inset-0"
        style={{
          background: [
            'radial-gradient(ellipse 58% 44% at 52% 34%, rgba(5,7,11,0.42) 0%, rgba(5,7,11,0.18) 50%, transparent 78%)',
            'linear-gradient(180deg, rgba(5,7,11,0.4) 0%, rgba(5,7,11,0.06) 24%, rgba(5,7,11,0.2) 70%, #05070b 100%)',
            'linear-gradient(90deg, rgba(5,7,11,0.08) 0%, transparent 16%, transparent 72%, rgba(5,7,11,0.48) 100%)',
          ].join(', '),
        }}
      />
    </div>
  );
}
