/**
 * AiCoreVisual — Watchmaker-AI Hero-Centerpiece (SVG, no Three.js).
 *
 * Composition:
 *   - Outer brass ring with engraved tick marks, slow CW rotation
 *   - Inner gunmetal ring with secondary CCW rotation
 *   - Central AI chip square with glowing perimeter
 *   - Four circuit traces flowing outward (animated dashoffset)
 *   - Hex pattern + AI label on the chip
 *
 * All animation runs in pure CSS (declared in src/index.css) — zero JS overhead.
 * Respects prefers-reduced-motion via the global media query.
 */

type Props = {
  /** Side length in px. Default 320. SVG scales with `width` only. */
  size?: number;
  /** Optional className for the wrapping div (positioning, etc.). */
  className?: string;
};

export function AiCoreVisual({ size = 320, className }: Props) {
  return (
    <div
      className={className}
      style={{ width: size, height: size }}
      aria-hidden="true"
    >
      <svg
        viewBox="0 0 320 320"
        width={size}
        height={size}
        xmlns="http://www.w3.org/2000/svg"
        style={{ display: 'block' }}
      >
        <defs>
          {/* Brass radial gradient — inner highlight, outer shadow */}
          <radialGradient id="brassRing" cx="50%" cy="40%" r="60%">
            <stop offset="0%"  stopColor="#f3e7c2" />
            <stop offset="40%" stopColor="#d9b46a" />
            <stop offset="80%" stopColor="#8a6526" />
            <stop offset="100%" stopColor="#5a4218" />
          </radialGradient>
          <radialGradient id="brassRingDark" cx="50%" cy="60%" r="60%">
            <stop offset="0%"  stopColor="#8a6526" />
            <stop offset="60%" stopColor="#5a4218" />
            <stop offset="100%" stopColor="#3a2c10" />
          </radialGradient>

          {/* Gunmetal gradient for inner ring */}
          <radialGradient id="gunmetalRing" cx="50%" cy="40%" r="60%">
            <stop offset="0%"  stopColor="#3d3d44" />
            <stop offset="60%" stopColor="#1a1d23" />
            <stop offset="100%" stopColor="#0c0e12" />
          </radialGradient>

          {/* AI chip glow — soft cyan halo */}
          <radialGradient id="aiCoreGlow" cx="50%" cy="50%" r="50%">
            <stop offset="0%"  stopColor="rgba(20,196,179,0.55)" />
            <stop offset="60%" stopColor="rgba(20,196,179,0.10)" />
            <stop offset="100%" stopColor="rgba(20,196,179,0)" />
          </radialGradient>

          {/* Hex pattern for chip surface */}
          <pattern id="hexChip" width="12" height="14" patternUnits="userSpaceOnUse">
            <path
              d="M6 0L12 3.5V10.5L6 14L0 10.5V3.5Z"
              fill="none"
              stroke="rgba(20,196,179,0.18)"
              strokeWidth="0.5"
            />
          </pattern>
        </defs>

        {/* Outermost brass ring — slow clockwise rotation */}
        <g style={{ transformOrigin: '160px 160px', animation: 'var(--animate-gear-rotate)' }}>
          <circle cx="160" cy="160" r="150" fill="url(#brassRingDark)" />
          <circle cx="160" cy="160" r="148" fill="url(#brassRing)" />
          <circle cx="160" cy="160" r="132" fill="#0c0e12" />
          {/* Tick marks every 15° */}
          {Array.from({ length: 24 }, (_, i) => {
            const angle = (i * 15 * Math.PI) / 180;
            const x1 = 160 + Math.cos(angle) * 138;
            const y1 = 160 + Math.sin(angle) * 138;
            const x2 = 160 + Math.cos(angle) * 146;
            const y2 = 160 + Math.sin(angle) * 146;
            return (
              <line
                key={i}
                x1={x1} y1={y1} x2={x2} y2={y2}
                stroke={i % 4 === 0 ? '#fbf6e9' : '#8a6526'}
                strokeWidth={i % 4 === 0 ? 1.4 : 0.8}
              />
            );
          })}
        </g>

        {/* Inner gunmetal ring — slow counter-clockwise rotation */}
        <g style={{ transformOrigin: '160px 160px', animation: 'var(--animate-gear-rotate-reverse)' }}>
          <circle cx="160" cy="160" r="124" fill="url(#gunmetalRing)" />
          <circle cx="160" cy="160" r="118" fill="#0a0a0b" />
          {/* Inner notches every 22.5° */}
          {Array.from({ length: 16 }, (_, i) => {
            const angle = (i * 22.5 * Math.PI) / 180;
            const cx = 160 + Math.cos(angle) * 121;
            const cy = 160 + Math.sin(angle) * 121;
            return (
              <circle
                key={i}
                cx={cx} cy={cy}
                r={1.4}
                fill="#5fe5d1"
                opacity={i % 2 === 0 ? 0.85 : 0.35}
              />
            );
          })}
        </g>

        {/* Circuit traces — emerge from chip toward inner ring */}
        <g fill="none" stroke="rgba(95,229,209,0.55)" strokeWidth="1.4" className="circuit-trace">
          <path d="M160 142 L160 110 L130 110" />
          <path d="M178 160 L210 160 L210 130" />
          <path d="M160 178 L160 210 L190 210" />
          <path d="M142 160 L110 160 L110 190" />
        </g>

        {/* AI chip — central square */}
        <g style={{ transformOrigin: '160px 160px' }} className="glow-ai-core">
          <rect x="135" y="135" width="50" height="50" rx="2" fill="url(#aiCoreGlow)" />
          <rect x="138" y="138" width="44" height="44" rx="1.5" fill="#0a0a0b" stroke="#14c4b3" strokeWidth="1" />
          <rect x="138" y="138" width="44" height="44" rx="1.5" fill="url(#hexChip)" />
          <text
            x="160" y="163"
            textAnchor="middle"
            fontFamily="Space Grotesk, sans-serif"
            fontSize="13"
            fontWeight="700"
            fill="#5fe5d1"
            letterSpacing="1"
          >
            AI
          </text>
        </g>

        {/* Chip pin lines — short cyan stubs from each side of the chip */}
        <g stroke="#14c4b3" strokeWidth="1.2" opacity="0.6">
          {[0, 1, 2, 3, 4].map((i) => (
            <line key={`top-${i}`} x1={142 + i * 9} y1="135" x2={142 + i * 9} y2="130" />
          ))}
          {[0, 1, 2, 3, 4].map((i) => (
            <line key={`bottom-${i}`} x1={142 + i * 9} y1="185" x2={142 + i * 9} y2="190" />
          ))}
          {[0, 1, 2, 3, 4].map((i) => (
            <line key={`left-${i}`} x1="135" y1={142 + i * 9} x2="130" y2={142 + i * 9} />
          ))}
          {[0, 1, 2, 3, 4].map((i) => (
            <line key={`right-${i}`} x1="185" y1={142 + i * 9} x2="190" y2={142 + i * 9} />
          ))}
        </g>
      </svg>
    </div>
  );
}
