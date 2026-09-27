import { useState, type CSSProperties, type MouseEvent, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Menu, X } from 'lucide-react';
import { HERO_SCAN_CTA_LABEL } from '../governance-frontend/hero-content';
import { PUBLIC_PRIMARY_NAV } from '../../config/public-nav';
import {
  LANDING_MONO,
} from './landing-theme';
import {
  MODE_ACCENT,
  MODE_BG,
  MODE_BUTTON_INK,
  MODE_GLOW,
  MODE_HEADER_BG,
  MODE_HEADER_BG_OVERLAY,
  MODE_HEADER_BORDER,
  MODE_MUTED,
  MODE_TEXT,
} from './landing-mode';

/**
 * Claude Design / Replit SSOT header — gold diamond · REALSYNCDYNAMICS.AI
 * · Produkt / Evidence / Preise / Login · Free Audit → /audit
 * Nav strip from PUBLIC_PRIMARY_NAV (src/config/public-nav.ts).
 */

function NavItem({
  to,
  label,
  className,
  onNavigate,
}: {
  to: string;
  label: string;
  className?: string;
  onNavigate?: () => void;
}) {
  const shared = {
    className: `text-[13px] transition-colors focus-visible:outline-none focus-visible:underline focus-visible:underline-offset-4${className ? ` ${className}` : ''}`,
    style: { color: MODE_MUTED } as CSSProperties,
    onMouseEnter: (e: MouseEvent<HTMLAnchorElement>) => {
      e.currentTarget.style.color = MODE_TEXT;
    },
    onMouseLeave: (e: MouseEvent<HTMLAnchorElement>) => {
      e.currentTarget.style.color = MODE_MUTED;
    },
  };

  if (to.includes('#')) {
    return (
      <a href={to} {...shared} onClick={onNavigate}>
        {label}
      </a>
    );
  }
  return (
    <Link to={to} {...shared} onClick={onNavigate}>
      {label}
    </Link>
  );
}

/**
 * Primaer-Pill. Flaeche, Schrift und Schein folgen dem Farbmodus der
 * Startseite (`landing-mode.ts`); ohne `data-landing-mode` greift der
 * Gold-Rueckfall, also genau die bisherigen Werte.
 */
const scanCtaStyle: CSSProperties = {
  fontFamily: LANDING_MONO,
  backgroundColor: MODE_ACCENT,
  color: MODE_BUTTON_INK,
  boxShadow: MODE_GLOW,
};

function DiamondMark() {
  return (
    <svg width="28" height="28" viewBox="0 0 28 28" fill="none" aria-hidden="true">
      <rect
        x="14"
        y="2.5"
        width="16.26"
        height="16.26"
        rx="1.2"
        transform="rotate(45 14 2.5)"
        style={{ stroke: MODE_ACCENT }}
        strokeWidth="1.4"
      />
      <path
        d="M14 8.2v11.6M8.2 14h11.6"
        style={{ stroke: MODE_ACCENT }}
        strokeWidth="1.15"
        strokeLinecap="square"
      />
    </svg>
  );
}

export function PublicDarkHeader({
  overlay = false,
  modeSwitch,
}: {
  overlay?: boolean;
  /** Slot links neben der Pill — auf `/` sitzt hier der Farbmodus-Schalter. */
  modeSwitch?: ReactNode;
}) {
  const [open, setOpen] = useState(false);

  return (
    <header
      className={`${overlay ? 'absolute' : 'sticky'} inset-x-0 top-0 z-30 border-b backdrop-blur-[18px]`}
      style={{
        color: MODE_TEXT,
        borderColor: MODE_HEADER_BORDER,
        backgroundColor: overlay ? MODE_HEADER_BG_OVERLAY : MODE_HEADER_BG,
      }}
    >
      <div className="mx-auto flex h-[72px] max-w-[1280px] items-center gap-6 px-[4vw]">
        <Link
          to="/"
          className="flex min-w-0 items-center gap-2.5 rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--rsd-accent,#d6ad68)]/60"
          style={{ color: MODE_TEXT }}
        >
          <span className="grid h-7 w-7 shrink-0 place-items-center">
            <DiamondMark />
          </span>
          <span
            className="truncate text-[13px] font-semibold tracking-tight"
            style={{ fontFamily: LANDING_MONO, letterSpacing: '0.04em' }}
          >
            RealSyncDynamics.AI
          </span>
        </Link>

        <nav className="ml-auto hidden items-center gap-7 md:flex" aria-label="Hauptnavigation">
          {PUBLIC_PRIMARY_NAV.map((item) => (
            <NavItem key={item.to} {...item} />
          ))}
          {modeSwitch}
          <Link
            to="/audit"
            className="inline-flex items-center gap-1.5 rounded-full px-[18px] py-[10px] text-[11px] font-semibold transition hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--rsd-accent,#d6ad68)]"
            style={scanCtaStyle}
          >
            {HERO_SCAN_CTA_LABEL} <span aria-hidden="true">→</span>
          </Link>
        </nav>

        <div className="ml-auto flex items-center gap-2 md:hidden">
          <Link
            to="/audit"
            className="rounded-full px-3.5 py-2 text-[10px] font-semibold"
            style={scanCtaStyle}
          >
            Free Audit
          </Link>
          <button
            type="button"
            className="rounded-md p-1.5 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--rsd-accent,#d6ad68)]/60"
            style={{ color: MODE_TEXT }}
            aria-expanded={open}
            aria-controls="public-dark-mobile-nav"
            aria-label={open ? 'Menü schließen' : 'Menü öffnen'}
            onClick={() => setOpen((v) => !v)}
          >
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {open && (
        <div
          id="public-dark-mobile-nav"
          className="border-t border-white/[0.06] px-6 py-4 backdrop-blur-md md:hidden"
          style={{
            borderColor: MODE_HEADER_BORDER,
            backgroundColor: `color-mix(in srgb, ${MODE_BG} 94%, transparent)`,
          }}
          role="dialog"
          aria-label="Navigation"
        >
          {modeSwitch && <div className="mb-3">{modeSwitch}</div>}
          <nav aria-label="Mobile Navigation" className="flex flex-col">
            {PUBLIC_PRIMARY_NAV.map((item) => (
              <NavItem
                key={item.to}
                to={item.to}
                label={item.label}
                className="py-2.5 text-sm"
                onNavigate={() => setOpen(false)}
              />
            ))}
            <Link
              to="/audit"
              className="mt-3 block rounded-full px-4 py-3 text-center text-[11px] font-semibold"
              style={scanCtaStyle}
              onClick={() => setOpen(false)}
            >
              {HERO_SCAN_CTA_LABEL} →
            </Link>
          </nav>
        </div>
      )}
    </header>
  );
}
