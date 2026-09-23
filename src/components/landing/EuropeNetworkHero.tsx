/**
 * Static Europe still — photoreal plate only.
 * Fine city-to-city hairlines. No inflated SVG discs (they stretch oval on wide viewports).
 */
import { LANDING_ACCENT, LANDING_BG } from './landing-theme';

const NODES: readonly { x: number; y: number }[] = [
  { x: 42, y: 28 },
  { x: 48, y: 34 },
  { x: 55, y: 30 },
  { x: 61, y: 38 },
  { x: 52, y: 44 },
  { x: 45, y: 48 },
  { x: 58, y: 52 },
  { x: 66, y: 46 },
  { x: 70, y: 36 },
  { x: 38, y: 40 },
  { x: 50, y: 58 },
  { x: 63, y: 58 },
];

const EDGES: readonly [number, number][] = [
  [0, 1], [1, 2], [2, 3], [1, 4], [4, 5], [4, 6],
  [3, 7], [2, 8], [5, 9], [6, 10], [6, 11], [7, 11], [0, 9], [4, 7],
];

export function EuropeNetworkHero() {
  return (
    <div
      className="pointer-events-none absolute inset-0 overflow-hidden"
      aria-hidden="true"
      data-hero-visual="europe-network-static"
      data-hero-interactive="false"
    >
      <picture>
        <source srcSet="/europe-globe.webp" type="image/webp" />
        <img
          src="/europe-globe.jpg"
          alt=""
          width={1920}
          height={1080}
          className="absolute inset-0 h-full w-full scale-[1.04] object-cover object-[70%_46%] opacity-[0.92] brightness-[1.08] contrast-[1.08] saturate-[1.12]"
          decoding="async"
        />
      </picture>

      <div
        className="absolute inset-0"
        style={{
          background: [
            `linear-gradient(105deg, ${LANDING_BG} 0%, ${LANDING_BG}b3 26%, ${LANDING_BG}40 48%, transparent 68%)`,
            `linear-gradient(180deg, ${LANDING_BG}66 0%, transparent 22%, transparent 74%, ${LANDING_BG}cc 100%)`,
          ].join(','),
        }}
      />

      <svg
        className="absolute inset-0 h-full w-full"
        viewBox="0 0 1376 768"
        preserveAspectRatio="xMidYMid slice"
      >
        <defs>
          <filter id="eu-net-glow" x="-40%" y="-40%" width="180%" height="180%">
            <feGaussianBlur stdDeviation="1.2" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        {EDGES.map(([a, b], i) => {
          const from = NODES[a];
          const to = NODES[b];
          return (
            <line
              key={`e-${i}`}
              x1={(from.x / 100) * 1376}
              y1={(from.y / 100) * 768}
              x2={(to.x / 100) * 1376}
              y2={(to.y / 100) * 768}
              stroke={LANDING_ACCENT}
              strokeWidth="1.1"
              opacity="0.42"
              filter="url(#eu-net-glow)"
            />
          );
        })}
        {NODES.map((n, i) => (
          <circle
            key={`n-${i}`}
            cx={(n.x / 100) * 1376}
            cy={(n.y / 100) * 768}
            r={2.4}
            fill="#e8f7fc"
            opacity="0.85"
            filter="url(#eu-net-glow)"
          />
        ))}
      </svg>
    </div>
  );
}
