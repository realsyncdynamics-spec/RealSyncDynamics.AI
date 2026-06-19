/**
 * RealSync Dynamics Logo — „Dynamic Pinwheel" Edition.
 *
 * Eigenständige, parametrisch erzeugte Interpretation des Sacred-Geometry-
 * Pinwheel-Motivs (sechs ineinandergreifende, wirbelnde Klingen um einen
 * Kern) — KEINE Kopie einer Stock-Vorlage. Der rotierende Wirbel steht für
 * „Dynamics"; die ineinandergreifenden Bögen für „Sync".
 *
 * 3D-Wirkung rein in SVG (keine WebGL-Last, überall einsetzbar):
 *   - Ein einziger Licht-aus-oben-links-Radialverlauf shadet alle Klingen
 *     konsistent (oben-links hell → unten-rechts dunkel) = Emboss-Tiefe.
 *   - Kern als kleine „Kugel" (eigener Radialverlauf mit Glanzpunkt).
 *   - Weicher Schlagschatten hebt die Marke von der Fläche ab.
 *   - AI-Cyan-Akzentpunkte an den Klingenspitzen + dezenter Außenring.
 *
 * Palette: Brand-Petrol/Teal (#0f766e → #2dd4bf → #5eead4) mit AI-Cyan
 * (#7dffe8) — funktioniert auf hellen (Landing) wie dunklen (App) Flächen.
 *
 * Die Wortmarke „RealSync Dynamics.AI" steht stets NEBEN der Marke (gap),
 * läuft also nie ins Muster hinein.
 */

interface LogoProps {
  /** Symbol-Größe in Pixel (height = width) */
  size?: number;
  /** Wenn true: nur Icon, kein Wortmarken-Text */
  iconOnly?: boolean;
  /** Wortmarken-Größe relativ zum Icon */
  textClassName?: string;
}

const BLADE_COUNT = 6;

/**
 * Eine Klinge im lokalen Koordinatensystem (Spitze nach oben), Zentrum 24/24.
 * Asymmetrisch gewölbt → wirbelnde „Schaufel". Wird sechsfach rotiert.
 */
const BLADE_PATH = 'M24 24 C33 19 31 8 24 4 C21 9 21 17 24 24 Z';

export function Logo({ size = 28, iconOnly = false, textClassName }: LogoProps) {
  const id = `rsd-logo-${size}`;
  return (
    <span className="inline-flex items-center gap-2.5 select-none">
      <svg
        width={size}
        height={size}
        viewBox="0 0 48 48"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-label="RealSync Dynamics"
        role="img"
      >
        <defs>
          {/* 3D-Hauptverlauf — Licht aus oben-links, shadet alle Klingen. */}
          <radialGradient id={`${id}-body`} cx="16" cy="13" r="34" gradientUnits="userSpaceOnUse">
            <stop offset="0%"   stopColor="#99f6e4" />
            <stop offset="34%"  stopColor="#2dd4bf" />
            <stop offset="72%"  stopColor="#0f766e" />
            <stop offset="100%" stopColor="#115e59" />
          </radialGradient>

          {/* Kern-Kugel — eigener Glanzpunkt für plastische Tiefe. */}
          <radialGradient id={`${id}-hub`} cx="21" cy="20" r="9" gradientUnits="userSpaceOnUse">
            <stop offset="0%"   stopColor="#ecfeff" />
            <stop offset="55%"  stopColor="#5eead4" />
            <stop offset="100%" stopColor="#0f766e" />
          </radialGradient>

          {/* Weicher Schlagschatten — hebt die Marke ab. */}
          <filter id={`${id}-lift`} x="-25%" y="-25%" width="150%" height="150%">
            <feDropShadow dx="0" dy="0.7" stdDeviation="0.9" floodColor="#042f2e" floodOpacity="0.45" />
          </filter>
        </defs>

        {/* Dezenter Außenring (geschlossener Kreis, ineinandergreifendes Motiv). */}
        <circle cx="24" cy="24" r="21.5" stroke="#5eead4" strokeWidth="0.6" opacity="0.25" />

        {/* Sechs wirbelnde Klingen — ein gemeinsamer Verlauf = konsistentes 3D. */}
        <g filter={`url(#${id}-lift)`}>
          {Array.from({ length: BLADE_COUNT }).map((_, i) => (
            <path
              key={i}
              d={BLADE_PATH}
              fill={`url(#${id}-body)`}
              stroke="#0a3b37"
              strokeWidth="0.4"
              strokeOpacity="0.55"
              transform={`rotate(${(360 / BLADE_COUNT) * i} 24 24)`}
            />
          ))}

          {/* AI-Cyan-Akzentpunkte an den Klingenspitzen. */}
          {Array.from({ length: BLADE_COUNT }).map((_, i) => (
            <circle
              key={`tip-${i}`}
              cx="24"
              cy="6.2"
              r="1.7"
              fill="#7dffe8"
              transform={`rotate(${(360 / BLADE_COUNT) * i} 24 24)`}
            />
          ))}

          {/* Kern-Kugel mit Glanzpunkt. */}
          <circle cx="24" cy="24" r="4.4" fill={`url(#${id}-hub)`} stroke="#0f766e" strokeWidth="0.4" />
          <circle cx="22.4" cy="22.4" r="1.2" fill="#f0fdfa" opacity="0.85" />
        </g>
      </svg>

      {!iconOnly && (
        <span className={textClassName ?? 'font-display font-bold text-base text-titanium-50 tracking-tight'}>
          <span className="text-petrol-200">RealSync</span>
          <span className="font-medium text-titanium-400 ml-1">Dynamics.AI</span>
        </span>
      )}
    </span>
  );
}
