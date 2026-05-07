/**
 * RealSync Dynamics Logo.
 *
 * Geometrisches SVG-Sync-Symbol: zwei rotierende Kreissegmente +
 * Neural-Net-Knoten in der Mitte. Indigo-zu-Purple-Gradient.
 * Dark-Mode-first; Größe via prop steuerbar.
 *
 * Design-Bezüge: Linear-Geometrie, Vercel-Minimalism, Resend-Mark-Style.
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
          <linearGradient id={`${id}-grad`} x1="0" y1="0" x2="32" y2="32" gradientUnits="userSpaceOnUse">
            <stop offset="0" stopColor="#6366f1" />
            <stop offset="1" stopColor="#a78bfa" />
          </linearGradient>
          <linearGradient id={`${id}-grad-soft`} x1="32" y1="0" x2="0" y2="32" gradientUnits="userSpaceOnUse">
            <stop offset="0" stopColor="#a78bfa" stopOpacity="0.55" />
            <stop offset="1" stopColor="#6366f1" stopOpacity="0.0" />
          </linearGradient>
        </defs>

        {/* Outer sync ring — open at 1 + 7 o'clock for kinetic feel */}
        <path
          d="M 26.5 8.5 A 13 13 0 0 1 26.5 23.5"
          stroke={`url(#${id}-grad)`}
          strokeWidth="2.5"
          strokeLinecap="round"
        />
        <path
          d="M 5.5 8.5 A 13 13 0 0 0 5.5 23.5"
          stroke={`url(#${id}-grad)`}
          strokeWidth="2.5"
          strokeLinecap="round"
        />

        {/* Inner soft glow ring */}
        <circle cx="16" cy="16" r="9" stroke={`url(#${id}-grad-soft)`} strokeWidth="1" />

        {/* Neural-net core: 4-knot diamond around central node */}
        <circle cx="16" cy="16" r="2.6" fill={`url(#${id}-grad)`} />
        <circle cx="16" cy="9.5" r="1.1" fill="#a78bfa" />
        <circle cx="16" cy="22.5" r="1.1" fill="#a78bfa" />
        <circle cx="9.5" cy="16" r="1.1" fill="#6366f1" />
        <circle cx="22.5" cy="16" r="1.1" fill="#6366f1" />

        {/* Connecting lines — sparse, vertical only for clarity */}
        <line x1="16" y1="11" x2="16" y2="13.5" stroke="#a78bfa" strokeWidth="0.8" strokeLinecap="round" opacity="0.6" />
        <line x1="16" y1="18.5" x2="16" y2="21" stroke="#a78bfa" strokeWidth="0.8" strokeLinecap="round" opacity="0.6" />
      </svg>

      {!iconOnly && (
        <span className={textClassName ?? 'font-display font-bold text-base text-titanium-50 tracking-tight'}>
          RealSync<span className="font-medium text-titanium-400 ml-0.5">Dynamics.AI</span>
        </span>
      )}
    </span>
  );
}
