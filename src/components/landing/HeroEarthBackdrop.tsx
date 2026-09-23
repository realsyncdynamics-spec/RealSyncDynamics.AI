/**
 * Public landing hero backdrop.
 *
 * First paint: statische Europa-Aufnahme (`/europe-globe.*`).
 * 3D (R3F + Texturen + Basis-Transcoder) erst nach Load/Idle,
 * nie bei reduced-motion oder Save-Data.
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

/** 3D-Chunk + Texturen erst, wenn der First Paint durch ist. */
function useDeferHeavyEarth(reducedMotion: boolean): boolean {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    if (reducedMotion || typeof window === 'undefined') return;
    const nav = navigator as Navigator & {
      connection?: { saveData?: boolean; effectiveType?: string };
      webdriver?: boolean;
    };
    if (nav.webdriver) return;
    if (nav.connection?.saveData) return;
    const slow =
      nav.connection?.effectiveType === '2g' ||
      nav.connection?.effectiveType === 'slow-2g' ||
      nav.connection?.effectiveType === '3g';
    if (slow) return;

    let idleId = 0;
    let timeoutId = 0;
    const arm = () => {
      const start = () => setReady(true);
      const ric = window.requestIdleCallback;
      if (typeof ric === 'function') {
        idleId = ric(start, { timeout: 2500 });
      } else {
        timeoutId = window.setTimeout(start, 1800);
      }
    };
    if (document.readyState === 'complete') arm();
    else window.addEventListener('load', arm, { once: true });
    return () => {
      window.removeEventListener('load', arm);
      if (idleId && typeof window.cancelIdleCallback === 'function') {
        window.cancelIdleCallback(idleId);
      }
      if (timeoutId) window.clearTimeout(timeoutId);
    };
  }, [reducedMotion]);
  return ready;
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
          className="hero-earth-static-img h-full w-full scale-[1.06] object-cover object-[68%_42%] opacity-100 brightness-[1.28] contrast-[1.15] saturate-[1.2]"
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

export function HeroEarthBackdrop() {
  const reducedMotion = usePrefersReducedMotion();
  const allow3d = useDeferHeavyEarth(reducedMotion);

  return (
    <div
      className="hero-earth-backdrop absolute inset-0 overflow-hidden"
      data-hero-visual="earth-universe"
      data-earth-palette="landing-gold"
      data-hero-framing="europe-right"
      data-landing-earth={allow3d ? 'deferred-3d' : 'static'}
      aria-hidden="true"
    >
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(ellipse at 68% 52%, #080a10 0%, #05070c 38%, #02040a 68%, #010308 100%)',
        }}
      />
      <StaticEarthPlane />
      {allow3d ? (
        <Suspense fallback={null}>
          <div className="pointer-events-none absolute inset-0" data-landing-earth-3d="deferred">
            <HeroEarthBackdropScene reducedMotion={false} />
          </div>
        </Suspense>
      ) : null}
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
