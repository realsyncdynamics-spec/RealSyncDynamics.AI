/**
 * Static Europe network hero — Brand Direction v1.1.
 *
 * Left column is brushed-metal void (copy must stay readable).
 * Right column carries the night/relief shot + gold corridors.
 * Nodes never sit over the headline: mesh is framed to the right half.
 */
import {
  MODE_ACCENT,
  MODE_ACCENT_SOFT,
  MODE_SHOT_FILTER,
  MODE_SHOT_OPACITY,
  modeAccent,
  modeVeil,
} from './landing-mode';

/** Node positions in the RIGHT frame only (viewBox 100×100, map lives at x≥54). */
const NODES: readonly { x: number; y: number; r?: number }[] = [
  { x: 62, y: 22, r: 0.9 },
  { x: 68, y: 28, r: 0.7 },
  { x: 74, y: 24, r: 0.85 },
  { x: 80, y: 32, r: 0.7 },
  { x: 71, y: 38, r: 1.05 },
  { x: 64, y: 42, r: 0.65 },
  { x: 77, y: 46, r: 0.8 },
  { x: 84, y: 40, r: 0.7 },
  { x: 88, y: 30, r: 0.6 },
  { x: 58, y: 36, r: 0.65 },
  { x: 70, y: 54, r: 0.75 },
  { x: 82, y: 54, r: 0.65 },
  { x: 90, y: 48, r: 0.55 },
  { x: 76, y: 62, r: 0.7 },
];

const EDGES: readonly [number, number][] = [
  [0, 1],
  [1, 2],
  [2, 3],
  [1, 4],
  [4, 5],
  [4, 6],
  [3, 7],
  [2, 8],
  [5, 9],
  [6, 10],
  [6, 11],
  [7, 11],
  [0, 9],
  [4, 7],
  [7, 12],
  [11, 13],
  [10, 13],
  [8, 12],
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
          width={1376}
          height={768}
          className="absolute inset-0 h-full w-full scale-[1.12] object-cover object-[82%_44%]"
          style={{ opacity: MODE_SHOT_OPACITY, filter: MODE_SHOT_FILTER }}
          decoding="async"
        />
      </picture>

      {/* Brushed-metal plate + left copy well. Map only survives on the right. */}
      <div
        className="absolute inset-0"
        style={{
          background: [
            `linear-gradient(102deg, ${modeVeil(100)} 0%, ${modeVeil(100)} 34%, ${modeVeil(92)} 46%, ${modeVeil(55)} 58%, transparent 74%)`,
            `linear-gradient(180deg, ${modeVeil(70)} 0%, transparent 22%, transparent 68%, ${modeVeil(96)} 100%)`,
            `radial-gradient(42% 70% at 18% -8%, rgba(255,255,255,0.11) 0%, transparent 62%)`,
            `radial-gradient(48% 42% at 78% 46%, ${modeAccent(22)} 0%, transparent 64%)`,
          ].join(','),
        }}
      />

      <div
        className="absolute inset-0 opacity-[0.14] mix-blend-overlay"
        style={{
          backgroundImage:
            'repeating-linear-gradient(90deg, rgba(255,255,255,0.04) 0px, rgba(255,255,255,0.04) 1px, transparent 1px, transparent 3px)',
        }}
      />

      <svg
        className="absolute inset-0 h-full w-full"
        viewBox="0 0 100 100"
        preserveAspectRatio="xMaxYMid slice"
      >
        <defs>
          <filter id="eu-net-glow" x="-80%" y="-80%" width="260%" height="260%">
            <feGaussianBlur stdDeviation="0.22" result="blur" />
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
              x1={from.x}
              y1={from.y}
              x2={to.x}
              y2={to.y}
              style={{ stroke: MODE_ACCENT_SOFT }}
              strokeWidth="0.12"
              opacity="0.62"
              filter="url(#eu-net-glow)"
            />
          );
        })}
        {NODES.map((n, i) => (
          <g key={`n-${i}`} filter="url(#eu-net-glow)">
            <circle
              cx={n.x}
              cy={n.y}
              r={(n.r ?? 0.7) * 2.1}
              style={{ fill: MODE_ACCENT }}
              opacity="0.16"
            />
            <circle
              cx={n.x}
              cy={n.y}
              r={n.r ?? 0.7}
              style={{ fill: MODE_ACCENT_SOFT }}
              opacity="0.95"
            />
          </g>
        ))}
      </svg>
    </div>
  );
}
