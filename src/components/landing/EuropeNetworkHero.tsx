/**
 * Static Europe network hero graphic — Replit SSOT.
 * Illustrative map + node mesh. NOT an interactive globe/sphere.
 *
 * Der Schleier ueber der Aufnahme lief auf dem festen Wert `#0a0a0b` — dem
 * Grundton aus v1. Unter Design-Lock v2 ist der Grund True Black; ein
 * Schleier, der ihn um zehn Stufen verfehlt, setzt einen sichtbaren
 * Graurand auf eine schwarze Seite. Er folgt deshalb `LANDING_BG`.
 */
import { LANDING_ACCENT, LANDING_ACCENT_SOFT, LANDING_BG } from './landing-theme';

/** Approximate node positions (% of box) over Europe framing. */
const NODES: readonly { x: number; y: number; r?: number }[] = [
  { x: 42, y: 28, r: 3.2 },
  { x: 48, y: 34, r: 2.4 },
  { x: 55, y: 30, r: 2.8 },
  { x: 61, y: 38, r: 2.2 },
  { x: 52, y: 44, r: 3.5 },
  { x: 45, y: 48, r: 2.1 },
  { x: 58, y: 52, r: 2.6 },
  { x: 66, y: 46, r: 2.3 },
  { x: 70, y: 36, r: 2.0 },
  { x: 38, y: 40, r: 2.2 },
  { x: 50, y: 58, r: 2.4 },
  { x: 63, y: 58, r: 2.0 },
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
          className="absolute inset-0 h-full w-full scale-[1.08] object-cover object-[68%_42%] opacity-[0.55]"
          decoding="async"
        />
      </picture>

      {/* Veil — keeps left copy readable; map glows on the right */}
      <div
        className="absolute inset-0"
        style={{
          background: [
            `linear-gradient(105deg, ${LANDING_BG} 0%, ${LANDING_BG}cc 32%, ${LANDING_BG}66 52%, transparent 72%)`,
            `linear-gradient(180deg, ${LANDING_BG}88 0%, transparent 28%, transparent 70%, ${LANDING_BG}ee 100%)`,
            `radial-gradient(55% 50% at 72% 42%, ${LANDING_ACCENT}33 0%, transparent 62%)`,
          ].join(','),
        }}
      />

      {/* Network mesh */}
      <svg
        className="absolute inset-0 h-full w-full opacity-90"
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
      >
        <defs>
          <filter id="eu-net-glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="0.35" result="blur" />
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
              stroke={LANDING_ACCENT_SOFT}
              strokeWidth="0.18"
              opacity="0.55"
              filter="url(#eu-net-glow)"
            />
          );
        })}
        {NODES.map((n, i) => (
          <g key={`n-${i}`} filter="url(#eu-net-glow)">
            <circle
              cx={n.x}
              cy={n.y}
              r={(n.r ?? 2.2) * 1.8}
              fill={LANDING_ACCENT}
              opacity="0.12"
            />
            <circle cx={n.x} cy={n.y} r={n.r ?? 2.2} fill={LANDING_ACCENT_SOFT} opacity="0.9" />
          </g>
        ))}
      </svg>
    </div>
  );
}
