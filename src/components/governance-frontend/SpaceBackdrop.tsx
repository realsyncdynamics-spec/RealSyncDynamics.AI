/**
 * Rein in CSS/SVG gebauter Weltraum-Hintergrund (Sternenfeld, Nebel, Erd-Horizont).
 * Teil des Governance-AI-Frontends (Referenzdesign, Upload 2026-08-16).
 */
export default function SpaceBackdrop() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
      {/* Grundton */}
      <div className="absolute inset-0 bg-[#03070f]" />

      {/* Nebel / Lichtstimmung */}
      <div className="absolute -left-[10%] top-[10%] h-[520px] w-[520px] rounded-full bg-cyan-500/10 blur-[160px]" />
      <div className="absolute right-[8%] top-[-10%] h-[620px] w-[620px] rounded-full bg-sky-400/10 blur-[180px]" />
      <div className="absolute bottom-[-20%] right-[20%] h-[520px] w-[720px] rounded-full bg-indigo-600/10 blur-[190px]" />

      {/* Sternenfeld */}
      <svg className="absolute inset-0 h-full w-full opacity-[0.55]">
        <defs>
          <radialGradient id="rs-star" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#ffffff" stopOpacity="1" />
            <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
          </radialGradient>
          <pattern id="rs-stars" width="240" height="240" patternUnits="userSpaceOnUse">
            <circle cx="18" cy="34" r="1" fill="url(#rs-star)" />
            <circle cx="96" cy="12" r="0.7" fill="url(#rs-star)" />
            <circle cx="151" cy="78" r="1.3" fill="url(#rs-star)" />
            <circle cx="63" cy="121" r="0.8" fill="url(#rs-star)" />
            <circle cx="207" cy="47" r="1" fill="url(#rs-star)" />
            <circle cx="182" cy="166" r="0.7" fill="url(#rs-star)" />
            <circle cx="31" cy="199" r="1.1" fill="url(#rs-star)" />
            <circle cx="120" cy="213" r="0.6" fill="url(#rs-star)" />
            <circle cx="228" cy="132" r="0.9" fill="url(#rs-star)" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#rs-stars)" />
      </svg>

      {/* Planeten-Horizont rechts unten */}
      <div className="absolute -bottom-[58%] right-[-16%] h-[125vh] w-[125vh] rounded-full bg-[radial-gradient(circle_at_32%_28%,#1d6fa5_0%,#0d3a5c_38%,#061c30_62%,#03070f_78%)] shadow-[0_0_180px_60px_rgba(34,211,238,0.10)]">
        <div className="absolute inset-0 rounded-full bg-[radial-gradient(circle_at_30%_25%,rgba(103,232,249,0.35),transparent_45%)] mix-blend-screen" />
        <div className="absolute inset-0 rounded-full ring-1 ring-cyan-300/25" />
      </div>

      {/* Sonnenaufgang am Horizont */}
      <div className="absolute right-[30%] top-[22%] h-[240px] w-[240px] rounded-full bg-[radial-gradient(circle,rgba(255,255,255,0.85),rgba(125,211,252,0.35)_35%,transparent_70%)] blur-[6px]" />

      {/* Vignette + Lesbarkeits-Verlauf links */}
      <div className="absolute inset-0 bg-[linear-gradient(90deg,#03070f_0%,rgba(3,7,15,0.92)_28%,rgba(3,7,15,0.55)_52%,rgba(3,7,15,0.15)_75%,rgba(3,7,15,0.45)_100%)]" />
      <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-[#03070f] to-transparent" />
    </div>
  );
}
