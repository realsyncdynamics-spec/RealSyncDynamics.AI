/**
 * RealSyncLogo — kanonische, brand-konsistente Logo-Komponente.
 *
 * Designsprache: Enterprise Governance Runtime.
 *  - dreieckige Mark in dunkelblau/cyan/metallisch
 *  - Wortmarke „RealSync Dynamics AI" in sauberem Sans-Serif
 *  - keine neon-uebersteuerten Glows, keine Gaming-/Military-Aesthetik
 *
 * Varianten:
 *  - variant="full"    : Mark + zweizeilige Wortmarke + Tagline (Default fuer Header)
 *  - variant="compact" : Mark + einzeilige Wortmarke (Mobile / Navbar)
 *  - variant="icon"    : nur Mark (Avatare, Loading-Splash, Sidebars)
 *
 * Alle Varianten skalieren ueber `size` (Pixel) und behalten ihr
 * Hoehen-/Breitenverhaeltnis. SVG inline = keine externe Datei noetig,
 * kein FOIT, voll responsive, transparenter Hintergrund garantiert.
 */

import type { CSSProperties } from 'react';

export type RealSyncLogoVariant = 'full' | 'compact' | 'icon';

export interface RealSyncLogoProps {
  /** Hoehe der Mark in px. Wortmarken-Groessen leiten sich daraus ab. */
  size?:    number;
  variant?: RealSyncLogoVariant;
  /** Optionaler Untertitel — nur in `variant="full"` sichtbar. */
  tagline?: string;
  className?: string;
  style?:    CSSProperties;
  /** Override fuer die Wortmarke (Standard: „RealSync Dynamics AI"). */
  brandName?: string;
  /** Anchor fuer das `aria-label` der Mark. */
  label?:   string;
}

const DEFAULT_TAGLINE = 'Governance-Runtime fuer KI, Datenschutz und Nachweise';
const DEFAULT_BRAND   = 'RealSync Dynamics AI';

export function RealSyncLogo({
  size      = 28,
  variant   = 'compact',
  tagline   = DEFAULT_TAGLINE,
  className,
  style,
  brandName = DEFAULT_BRAND,
  label,
}: RealSyncLogoProps) {
  const markId = `rsl-${size}-${variant}`;
  return (
    <span
      className={`inline-flex items-center gap-3 select-none ${className ?? ''}`}
      style={style}
    >
      <RealSyncMark size={size} idPrefix={markId} ariaLabel={label ?? brandName} />
      {variant !== 'icon' ? (
        <span className="flex min-w-0 flex-col leading-tight">
          <span className="font-display text-titanium-50">
            <span className="font-bold tracking-tight">{brandName.split(' ')[0]}</span>
            <span className="font-medium text-titanium-300"> {brandName.split(' ').slice(1).join(' ')}</span>
          </span>
          {variant === 'full' && tagline ? (
            <span className="mt-0.5 font-mono text-[10px] uppercase tracking-[0.18em] text-titanium-500">
              {tagline}
            </span>
          ) : null}
        </span>
      ) : null}
    </span>
  );
}

/**
 * RealSyncMark — die metallisch-cyan dreieckige Bildmarke.
 *
 * Komposition:
 *  - aeusseres Dreieck (hard-edge, navy-zu-cyan-Verlauf, metallischer Innenrand)
 *  - innerer „Sync"-Stroke (Pfeilsegment zur Andeutung von Bewegung/Stream)
 *  - zwei Telemetrie-Punkte (graphit + cyan, balance)
 *
 * Kein Filter-Blur (performant), kein animierter Effekt — der Mark soll
 * Vertrauen und Stille signalisieren, nicht Gaming-Flackern.
 */
export function RealSyncMark({
  size       = 28,
  idPrefix,
  ariaLabel  = 'RealSync Dynamics AI',
}: {
  size?:      number;
  idPrefix?:  string;
  ariaLabel?: string;
}) {
  const id = idPrefix ?? `rsl-mark-${size}`;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label={ariaLabel}
    >
      <defs>
        {/* Hauptverlauf: tiefe Navy oben, Cyan unten — entlang der Dreiecks-Schraege */}
        <linearGradient id={`${id}-fill`} x1="6" y1="4" x2="26" y2="28" gradientUnits="userSpaceOnUse">
          <stop offset="0%"   stopColor="#0B1B36" />
          <stop offset="55%"  stopColor="#0F3D7A" />
          <stop offset="100%" stopColor="#14C4B3" />
        </linearGradient>
        {/* Metallische Kante */}
        <linearGradient id={`${id}-edge`} x1="0" y1="0" x2="32" y2="32" gradientUnits="userSpaceOnUse">
          <stop offset="0%"   stopColor="#E2E2E2" stopOpacity="0.85" />
          <stop offset="50%"  stopColor="#9DA4AD" stopOpacity="0.55" />
          <stop offset="100%" stopColor="#E2E2E2" stopOpacity="0.85" />
        </linearGradient>
        {/* Cyan-Akzent fuer den Sync-Pfeil */}
        <linearGradient id={`${id}-accent`} x1="10" y1="22" x2="22" y2="14" gradientUnits="userSpaceOnUse">
          <stop offset="0%"  stopColor="#5fe5d1" />
          <stop offset="100%" stopColor="#14C4B3" />
        </linearGradient>
      </defs>

      {/* Aeusseres Dreieck — Bottom-flat, Spitze oben (klassische Stabilitaetsform) */}
      <path
        d="M16 3.2 L28.4 26.4 H3.6 Z"
        fill={`url(#${id}-fill)`}
        stroke={`url(#${id}-edge)`}
        strokeWidth="1"
        strokeLinejoin="miter"
      />

      {/* Innere Sync-Spur — Pfeilsegment, deutet Datenstrom an */}
      <path
        d="M11.5 20.2 L16 12.4 L20.5 20.2"
        stroke={`url(#${id}-accent)`}
        strokeWidth="1.6"
        strokeLinecap="square"
        strokeLinejoin="miter"
        fill="none"
      />

      {/* Telemetrie-Punkte: links graphit, rechts cyan */}
      <circle cx="11.5" cy="20.2" r="1.1" fill="#9DA4AD" />
      <circle cx="20.5" cy="20.2" r="1.1" fill="#5fe5d1" />
    </svg>
  );
}
