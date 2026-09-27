/**
 * Public landing hero backdrop — feste Europa-Nachtansicht.
 *
 * Keine 3D-Kugel, kein Orbit. Dieselbe Aufnahme wie /europe-globe.*
 * rechts im Rahmen, links abgedunkelt für die Copy.
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
          <stop offset="0%" stopColor="#7ec8e3" stopOpacity="0.15" />
          <stop offset="45%" stopColor="#e4cfa2" stopOpacity="0.85" />
          <stop offset="100%" stopColor="#4aa8c9" stopOpacity="0.35" />
        </linearGradient>
        <filter id="hero-gold-glow" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="1.6" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      <g fill="none" stroke="url(#hero-gold-flow)" strokeWidth="1.2" filter="url(#hero-gold-glow)" opacity="0.8">
        <path d="M620 310 C700 250, 820 230, 940 270" />
        <path d="M640 360 C740 320, 860 330, 980 370" />
        <path d="M600 400 C700 420, 820 430, 920 410" />
        <path d="M680 280 C760 340, 840 410, 900 470" />
        <path d="M700 250 C800 270, 900 310, 1020 300" />
        <path d="M640 440 C760 420, 880 460, 980 500" />
      </g>
      <g fill="#d7eef7" filter="url(#hero-gold-glow)">
        <circle cx="620" cy="310" r="2.4" />
        <circle cx="760" cy="270" r="2.2" />
        <circle cx="900" cy="300" r="2.6" />
        <circle cx="980" cy="370" r="2.1" />
        <circle cx="840" cy="410" r="2.2" />
        <circle cx="700" cy="250" r="2.0" />
      </g>
    </svg>
  );
}

function StaticEuropeStill() {
  return (
    <div
      className="hero-earth-static pointer-events-none absolute inset-0"
      aria-hidden="true"
      data-hero-framing="europe-right-still"
    >
      <picture>
        <source srcSet="/europe-globe.webp" type="image/webp" />
        <img
          src="/europe-globe.jpg"
          alt=""
          width={1920}
          height={1080}
          decoding="async"
          fetchPriority="high"
          className="hero-earth-static-img h-full w-full scale-[1.02] object-cover object-[72%_48%] opacity-100 brightness-[1.15] contrast-[1.12] saturate-[1.2]"
        />
      </picture>
      <GoldNetworkOverlay />
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'linear-gradient(105deg, rgba(2,4,10,0.88) 0%, rgba(2,4,10,0.62) 28%, rgba(2,4,10,0.22) 52%, transparent 72%)',
        }}
      />
    </div>
  );
}

export function HeroEarthBackdrop() {
  return (
    <div
      className="hero-earth-backdrop absolute inset-0 overflow-hidden"
      data-hero-visual="europe-night-still"
      data-earth-palette="landing-gold"
      data-hero-framing="europe-right"
      data-landing-earth="static"
      aria-hidden="true"
    >
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(ellipse at 72% 48%, #080a10 0%, #05070c 38%, #02040a 68%, #010308 100%)',
        }}
      />
      <StaticEuropeStill />
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background: [
            'linear-gradient(90deg, rgba(5,7,11,0.28) 0%, rgba(5,7,11,0.06) 34%, transparent 56%)',
            'linear-gradient(180deg, rgba(5,7,11,0.16) 0%, transparent 16%, transparent 78%, rgba(5,7,11,0.4) 100%)',
          ].join(', '),
        }}
      />
    </div>
  );
}
