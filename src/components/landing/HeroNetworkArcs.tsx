/**
 * Decorative cyan network arcs over the Europe night-Earth hero.
 * Purely visual — no interactive hits, no fake live metrics.
 */
export function HeroNetworkArcs({ className = '' }: { className?: string }) {
  return (
    <svg
      className={`pointer-events-none absolute inset-0 h-full w-full ${className}`}
      viewBox="0 0 1440 900"
      preserveAspectRatio="xMidYMid slice"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="hero-arc-grad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#22d3ee" stopOpacity="0" />
          <stop offset="35%" stopColor="#22d3ee" stopOpacity="0.55" />
          <stop offset="70%" stopColor="#67e8f9" stopOpacity="0.35" />
          <stop offset="100%" stopColor="#22d3ee" stopOpacity="0" />
        </linearGradient>
        <filter id="hero-arc-glow" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="2.2" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      <g fill="none" stroke="url(#hero-arc-grad)" strokeWidth="1.25" filter="url(#hero-arc-glow)">
        <path d="M720 520 C 860 380, 1040 300, 1280 260" />
        <path d="M680 560 C 820 420, 1100 340, 1380 420" opacity="0.7" />
        <path d="M640 600 C 780 480, 980 520, 1220 640" opacity="0.55" />
        <path d="M760 480 C 920 360, 1080 280, 1320 220" opacity="0.8" />
        <path d="M700 640 C 900 580, 1120 500, 1360 540" opacity="0.45" />
        <path d="M600 500 C 740 360, 900 280, 1100 240" opacity="0.5" />
      </g>

      <g fill="#67e8f9" filter="url(#hero-arc-glow)">
        <circle cx="860" cy="400" r="2.5" opacity="0.9" />
        <circle cx="980" cy="340" r="2" opacity="0.75" />
        <circle cx="1120" cy="300" r="2.5" opacity="0.85" />
        <circle cx="1240" cy="280" r="2" opacity="0.7" />
        <circle cx="1180" cy="480" r="2.2" opacity="0.65" />
        <circle cx="1040" cy="520" r="1.8" opacity="0.55" />
        <circle cx="900" cy="460" r="2" opacity="0.7" />
        <circle cx="780" cy="420" r="1.6" opacity="0.5" />
      </g>
    </svg>
  );
}
