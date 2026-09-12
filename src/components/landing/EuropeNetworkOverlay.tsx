/**
 * Gold route network over the Europe hero panel — mockup lock.
 * Decorative only; no KPIs, no Sphere HUD.
 */
import type { CSSProperties } from 'react';
import { LANDING_ACCENT } from './landing-theme';

const ROUTES: readonly string[] = [
  'M 18 42 C 28 38, 36 34, 48 36 C 58 38, 68 44, 78 52',
  'M 32 28 C 42 32, 52 40, 62 48 C 70 54, 78 60, 88 68',
  'M 40 18 C 48 28, 54 40, 58 52 C 62 62, 70 72, 82 78',
  'M 22 55 C 34 50, 46 48, 58 54 C 68 58, 76 66, 86 74',
  'M 50 22 C 56 34, 60 46, 66 58 C 72 68, 80 76, 90 82',
  'M 28 68 C 40 62, 52 58, 64 62 C 74 66, 82 72, 92 80',
];

const NODES: readonly [number, number][] = [
  [32, 30],
  [48, 36],
  [58, 52],
  [68, 44],
  [78, 60],
  [42, 58],
  [62, 68],
  [86, 74],
];

export function EuropeNetworkOverlay({ className = '' }: { className?: string }) {
  const style = { color: LANDING_ACCENT } satisfies CSSProperties;

  return (
    <svg
      className={`pointer-events-none absolute inset-0 h-full w-full ${className}`.trim()}
      viewBox="0 0 100 100"
      preserveAspectRatio="xMidYMid slice"
      aria-hidden="true"
      style={style}
    >
      <defs>
        <linearGradient id="eu-route-glow" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor={LANDING_ACCENT} stopOpacity="0.15" />
          <stop offset="45%" stopColor={LANDING_ACCENT} stopOpacity="0.85" />
          <stop offset="100%" stopColor={LANDING_ACCENT} stopOpacity="0.35" />
        </linearGradient>
        <filter id="eu-route-blur" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="0.35" />
        </filter>
      </defs>
      {ROUTES.map((d) => (
        <path
          key={d}
          d={d}
          fill="none"
          stroke="url(#eu-route-glow)"
          strokeWidth="0.55"
          strokeLinecap="round"
          filter="url(#eu-route-blur)"
          opacity="0.9"
        />
      ))}
      {ROUTES.map((d) => (
        <path
          key={`core-${d}`}
          d={d}
          fill="none"
          stroke={LANDING_ACCENT}
          strokeWidth="0.22"
          strokeLinecap="round"
          opacity="0.95"
        />
      ))}
      {NODES.map(([cx, cy]) => (
        <circle
          key={`${cx}-${cy}`}
          cx={cx}
          cy={cy}
          r="0.55"
          fill={LANDING_ACCENT}
          opacity="0.9"
        />
      ))}
    </svg>
  );
}
