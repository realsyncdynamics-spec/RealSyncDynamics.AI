/**
 * Public landing hero backdrop — full-bleed Earth + sunrise (desktop fill).
 *
 * Scenery only: no Governance Sphere HUD, drag globe, or DEMO chrome.
 * Desktop must not read as empty black bands — Earth + sun crop past edges.
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
          className="h-full w-full scale-[1.55] object-cover object-[42%_45%] opacity-100"
        />
      </picture>
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background: [
            'linear-gradient(100deg, transparent 8%, rgba(5,7,11,0.2) 42%, rgba(5,7,11,0.55) 72%, rgba(5,7,11,0.72) 100%)',
            'radial-gradient(58% 52% at 16% 62%, rgba(255,186,110,0.48) 0%, rgba(255,154,85,0.18) 40%, transparent 68%)',
          ].join(', '),
        }}
      />
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

/** Full-viewport sunrise fill — kills empty black bands on desktop. */
function SunriseGlow() {
  return (
    <div className="hero-sunrise pointer-events-none absolute inset-0" aria-hidden="true">
      {/* Corner / band fill — warm space instead of void */}
      <div
        className="absolute inset-0"
        style={{
          background: [
            'radial-gradient(ellipse 90% 70% at 12% 55%, rgba(40,28,16,0.95) 0%, transparent 55%)',
            'radial-gradient(ellipse 70% 55% at 78% 30%, rgba(18,16,14,0.85) 0%, transparent 50%)',
            'radial-gradient(ellipse 100% 60% at 50% 100%, rgba(28,18,10,0.9) 0%, transparent 45%)',
          ].join(', '),
        }}
      />
      {/* Hard sun disc — left limb */}
      <div
        className="hero-sunrise-core absolute"
        style={{
          left: '2%',
          top: '28%',
          width: 'min(48vw, 560px)',
          height: 'min(48vw, 560px)',
          borderRadius: '50%',
          background:
            'radial-gradient(circle, #fffaf0 0%, #ffe6b8 10%, #ffc078 24%, #ff9a4a 42%, rgba(255,138,66,0.4) 58%, transparent 72%)',
          boxShadow:
            '0 0 80px 28px rgba(255,200,120,0.65), 0 0 180px 60px rgba(255,154,85,0.4), 0 0 280px 100px rgba(228,140,60,0.22)',
          opacity: 0.95,
        }}
      />
      <div
        className="absolute"
        style={{
          left: '-10%',
          top: '10%',
          width: 'min(110vw, 1280px)',
          height: 'min(90vw, 900px)',
          borderRadius: '50%',
          background:
            'radial-gradient(circle, rgba(255,210,140,0.62) 0%, rgba(255,160,70,0.32) 32%, rgba(180,120,50,0.12) 52%, transparent 68%)',
          filter: 'blur(40px)',
          mixBlendMode: 'screen',
        }}
      />
      <div
        className="absolute inset-0 mix-blend-screen"
        style={{
          background: [
            'radial-gradient(70% 60% at 18% 48%, rgba(255,186,110,0.58) 0%, rgba(228,207,162,0.24) 38%, transparent 65%)',
            'radial-gradient(55% 45% at 48% 36%, rgba(255,241,214,0.36) 0%, transparent 60%)',
            'radial-gradient(90% 50% at 50% 12%, rgba(255,232,196,0.22) 0%, transparent 55%)',
            'linear-gradient(28deg, rgba(255,154,85,0.36) 0%, rgba(255,200,120,0.14) 32%, transparent 55%)',
          ].join(', '),
        }}
      />
      <div
        className="hero-sunrise-shaft absolute inset-x-0 top-0 mx-auto h-[58%] max-w-[980px] mix-blend-screen"
        style={{
          background:
            'radial-gradient(ellipse 85% 100% at 50% 100%, rgba(255,236,200,0.55) 0%, rgba(255,192,120,0.26) 42%, transparent 72%)',
          filter: 'blur(10px)',
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
      {/* Warm space base — never flat pure black void */}
      <div
        className="absolute inset-0"
        style={{
          background:
            'radial-gradient(ellipse at 22% 48%, #1a140e 0%, #0e0c0a 36%, #08070a 68%, #05070b 100%)',
        }}
      />
      <Starfield />
      <SunriseGlow />

      <div className="absolute inset-0">
        {use3d ? (
          <Suspense fallback={<StaticEarthPlane />}>
            {/* Crop past edges so desktop has no empty black bands */}
            <div className="hero-earth-canvas absolute inset-[-8%_-6%] scale-[1.28]">
              <HeroEarthBackdropScene reducedMotion={reducedMotion} />
            </div>
          </Suspense>
        ) : (
          <StaticEarthPlane />
        )}
      </div>

      {/* Front sun peek — always visible past Earth limb */}
      <div
        className="pointer-events-none absolute inset-0"
        aria-hidden="true"
        style={{ mixBlendMode: 'screen' }}
      >
        <div
          className="absolute"
          style={{
            left: '3%',
            top: '32%',
            width: 'min(34vw, 380px)',
            height: 'min(34vw, 380px)',
            borderRadius: '50%',
            background:
              'radial-gradient(circle, rgba(255,252,244,1) 0%, rgba(255,220,150,0.82) 18%, rgba(255,170,80,0.42) 42%, transparent 68%)',
            boxShadow: '0 0 100px 40px rgba(255,186,110,0.55)',
            filter: 'blur(1px)',
          }}
        />
        <div
          className="absolute inset-0"
          style={{
            background: [
              'radial-gradient(circle at 10% 42%, rgba(255,250,236,0.5) 0%, rgba(255,200,120,0.28) 14%, transparent 38%)',
              'radial-gradient(ellipse 60% 48% at 30% 48%, rgba(255,176,96,0.32) 0%, transparent 58%)',
              'radial-gradient(ellipse 80% 40% at 50% 22%, rgba(255,232,196,0.22) 0%, transparent 52%)',
            ].join(', '),
          }}
        />
      </div>

      {/* Light veil — readability without punching black holes in the composition */}
      <div
        className="absolute inset-0"
        style={{
          background: [
            'radial-gradient(ellipse 52% 40% at 50% 32%, rgba(5,7,11,0.28) 0%, rgba(5,7,11,0.1) 55%, transparent 80%)',
            'linear-gradient(180deg, rgba(5,7,11,0.22) 0%, transparent 18%, transparent 78%, rgba(5,7,11,0.55) 100%)',
            'linear-gradient(90deg, transparent 0%, transparent 82%, rgba(5,7,11,0.28) 100%)',
          ].join(', '),
        }}
      />
    </div>
  );
}
