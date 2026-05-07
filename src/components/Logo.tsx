/**
 * RealSync Dynamics Logo — Watchmaker-AI Edition.
 *
 * Same silhouette as before (two outer ring segments + neural-net core), now
 * in the brand's Watchmaker-AI palette:
 *   - Outer rings : brass gradient (mechanical mark, mirrors the AiCoreVisual
 *     brass torus). Subtle SVG <filter> bevel suggests engraved metal.
 *   - Inner soft ring : ai-cyan halo (AI orchestration glow)
 *   - Neural-net core : brass center fill, vertical knots brass, horizontal
 *     knots ai-cyan — the same brass↔cyan duality as the platform centerpiece
 *
 * Wordmark stays in titanium for legibility; "RealSync" gets a faint brass
 * tint (brass-100 ≈ pale champagne) so the metallic identity is present even
 * at small icon-size.
 */

interface LogoProps {
  /** Symbol-Größe in Pixel (height = width) */
  size?: number;
  /** Wenn true: nur Icon, kein Wortmarken-Text */
  iconOnly?: boolean;
  /** Wortmarken-Größe relativ zum Icon */
  textClassName?: string;
}

export function Logo({ size = 28, iconOnly = false, textClassName }: LogoProps) {
  const id = `rsd-logo-${size}`;
  return (
    <span className="inline-flex items-center gap-2.5 select-none">
      <svg
        width={size}
        height={size}
        viewBox="0 0 32 32"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-label="RealSync Dynamics"
        role="img"
      >
        <defs>
          {/* Brass gradient — outer mechanical rings */}
          <linearGradient id={`${id}-brass`} x1="0" y1="0" x2="32" y2="32" gradientUnits="userSpaceOnUse">
            <stop offset="0%"  stopColor="#d9b46a" />
            <stop offset="55%" stopColor="#b78a3d" />
            <stop offset="100%" stopColor="#8a6526" />
          </linearGradient>

          {/* AI-cyan soft halo — inner ring */}
          <linearGradient id={`${id}-cyan-soft`} x1="32" y1="0" x2="0" y2="32" gradientUnits="userSpaceOnUse">
            <stop offset="0%"  stopColor="#5fe5d1" stopOpacity="0.55" />
            <stop offset="100%" stopColor="#14c4b3" stopOpacity="0.0" />
          </linearGradient>

          {/* Subtle bevel for the outer rings — fakes engraved-metal depth.
              Uses two offset alpha-shifted copies, no expensive blurs. */}
          <filter id={`${id}-engrave`} x="-20%" y="-20%" width="140%" height="140%">
            <feOffset in="SourceAlpha" dx="0.3" dy="0.3" result="lower" />
            <feFlood floodColor="#fbf6e9" floodOpacity="0.35" />
            <feComposite in2="lower" operator="in" result="hi" />
            <feOffset in="SourceAlpha" dx="-0.25" dy="-0.25" result="upper" />
            <feFlood floodColor="#3a2c10" floodOpacity="0.45" />
            <feComposite in2="upper" operator="in" result="lo" />
            <feMerge>
              <feMergeNode in="lo" />
              <feMergeNode in="SourceGraphic" />
              <feMergeNode in="hi" />
            </feMerge>
          </filter>
        </defs>

        {/* Outer brass sync rings — open at 1 + 7 o'clock for kinetic feel */}
        <g filter={`url(#${id}-engrave)`}>
          <path
            d="M 26.5 8.5 A 13 13 0 0 1 26.5 23.5"
            stroke={`url(#${id}-brass)`}
            strokeWidth="2.5"
            strokeLinecap="round"
          />
          <path
            d="M 5.5 8.5 A 13 13 0 0 0 5.5 23.5"
            stroke={`url(#${id}-brass)`}
            strokeWidth="2.5"
            strokeLinecap="round"
          />
        </g>

        {/* Inner ai-cyan soft halo */}
        <circle cx="16" cy="16" r="9" stroke={`url(#${id}-cyan-soft)`} strokeWidth="1" />

        {/* Neural-net core: brass center, brass-vertical / cyan-horizontal knots */}
        <circle cx="16" cy="16" r="2.6" fill={`url(#${id}-brass)`} />
        <circle cx="16" cy="9.5"  r="1.1" fill="#d9b46a" />
        <circle cx="16" cy="22.5" r="1.1" fill="#d9b46a" />
        <circle cx="9.5"  cy="16" r="1.1" fill="#5fe5d1" />
        <circle cx="22.5" cy="16" r="1.1" fill="#5fe5d1" />

        {/* Connecting lines */}
        <line x1="16" y1="11"   x2="16" y2="13.5" stroke="#d9b46a" strokeWidth="0.8" strokeLinecap="round" opacity="0.6" />
        <line x1="16" y1="18.5" x2="16" y2="21"   stroke="#d9b46a" strokeWidth="0.8" strokeLinecap="round" opacity="0.6" />
        <line x1="11"   y1="16" x2="13.5" y2="16" stroke="#5fe5d1" strokeWidth="0.8" strokeLinecap="round" opacity="0.55" />
        <line x1="18.5" y1="16" x2="21"   y2="16" stroke="#5fe5d1" strokeWidth="0.8" strokeLinecap="round" opacity="0.55" />
      </svg>

      {!iconOnly && (
        <span className={textClassName ?? 'font-display font-bold text-base text-titanium-50 tracking-tight'}>
          <span className="text-brass-100">RealSync</span>
          <span className="font-medium text-titanium-400 ml-0.5">Dynamics.AI</span>
        </span>
      )}
    </span>
  );
}
