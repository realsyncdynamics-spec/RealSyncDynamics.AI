/**
 * Public landing hero backdrop — full-bleed photoreal Earth (desktop fill).
 *
 * Passive scenery behind Dominik copy: pointer-events none so CTAs stay
 * clickable. Europe-night plate (limb framing) + gold route network — static
 * so UK/FR/DE/IT stay first-recognize (no Americas drift). No Sphere DEMO
 * chrome, no continent UI labels.
 *
 * Deep-space layer: CSS starfield + distant Mars/Jupiter/Saturn discs, plus an
 * occasional drifting Moon (reduced-motion: faint static moon, no drift).
 */
import { useEffect, useState } from 'react';

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

/**
 * Gold route/network overlay for static first-paint — aligns with Europe on
 * the right. No labels / KPI chips; pointer-events none via host.
 */
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
          <stop offset="0%" stopColor="#f2e6c8" stopOpacity="0.15" />
          <stop offset="45%" stopColor="#e4cfa2" stopOpacity="0.85" />
          <stop offset="100%" stopColor="#b49a6b" stopOpacity="0.25" />
        </linearGradient>
        <filter id="hero-gold-glow" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="1.4" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      <g
        fill="none"
        stroke="url(#hero-gold-flow)"
        strokeWidth="1.15"
        filter="url(#hero-gold-glow)"
        opacity="0.9"
      >
        <path d="M720 290 C780 250, 860 240, 940 270" className="hero-gold-arc" />
        <path d="M760 320 C820 300, 900 310, 980 350" className="hero-gold-arc" />
        <path d="M700 340 C760 380, 840 400, 920 390" className="hero-gold-arc" />
        <path d="M780 280 C820 340, 860 400, 900 460" className="hero-gold-arc" />
        <path d="M680 300 C740 280, 800 320, 850 380" className="hero-gold-arc" />
        <path d="M820 260 C880 280, 940 320, 1000 300" className="hero-gold-arc" />
        <path d="M740 360 C800 340, 880 360, 960 420" className="hero-gold-arc" />
        <path d="M860 300 C900 360, 940 400, 1020 380" className="hero-gold-arc" />
        <path d="M720 420 C800 400, 880 440, 960 480" className="hero-gold-arc" />
        <path d="M660 280 C720 240, 800 220, 880 250" className="hero-gold-arc" />
        <path d="M900 340 C940 300, 1000 280, 1080 310" className="hero-gold-arc" />
        <path d="M780 400 C840 440, 900 470, 980 460" className="hero-gold-arc" />
      </g>
      <g fill="#f2e6c8" filter="url(#hero-gold-glow)">
        <circle cx="720" cy="290" r="2.4" opacity="0.95" />
        <circle cx="780" cy="280" r="2.2" opacity="0.9" />
        <circle cx="860" cy="300" r="2.6" opacity="0.95" />
        <circle cx="940" cy="270" r="2.1" opacity="0.85" />
        <circle cx="900" cy="390" r="2.3" opacity="0.9" />
        <circle cx="820" cy="360" r="2.0" opacity="0.85" />
        <circle cx="980" cy="350" r="2.2" opacity="0.88" />
        <circle cx="760" cy="340" r="1.9" opacity="0.8" />
        <circle cx="1000" cy="300" r="2.0" opacity="0.82" />
        <circle cx="920" cy="460" r="1.8" opacity="0.78" />
        <circle cx="680" cy="300" r="2.1" opacity="0.86" />
        <circle cx="1080" cy="310" r="1.7" opacity="0.75" />
      </g>
    </svg>
  );
}

/** Night-Europe photoreal plane — continent fills right; left void for copy. */
function StaticEarthPlane({ className = '' }: { className?: string }) {
  return (
    <div
      className={`hero-earth-static pointer-events-none absolute inset-0 ${className}`.trim()}
      aria-hidden="true"
      data-hero-framing="europe-right"
    >
      <picture>
        <source srcSet="/europe-globe.webp" type="image/webp" />
        <img
          src="/europe-globe.jpg"
          alt=""
          width={1376}
          height={768}
          decoding="async"
          fetchPriority="high"
          className="hero-earth-static-img h-full w-full scale-[1.18] object-cover object-[82%_38%] opacity-100"
        />
      </picture>
      <GoldNetworkOverlay />
      {/* Soft left veil for type — no muddy gold wash over Europe */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'linear-gradient(90deg, rgba(5,7,11,0.62) 0%, rgba(5,7,11,0.22) 26%, transparent 48%)',
        }}
      />
    </div>
  );
}

