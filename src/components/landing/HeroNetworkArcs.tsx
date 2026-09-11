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
        <linearGradient id="hero-arc-grad" x1="0%" y1="0%" x2="100%" y2="80%">
          <stop offset="0%" stopColor="#22d3ee" stopOpacity="0" />
          <stop offset="25%" stopColor="#22d3ee" stopOpacity="0.7" />
          <stop offset="55%" stopColor="#67e8f9" stopOpacity="0.45" />
          <stop offset="100%" stopColor="#22d3ee" stopOpacity="0" />
        </linearGradient>
        <filter id="hero-arc-glow" x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation="2.8" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* Dense mesh over Europe / right half — matches mock FUI density */}
      <g fill="none" stroke="url(#hero-arc-grad)" strokeWidth="1.35" filter="url(#hero-arc-glow)">
        <path d="M640 560 C 780 420, 980 300, 1280 240" />
        <path d="M620 600 C 820 460, 1080 340, 1360 380" opacity="0.85" />
        <path d="M600 640 C 760 520, 980 500, 1260 620" opacity="0.65" />
        <path d="M680 500 C 860 360, 1060 260, 1340 200" opacity="0.9" />
        <path d="M700 660 C 900 580, 1140 480, 1380 520" opacity="0.55" />
        <path d="M580 520 C 740 380, 920 280, 1140 220" opacity="0.6" />
        <path d="M720 480 C 900 400, 1100 420, 1320 560" opacity="0.5" />
        <path d="M660 700 C 860 640, 1080 560, 1300 580" opacity="0.4" />
        <path d="M760 440 C 940 320, 1120 240, 1360 180" opacity="0.75" />
      </g>

      <g fill="#67e8f9" filter="url(#hero-arc-glow)">
        <circle cx="820" cy="430" r="2.8" opacity="0.95" />
        <circle cx="920" cy="360" r="2.2" opacity="0.85" />
        <circle cx="1020" cy="310" r="2.6" opacity="0.9" />
        <circle cx="1140" cy="270" r="2.2" opacity="0.8" />
        <circle cx="1240" cy="250" r="2.4" opacity="0.85" />
        <circle cx="1180" cy="420" r="2.2" opacity="0.7" />
        <circle cx="1080" cy="480" r="2" opacity="0.65" />
        <circle cx="960" cy="500" r="2.2" opacity="0.7" />
        <circle cx="880" cy="540" r="1.8" opacity="0.55" />
        <circle cx="1040" cy="360" r="1.6" opacity="0.6" />
        <circle cx="1280" cy="340" r="2" opacity="0.65" />
      </g>
    </svg>
  );
}
