/**
 * Hero visual — Europe night-map with cyan neural/network overlay.
 * Decorative only; no live KPIs. Matches Dominik cyan-map reference.
 */
import { useId } from 'react';

/** Approximate node graph over a Europe-framed night map (viewBox 0–1000). */
const NODES: readonly { x: number; y: number; r?: number }[] = [
  { x: 420, y: 280, r: 4.5 }, // UK/Ireland
  { x: 480, y: 320, r: 5.5 }, // Benelux/Paris
  { x: 540, y: 300, r: 6 }, // Berlin/DE
  { x: 580, y: 260, r: 4 }, // Baltic
  { x: 620, y: 340, r: 5 }, // Vienna/Central
  { x: 560, y: 400, r: 4.5 }, // Alps/IT
  { x: 500, y: 420, r: 4 }, // Marseille
  { x: 640, y: 380, r: 4 }, // Balkans
  { x: 700, y: 320, r: 5 }, // Warsaw/East
  { x: 720, y: 420, r: 3.5 }, // Black Sea
  { x: 460, y: 380, r: 3.5 }, // Iberia link
  { x: 400, y: 360, r: 3.5 }, // Atlantic
  { x: 660, y: 280, r: 3.5 }, // Scandinavia south
  { x: 520, y: 240, r: 3 }, // North Sea
  { x: 600, y: 460, r: 3.5 }, // Mediterranean
];

const LINKS: readonly [number, number][] = [
  [0, 1],
  [1, 2],
  [2, 3],
  [2, 4],
  [4, 5],
  [5, 6],
  [1, 6],
  [4, 7],
  [2, 8],
  [8, 9],
  [7, 9],
  [6, 10],
  [10, 11],
  [0, 11],
  [3, 12],
  [2, 13],
  [5, 14],
  [7, 14],
  [1, 13],
  [8, 4],
];

export function HeroCyanNetwork() {
  const uid = useId().replace(/:/g, '');
  const gradId = `cyan-glow-${uid}`;
  const fadeId = `map-fade-${uid}`;

  return (
    <div
      className="hero-cyan-network pointer-events-none relative h-full min-h-[420px] w-full overflow-hidden"
      aria-hidden="true"
      data-hero-visual="cyan-network"
    >
      {/* Night Europe map plane */}
      <div
        className="absolute inset-0 scale-110 bg-cover bg-center"
        style={{
          backgroundImage: 'url(/textures/earth-night.jpg)',
          backgroundPosition: '48% 38%',
          backgroundSize: '220%',
          filter: 'saturate(1.15) contrast(1.12) brightness(0.85)',
        }}
      />
      {/* Soft vignette toward left copy */}
      <div
        className="absolute inset-0"
        style={{
          background:
            'linear-gradient(90deg, #05070b 0%, rgba(5,7,11,0.72) 28%, rgba(5,7,11,0.15) 55%, transparent 72%), linear-gradient(180deg, rgba(5,7,11,0.35) 0%, transparent 25%, transparent 70%, rgba(5,7,11,0.55) 100%)',
        }}
      />
      {/* Cyan atmospheric wash */}
      <div
        className="absolute inset-0 opacity-40 mix-blend-screen"
        style={{
          background:
            'radial-gradient(55% 45% at 62% 42%, rgba(0,229,255,0.28) 0%, rgba(0,229,255,0.06) 42%, transparent 70%)',
        }}
      />

      <svg
        className="absolute inset-0 h-full w-full"
        viewBox="0 0 1000 700"
        preserveAspectRatio="xMidYMid slice"
        role="presentation"
      >
        <defs>
          <radialGradient id={gradId} cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#00E5FF" stopOpacity="1" />
            <stop offset="55%" stopColor="#00E5FF" stopOpacity="0.45" />
            <stop offset="100%" stopColor="#00E5FF" stopOpacity="0" />
          </radialGradient>
          <linearGradient id={fadeId} x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#00E5FF" stopOpacity="0" />
            <stop offset="35%" stopColor="#00E5FF" stopOpacity="0.55" />
            <stop offset="100%" stopColor="#00E5FF" stopOpacity="0.9" />
          </linearGradient>
          <filter id={`soft-${uid}`} x="-40%" y="-40%" width="180%" height="180%">
            <feGaussianBlur stdDeviation="2.2" />
          </filter>
        </defs>

        {LINKS.map(([a, b], i) => {
          const from = NODES[a];
          const to = NODES[b];
          return (
            <g key={`l-${i}`}>
              <line
                x1={from.x}
                y1={from.y}
                x2={to.x}
                y2={to.y}
                stroke={`url(#${fadeId})`}
                strokeWidth="1.4"
                opacity="0.55"
                className="hero-cyan-link"
                style={{ animationDelay: `${(i % 8) * 0.35}s` }}
              />
              <line
                x1={from.x}
                y1={from.y}
                x2={to.x}
                y2={to.y}
                stroke="#00E5FF"
                strokeWidth="3"
                opacity="0.12"
                filter={`url(#soft-${uid})`}
              />
            </g>
          );
        })}

        {NODES.map((n, i) => (
          <g key={`n-${i}`} className="hero-cyan-node" style={{ animationDelay: `${i * 0.18}s` }}>
            <circle cx={n.x} cy={n.y} r={(n.r ?? 4) * 3.2} fill={`url(#${gradId})`} opacity="0.35" />
            <circle cx={n.x} cy={n.y} r={n.r ?? 4} fill="#00E5FF" />
            <circle cx={n.x} cy={n.y} r={(n.r ?? 4) * 0.45} fill="#ffffff" opacity="0.9" />
          </g>
        ))}
      </svg>
    </div>
  );
}