/**
 * Night-space starfield — denser than a flat void; cream/gold pinpoints only.
 * Layers stay behind Earth + type; never compete with H1.
 */
function Starfield() {
  return (
    <div className="hero-earth-stars pointer-events-none absolute inset-0" aria-hidden="true">
      {/* Far field — dense dust */}
      <div
        className="hero-earth-stars-far absolute inset-0"
        style={{
          backgroundImage: [
            'radial-gradient(1px 1px at 4% 9%, rgba(242,238,230,0.75), transparent)',
            'radial-gradient(1px 1px at 9% 22%, rgba(208,195,164,0.58), transparent)',
            'radial-gradient(1.5px 1.5px at 14% 6%, rgba(239,230,213,0.72), transparent)',
            'radial-gradient(1px 1px at 19% 31%, rgba(242,238,230,0.48), transparent)',
            'radial-gradient(1px 1px at 24% 14%, rgba(208,195,164,0.55), transparent)',
            'radial-gradient(1px 1px at 31% 4%, rgba(239,230,213,0.68), transparent)',
            'radial-gradient(1.5px 1.5px at 37% 19%, rgba(242,238,230,0.58), transparent)',
            'radial-gradient(1px 1px at 43% 8%, rgba(208,195,164,0.42), transparent)',
            'radial-gradient(1px 1px at 49% 26%, rgba(239,230,213,0.5), transparent)',
            'radial-gradient(1px 1px at 55% 11%, rgba(242,238,230,0.62), transparent)',
            'radial-gradient(1.5px 1.5px at 61% 3%, rgba(208,195,164,0.58), transparent)',
            'radial-gradient(1px 1px at 67% 17%, rgba(239,230,213,0.45), transparent)',
            'radial-gradient(1px 1px at 73% 7%, rgba(242,238,230,0.7), transparent)',
            'radial-gradient(1px 1px at 79% 24%, rgba(208,195,164,0.48), transparent)',
            'radial-gradient(1.5px 1.5px at 85% 9%, rgba(239,230,213,0.62), transparent)',
            'radial-gradient(1px 1px at 91% 20%, rgba(242,238,230,0.52), transparent)',
            'radial-gradient(1px 1px at 96% 5%, rgba(208,195,164,0.6), transparent)',
            'radial-gradient(1px 1px at 7% 38%, rgba(242,238,230,0.4), transparent)',
            'radial-gradient(1px 1px at 16% 42%, rgba(208,195,164,0.32), transparent)',
            'radial-gradient(1px 1px at 28% 36%, rgba(239,230,213,0.38), transparent)',
            'radial-gradient(1.5px 1.5px at 52% 32%, rgba(242,238,230,0.42), transparent)',
            'radial-gradient(1px 1px at 64% 40%, rgba(208,195,164,0.3), transparent)',
            'radial-gradient(1px 1px at 81% 34%, rgba(239,230,213,0.4), transparent)',
            'radial-gradient(1px 1px at 93% 38%, rgba(242,238,230,0.34), transparent)',
            'radial-gradient(1px 1px at 12% 48%, rgba(208,195,164,0.26), transparent)',
            'radial-gradient(1px 1px at 38% 46%, rgba(239,230,213,0.28), transparent)',
            'radial-gradient(1px 1px at 58% 50%, rgba(242,238,230,0.22), transparent)',
            'radial-gradient(1px 1px at 76% 48%, rgba(208,195,164,0.24), transparent)',
            'radial-gradient(1px 1px at 88% 52%, rgba(239,230,213,0.2), transparent)',
            'radial-gradient(1px 1px at 98% 44%, rgba(242,238,230,0.28), transparent)',
          ].join(','),
          backgroundSize: '100% 100%',
        }}
      />
      {/* Near field — brighter pinpoints + soft nebula haze */}
      <div
        className="hero-earth-stars-near absolute inset-0"
        style={{
          backgroundImage: [
            'radial-gradient(2px 2px at 18% 10%, rgba(255,248,235,0.9), transparent)',
            'radial-gradient(2.5px 2.5px at 52% 5%, rgba(242,238,230,0.78), transparent)',
            'radial-gradient(2px 2px at 78% 11%, rgba(228,207,162,0.85), transparent)',
            'radial-gradient(2px 2px at 66% 22%, rgba(255,248,235,0.55), transparent)',
            'radial-gradient(1.5px 1.5px at 36% 14%, rgba(208,195,164,0.7), transparent)',
            'radial-gradient(2px 2px at 88% 18%, rgba(255,248,235,0.65), transparent)',
            'radial-gradient(1.5px 1.5px at 8% 16%, rgba(239,230,213,0.72), transparent)',
            'radial-gradient(2px 2px at 44% 7%, rgba(255,248,235,0.6), transparent)',
            'radial-gradient(ellipse 32% 14% at 80% 6%, rgba(100,78,42,0.22), transparent)',
            'radial-gradient(ellipse 20% 12% at 16% 18%, rgba(48,56,90,0.16), transparent)',
          ].join(','),
          backgroundSize: '100% 100%',
        }}
      />
    </div>
  );
}

