/**
 * EmptyStateGraphic — minimal SVG illustration for empty-state panels.
 *
 * Reuses the Watchmaker-AI metaphor: muted brass ring (paused mechanism) +
 * dim AI chip (powered down) + faint scan line. Carries the design language
 * into "no data yet" surfaces without being loud.
 *
 * Decorative only — `aria-hidden`. Default size 96px (compact for inline use).
 */
type Props = {
  size?: number;
  className?: string;
};

export function EmptyStateGraphic({ size = 96, className }: Props) {
  return (
    <svg
      viewBox="0 0 96 96"
      width={size}
      height={size}
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      className={className}
      style={{ display: 'block' }}
    >
      {/* Outer brass ring — muted, suggests mechanism at rest */}
      <circle cx="48" cy="48" r="42" fill="none" stroke="rgba(138,101,38,0.45)" strokeWidth="1.4" />
      <circle cx="48" cy="48" r="38" fill="none" stroke="rgba(183,138,61,0.20)" strokeWidth="0.8" strokeDasharray="2 4" />

      {/* Tick marks at cardinal points */}
      {[0, 90, 180, 270].map((deg) => {
        const a = (deg * Math.PI) / 180;
        const x1 = 48 + Math.cos(a) * 40;
        const y1 = 48 + Math.sin(a) * 40;
        const x2 = 48 + Math.cos(a) * 44;
        const y2 = 48 + Math.sin(a) * 44;
        return <line key={deg} x1={x1} y1={y1} x2={x2} y2={y2} stroke="rgba(217,180,106,0.55)" strokeWidth="1" />;
      })}

      {/* Inner AI chip — dim, no glow (idle) */}
      <rect x="36" y="36" width="24" height="24" rx="1" fill="#0a0a0b" stroke="rgba(20,196,179,0.30)" strokeWidth="0.8" />

      {/* Hex pattern on chip — sparse */}
      <path
        d="M42 42 L46 42 M50 42 L54 42 M42 48 L46 48 M50 48 L54 48 M42 54 L46 54 M50 54 L54 54"
        stroke="rgba(20,196,179,0.20)"
        strokeWidth="0.6"
      />

      {/* Faint scan-line stripe across the lower half */}
      <line
        x1="14"
        y1="64"
        x2="82"
        y2="64"
        stroke="rgba(20,196,179,0.10)"
        strokeWidth="0.6"
        strokeDasharray="1 3"
      />
    </svg>
  );
}
