/**
 * EarthHeroVisual — leichter SVG-Fallback für das Europa-Erde-Hero.
 *
 * Kommt zum Einsatz auf schwachen/mobilen Viewports und als Suspense-Fallback
 * während EarthScene (Three.js) lazy lädt. Reines SVG/CSS, kein WebGL —
 * Atmosphären-Glow, angedeutete Nachtseite mit City-Lights über Europa.
 */

type Props = {
  size?: number;
  className?: string;
};

export function EarthHeroVisual({ size = 420, className }: Props) {
  return (
    <div
      className={className}
      style={{ width: size, maxWidth: '100%', aspectRatio: '1' }}
      aria-hidden="true"
    >
      <svg viewBox="0 0 420 420" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg" style={{ display: 'block' }}>
        <defs>
          <radialGradient id="earthGlobe" cx="38%" cy="35%" r="75%">
            <stop offset="0%" stopColor="#1d4e63" />
            <stop offset="45%" stopColor="#0f3147" />
            <stop offset="78%" stopColor="#0a1c2e" />
            <stop offset="100%" stopColor="#050b16" />
          </radialGradient>
          <radialGradient id="earthAtmos" cx="50%" cy="50%" r="50%">
            <stop offset="72%" stopColor="rgba(40,150,200,0)" />
            <stop offset="92%" stopColor="rgba(56,180,225,0.35)" />
            <stop offset="100%" stopColor="rgba(56,180,225,0)" />
          </radialGradient>
          <radialGradient id="sunRim" cx="78%" cy="30%" r="55%">
            <stop offset="0%" stopColor="rgba(255,238,204,0.55)" />
            <stop offset="40%" stopColor="rgba(255,210,150,0.12)" />
            <stop offset="100%" stopColor="rgba(255,210,150,0)" />
          </radialGradient>
        </defs>

        {/* Atmosphäre */}
        <circle cx="210" cy="210" r="200" fill="url(#earthAtmos)" />
        {/* Globus */}
        <circle cx="210" cy="210" r="168" fill="url(#earthGlobe)" />
        {/* Landmassen-Andeutung (Europa/Afrika) */}
        <g fill="#15405a" opacity="0.85">
          <path d="M196 96c18-6 40-2 52 10 8 8 4 22-6 28-14 8-10 22-22 30-10 7-26 4-34-6-9-12-6-30 2-44 2-12 0-22 8-18z" />
          <path d="M188 168c16-4 30 6 34 22 5 20-4 44-18 60-12 14-30 22-40 10-9-11-4-30 2-46 6-18 6-42 22-46z" />
          <path d="M150 150c10-2 16 8 14 18-2 8-12 12-18 8-7-5-6-22 4-26z" />
        </g>
        {/* City-Lights (Nachtseite, links/Europa) */}
        <g fill="#ffd98a">
          {[
            [176, 120], [186, 132], [168, 140], [194, 150], [160, 158],
            [182, 170], [172, 184], [196, 188], [158, 196], [186, 206],
            [170, 214], [150, 174], [200, 168], [164, 128],
          ].map(([cx, cy], i) => (
            <circle key={i} cx={cx} cy={cy} r={i % 3 === 0 ? 1.8 : 1.1} opacity={0.85} />
          ))}
        </g>
        {/* Sonnen-Saum oben rechts */}
        <circle cx="210" cy="210" r="168" fill="url(#sunRim)" />
        {/* Terminator-Kante */}
        <path
          d="M280 70 C 240 150, 240 270, 300 350"
          fill="none"
          stroke="rgba(255,220,170,0.25)"
          strokeWidth="2"
        />
      </svg>
    </div>
  );
}