/**
 * Distant, non-interactive solar-system discs in the dark sky (right / upper).
 * Pure CSS — no textures, no pointer capture, never a second hero widget.
 */
function DistantPlanets() {
  return (
    <div
      className="hero-earth-planets pointer-events-none absolute inset-0"
      aria-hidden="true"
      data-hero-scenery="planets"
    >
      {/* Mars — small rust disc, far upper-right */}
      <div
        className="hero-planet hero-planet-mars absolute"
        data-planet="mars"
        style={{
          top: '7%',
          right: '11%',
          width: 'clamp(14px, 1.7vw, 22px)',
          height: 'clamp(14px, 1.7vw, 22px)',
          borderRadius: '50%',
          background:
            'radial-gradient(circle at 32% 30%, #e08a62 0%, #c45a3a 38%, #7a2e1c 78%, #3a1410 100%)',
          boxShadow: '0 0 12px 2px rgba(180, 70, 40, 0.4)',
          opacity: 0.88,
        }}
      />

      {/* Jupiter — banded, larger than Mars, mid-upper right */}
      <div
        className="hero-planet hero-planet-jupiter absolute"
        data-planet="jupiter"
        style={{
          top: '4%',
          right: '26%',
          width: 'clamp(34px, 4.2vw, 56px)',
          height: 'clamp(34px, 4.2vw, 56px)',
          borderRadius: '50%',
          background: [
            'radial-gradient(circle at 34% 28%, rgba(255,240,210,0.4) 0%, transparent 42%)',
            'repeating-linear-gradient(180deg, #e8d2b0 0 14%, #c4a078 14% 22%, #d8bc94 22% 34%, #a87848 34% 42%, #d0b490 42% 56%, #b89060 56% 68%, #e0c8a0 68% 82%, #9a7048 82% 100%)',
          ].join(', '),
          boxShadow: '0 0 18px 4px rgba(180, 140, 80, 0.35)',
          opacity: 0.86,
        }}
      />

      {/* Saturn — cream body + tilted rings */}
      <div
        className="hero-planet hero-planet-saturn absolute"
        data-planet="saturn"
        style={{
          top: '14%',
          right: '4%',
          width: 'clamp(26px, 3.2vw, 42px)',
          height: 'clamp(26px, 3.2vw, 42px)',
          opacity: 0.84,
        }}
      >
        <div
          className="absolute inset-0 rounded-full"
          style={{
            background:
              'radial-gradient(circle at 36% 30%, #f2e6c8 0%, #e0cba0 40%, #b89860 78%, #6a5430 100%)',
            boxShadow: '0 0 12px 2px rgba(200, 170, 100, 0.28)',
          }}
        />
        <div
          className="absolute left-1/2 top-1/2"
          style={{
            width: '210%',
            height: '42%',
            marginLeft: '-105%',
            marginTop: '-21%',
            borderRadius: '50%',
            border: '1.5px solid rgba(216, 196, 154, 0.55)',
            boxShadow:
              'inset 0 0 0 3px rgba(180, 150, 90, 0.22), 0 0 0 1px rgba(232, 220, 180, 0.18)',
            transform: 'rotate(-22deg)',
            background:
              'linear-gradient(90deg, transparent 0%, rgba(216,196,154,0.12) 22%, transparent 38%, transparent 62%, rgba(216,196,154,0.1) 78%, transparent 100%)',
          }}
        />
      </div>
    </div>
  );
}

