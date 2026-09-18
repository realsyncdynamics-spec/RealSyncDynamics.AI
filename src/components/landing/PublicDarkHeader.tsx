import { useState, type CSSProperties, type MouseEvent } from 'react';
import { Link } from 'react-router-dom';
import { Menu, X } from 'lucide-react';
import { HERO_SCAN_CTA_LABEL } from '../governance-frontend/hero-content';
import {
  LANDING_ACCENT,
  LANDING_BG,
  LANDING_BUTTON,
  LANDING_BUTTON_TEXT,
  LANDING_MONO,
  LANDING_MUTED,
  LANDING_TEXT,
} from './landing-theme';

/**
 * Replit SSOT header — REALSYNCDYNAMICS.AI · Produkt / Evidence / Preise · Free Audit.
 */
const LINKS = [
  { label: 'Produkt', to: '/#product' },
  { label: 'Evidence', to: '/#evidence' },
  { label: 'Preise', to: '/#pricing' },
] as const;

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
    style: { color: LANDING_MUTED } as CSSProperties,
    onMouseEnter: (e: MouseEvent<HTMLAnchorElement>) => {
      e.currentTarget.style.color = LANDING_TEXT;
    },
    onMouseLeave: (e: MouseEvent<HTMLAnchorElement>) => {
      e.currentTarget.style.color = LANDING_MUTED;
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

const scanCtaStyle: CSSProperties = {
  fontFamily: LANDING_MONO,
  backgroundColor: LANDING_BUTTON,
  color: LANDING_BUTTON_TEXT,
  boxShadow: '0 0 28px rgba(214, 173, 104, 0.22)',
};

export function PublicDarkHeader({ overlay = false }: { overlay?: boolean }) {
  const [open, setOpen] = useState(false);

  return (
    <header
      className={`${overlay ? 'absolute bg-[rgba(10,10,11,0.35)]' : 'sticky bg-[rgba(10,10,11,0.82)]'} inset-x-0 top-0 z-30 border-b border-white/[0.06] backdrop-blur-[18px]`}
      style={{ color: LANDING_TEXT }}
    >
      <div className="mx-auto flex h-[72px] max-w-[1280px] items-center gap-6 px-[4vw]">
        <Link
          to="/"
          className="flex min-w-0 items-center gap-2.5 rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#d6ad68]/60"
          style={{ color: LANDING_TEXT }}
        >
          <span
            aria-hidden="true"
            className="grid h-7 w-7 shrink-0 place-items-center border"
            style={{ borderColor: LANDING_ACCENT, color: LANDING_ACCENT }}
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M1 1h12v12H1V1Z" stroke="currentColor" strokeWidth="1.2" />
              <path d="M1 1l12 12M13 1L1 13" stroke="currentColor" strokeWidth="1.2" />
            </svg>
          </span>
          <span
            className="truncate text-[12px] font-semibold tracking-[0.14em]"
            style={{ fontFamily: LANDING_MONO }}
          >
            REALSYNCDYNAMICS.AI
          </span>
        </Link>

        <nav className="ml-auto hidden items-center gap-7 md:flex" aria-label="Hauptnavigation">
          {LINKS.map((item) => (
            <NavItem key={item.to} {...item} />
          ))}
          <Link
            to="/audit"
            className="inline-flex items-center gap-1.5 rounded-full px-[18px] py-[10px] text-[11px] font-semibold transition hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#d6ad68]"
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
            className="rounded-md p-1.5 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#d6ad68]/60"
            style={{ color: LANDING_TEXT }}
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
          style={{ backgroundColor: `${LANDING_BG}fa` }}
          role="dialog"
          aria-label="Navigation"
        >
          <nav aria-label="Mobile Navigation" className="flex flex-col">
            {LINKS.map((item) => (
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
