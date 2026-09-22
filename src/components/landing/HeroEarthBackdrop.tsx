/**
 * Public landing hero backdrop — full-bleed photoreal Earth.
 * Next-level grade: Europe in frame, brighter limb, lazy 3D orbit.
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

function GoldNetworkOverlay() {
  return (
    <svg
      className="hero-earth-gold-network pointer-events-none absolute inset-0 h-full w-full"
      viewBox="0 0 1376 768"
      preserveAspectRatio="xMidYMid slice"
      aria-hidden="true"
      data-hero-scenery="gold-network"
    >
      <defs>
        <linearGradient id="hero-gold-flow" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#f2e6c8" stopOpacity="0.2" />
          <stop offset="45%" stopColor="#e4cfa2" stopOpacity="0.95" />
          <stop offset="100%" stopColor="#b49a6b" stopOpacity="0.3" />
        </linearGradient>
        <filter id="hero-gold-glow" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="1.6" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      <g fill="none" stroke="url(#hero-gold-flow)" strokeWidth="1.35" filter="url(#hero-gold-glow)" opacity="0.95">
        <path d="M620 310 C700 250, 820 230, 940 270" />
        <path d="M640 360 C740 320, 860 330, 980 370" />
        <path d="M600 400 C700 420, 820 430, 920 410" />
        <path d="M680 280 C760 340, 840 410, 900 470" />
        <path d="M700 250 C800 270, 900 310, 1020 300" />
        <path d="M640 440 C760 420, 880 460, 980 500" />
      </g>
      <g fill="#f2e6c8" filter="url(#hero-gold-glow)">
        <circle cx="620" cy="310" r="2.6" />
        <circle cx="760" cy="270" r="2.4" />
        <circle cx="900" cy="300" r="2.8" />
        <circle cx="980" cy="370" r="2.2" />
        <circle cx="840" cy="410" r="2.3" />
        <circle cx="700" cy="250" r="2.1" />
      </g>
    </svg>
  );
}

function StaticEarthPlane() {
  return (
    <div className="hero-earth-static pointer-events-none absolute inset-0" aria-hidden="true" data-hero-framing="europe-right">
      <picture>
        <source srcSet="/europe-globe.webp" type="image/webp" />
        <img
          src="/europe-globe.jpg"
          alt=""
          width={1376}
          height={768}
          decoding="async"
          fetchPriority="high"
          className="hero-earth-static-img h-full w-full scale-[1.06] object-cover object-[56%_40%] opacity-100 brightness-[1.42] contrast-[1.2] saturate-[1.25]"
        />
      </picture>
      <GoldNetworkOverlay />
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'linear-gradient(90deg, rgba(5,7,11,0.55) 0%, rgba(5,7,11,0.16) 28%, transparent 50%)',
        }}
      />
    </div>
  );
}

function Starfield() {
  return (
    <div className="hero-earth-stars pointer-events-none absolute inset-0" aria-hidden="true">
      <div
        className="hero-earth-stars-far absolute inset-0"
        style={{
          backgroundImage: [
            'radial-gradient(1px 1px at 8% 12%, rgba(242,238,230,0.8), transparent)',
            'radial-gradient(1.5px 1.5px at 22% 8%, rgba(239,230,213,0.7), transparent)',
            'radial-gradient(1px 1px at 48% 6%, rgba(242,238,230,0.65), transparent)',
            'radial-gradient(2px 2px at 71% 10%, rgba(255,248,235,0.85), transparent)',
            'radial-gradient(1px 1px at 91% 18%, rgba(208,195,164,0.55), transparent)',
            'radial-gradient(1.5px 1.5px at 14% 28%, rgba(239,230,213,0.5), transparent)',
            'radial-gradient(1px 1px at 36% 22%, rgba(242,238,230,0.45), transparent)',
            'radial-gradient(1px 1px at 62% 30%, rgba(208,195,164,0.4), transparent)',
          ].join(','),
        }}
      />
    </div>
  );
}

function WarmRimLight() {
  return (
    <div className="hero-sunrise pointer-events-none absolute inset-0" aria-hidden="true">
      <div
        className="absolute"
        style={{
          left: '48%',
          top: '18%',
          width: 'min(36vw, 420px)',
          height: 'min(42vw, 480px)',
          borderRadius: '50%',
          background:
            'radial-gradient(ellipse at 40% 48%, rgba(255,210,140,0.32) 0%, rgba(200,150,70,0.12) 42%, transparent 72%)',
          filter: 'blur(26px)',
          opacity: 0.8,
        }}
      />
    </div>
  );
}

export function HeroEarthBackdrop() {
  const reducedMotion = usePrefersReducedMotion();

  return (
    <div
      className="hero-earth-backdrop absolute inset-0 overflow-hidden"
      data-hero-visual="earth-universe"
      data-earth-palette="landing-gold"
      data-hero-lighting="europe-day-limb"
      data-hero-scenery="europe-night-gold-network"
      data-hero-framing="europe-right"
      data-landing-earth="static"
      aria-hidden="true"
    >
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(ellipse at 68% 52%, #080a10 0%, #05070c 38%, #02040a 68%, #010308 100%)',
        }}
      />
      <WarmRimLight />
      {reducedMotion ? (
        <StaticEarthPlane />
      ) : (
        <Suspense fallback={<StaticEarthPlane />}>
          <div className="pointer-events-none absolute inset-0" data-landing-earth-3d="orbit-europe">
            <HeroEarthBackdropScene reducedMotion={false} />
          </div>
        </Suspense>
      )}
      <div className="hero-earth-space-scenery pointer-events-none absolute inset-0" data-hero-scenery-layer="sky">
        <Starfield />
      </div>
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background: [
            'linear-gradient(90deg, rgba(5,7,11,0.35) 0%, rgba(5,7,11,0.08) 32%, transparent 52%)',
            'linear-gradient(180deg, rgba(5,7,11,0.18) 0%, transparent 14%, transparent 72%, rgba(5,7,11,0.35) 100%)',
          ].join(', '),
        }}
      />
    </div>
  );
}