/**
 * Occasional Moon — slow drift / fade cycle. Reduced-motion: faint parked disc
 * in the far sky (not on the headline), no animation.
 */
function OccasionalMoon({ reducedMotion }: { reducedMotion: boolean }) {
  if (reducedMotion) {
    return (
      <div
        className="hero-earth-moon hero-earth-moon-static pointer-events-none absolute"
        aria-hidden="true"
        data-hero-scenery="moon"
        style={{
          top: '9%',
          right: '38%',
          width: 'clamp(14px, 1.8vw, 22px)',
          height: 'clamp(14px, 1.8vw, 22px)',
          borderRadius: '50%',
          background:
            'radial-gradient(circle at 30% 28%, #f0ebe0 0%, #c8c0b0 45%, #7a7468 100%)',
          boxShadow: '0 0 14px 3px rgba(220, 210, 190, 0.2)',
          opacity: 0.28,
        }}
      />
    );
  }

  return (
    <div
      className="hero-earth-moon hero-earth-moon-drift pointer-events-none absolute"
      aria-hidden="true"
      data-hero-scenery="moon"
    >
      <div
        className="hero-earth-moon-disc absolute"
        style={{
          width: 'clamp(16px, 2vw, 26px)',
          height: 'clamp(16px, 2vw, 26px)',
          borderRadius: '50%',
          background:
            'radial-gradient(circle at 30% 28%, #f5f0e6 0%, #d0c8b8 42%, #8a8478 100%)',
          boxShadow: '0 0 18px 4px rgba(230, 220, 200, 0.25)',
        }}
      />
    </div>
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
        className="absolute"
        style={{
          left: '62%',
          top: '22%',
          width: 'min(28vw, 320px)',
          height: 'min(36vw, 400px)',
          borderRadius: '50%',
          background:
            'radial-gradient(ellipse at 40% 48%, rgba(208,195,164,0.1) 0%, rgba(180,140,80,0.04) 40%, transparent 70%)',
          filter: 'blur(32px)',
          opacity: 0.4,
        }}
      />
    </div>
  );
}

export function HeroEarthBackdrop() {
  // Europe-lock: use the photoreal Europe night plate + gold network only.
  // WebGL idle framing has repeatedly drifted to the Americas on `/` — static
  // plate keeps UK/FR/DE/IT as the first-recognize continent (Dominik PNG).
  const reducedMotion = usePrefersReducedMotion();

  return (
    <div
      className="hero-earth-backdrop absolute inset-0 overflow-hidden"
      data-hero-visual="earth-universe"
      data-earth-palette="landing-gold"
      data-hero-lighting="europe-night"
      data-hero-scenery="europe-night-gold-network"
      data-hero-framing="europe-right"
      data-landing-earth="static"
      aria-hidden="true"
    >
      {/* Deep space base — void around Europe for stars / planets / moon */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(ellipse at 68% 52%, #080a10 0%, #05070c 38%, #02040a 68%, #010308 100%)',
        }}
      />
      <WarmRimLight />

      {/* Photoreal Europe night on the limb — city lights + gold arcs */}
      <StaticEarthPlane />

      {/* Night-space scenery ABOVE Earth, masked to left/upper void —
          never covers Dominik H1 column (left veil stays on top). */}
      <div
        className="hero-earth-space-scenery pointer-events-none absolute inset-0"
        data-hero-scenery-layer="sky"
      >
        <Starfield />
        <DistantPlanets />
        <OccasionalMoon reducedMotion={reducedMotion} />
      </div>

      {/* Type veil — left column only; Europe city lights stay the visual anchor */}
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
