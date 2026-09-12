import { useState, type CSSProperties, type MouseEvent } from 'react';
import { Link } from 'react-router-dom';
import { Menu, X } from 'lucide-react';
import { HERO_SCAN_CTA_LABEL } from '../governance-frontend/hero-content';
import {
  LANDING_ACCENT,
  LANDING_BG,
  LANDING_BUTTON_TEXT,
  LANDING_GREEN,
  LANDING_MONO,
  LANDING_MUTED,
  LANDING_TEXT,
  LANDING_TRUST_MARKS,
} from './landing-theme';

/**
 * Shared dark public header for `/` and `/branchen`.
 *
 * Dominik 1:1 mock strip: Produkt · Evidence · Preise · Login + Free Audit.
 * Fuller IA lives in the mobile drawer — no junk-drawer desktop bar.
 */

/** Calm desktop strip — matches Dominik luxury mock. */
const PRIMARY_LINKS = [
  { label: 'Produkt', to: '/#product', emphasize: false },
  { label: 'Evidence', to: '/#evidence', emphasize: false },
  { label: 'Preise', to: '/#pricing', emphasize: true },
  { label: 'Login', to: '/welcome', emphasize: false },
] as const;

/**
 * Drawer / secondary IA — keeps platform-capabilities reachability
 * (`/ai-act`, `/sicherheit`, `/branchen`, `/governance-runtime`, Enterprise)
 * without crowding the first viewport.
 */
const DRAWER_LINKS = [
  { label: 'Produkt', to: '/#product', emphasize: false },
  { label: 'Runtime', to: '/governance-runtime', emphasize: false },
  { label: 'Branchen', to: '/branchen', emphasize: false },
  { label: 'Evidence', to: '/#evidence', emphasize: false },
  { label: 'Module', to: '/#tools', emphasize: false },
  { label: 'EU AI Act', to: '/ai-act', emphasize: false },
  { label: 'Sicherheit', to: '/sicherheit', emphasize: false },
  { label: 'Preise', to: '/#pricing', emphasize: true },
  { label: 'Enterprise', to: '/#enterprise', emphasize: false },
  { label: 'Login', to: '/welcome', emphasize: false },
] as const;

function NavItem({
  to,
  label,
  className,
  emphasize,
  onNavigate,
}: {
  to: string;
  label: string;
  className?: string;
  emphasize?: boolean;
  onNavigate?: () => void;
}) {
  const baseColor = emphasize ? LANDING_ACCENT : LANDING_MUTED;
  const shared = {
    className: `text-[13px] transition-colors focus-visible:outline-none focus-visible:underline focus-visible:underline-offset-4${emphasize ? ' font-medium tracking-wide' : ''}${className ? ` ${className}` : ''}`,
    style: { color: baseColor } as CSSProperties,
    onMouseEnter: (e: MouseEvent<HTMLAnchorElement>) => {
      e.currentTarget.style.color = LANDING_TEXT;
    },
    onMouseLeave: (e: MouseEvent<HTMLAnchorElement>) => {
      e.currentTarget.style.color = baseColor;
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
  background: 'linear-gradient(180deg, #f0e6d4 0%, #e8ddc8 48%, #dcc9a8 100%)',
  color: LANDING_BUTTON_TEXT,
};

export function PublicDarkHeader({ overlay = false }: { overlay?: boolean }) {
  const [open, setOpen] = useState(false);

  return (
    <header
      className={`${overlay ? 'absolute bg-[rgba(5,7,11,0.55)]' : 'sticky bg-[rgba(5,7,11,0.82)]'} inset-x-0 top-0 z-30 border-b border-white/[0.06] backdrop-blur-[18px]`}
      style={{ color: LANDING_TEXT }}
    >
      <div className="mx-auto flex h-[76px] max-w-[1500px] items-center gap-6 px-[4vw]">
        <div className="flex min-w-0 items-center gap-3">
          <Link
            to="/"
            className="flex min-w-0 items-center gap-2.5 rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#e4cfa2]/60"
            style={{ color: LANDING_TEXT }}
          >
            <span aria-hidden="true" className="shrink-0 text-[19px]" style={{ color: LANDING_ACCENT }}>
              ⬢
            </span>
            <span className="truncate whitespace-nowrap text-[14px] font-medium tracking-tight">
              RealSync Dynamics
              <span style={{ color: LANDING_ACCENT }}>.AI</span>
            </span>
          </Link>
        </div>

        <nav className="ml-auto hidden items-center gap-7 lg:flex" aria-label="Hauptnavigation">
          {PRIMARY_LINKS.map((item) => (
            <NavItem key={item.to + item.label} {...item} />
          ))}
          <Link
            to="/audit"
            className="landing-cta-glow rounded-full px-[20px] py-[11px] text-center text-[11px] leading-[1.3] transition hover:brightness-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#e4cfa2]"
            style={scanCtaStyle}
          >
            {HERO_SCAN_CTA_LABEL}
          </Link>
        </nav>

        <div className="ml-auto flex items-center gap-2.5 lg:hidden">
          <Link
            to="/audit"
            className="hidden rounded-full px-3.5 py-2 text-[10px] sm:inline-flex"
            style={scanCtaStyle}
          >
            Free Audit
          </Link>
          <button
            type="button"
            className="rounded-md p-1.5 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#e4cfa2]/60"
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
          className="border-t border-white/[0.06] px-6 py-4 backdrop-blur-md lg:hidden"
          style={{ backgroundColor: `${LANDING_BG}fa` }}
          role="dialog"
          aria-label="Governance OS Navigation"
        >
          <p
            className="mb-3 text-[9px] tracking-[.2em]"
            style={{ fontFamily: LANDING_MONO, color: `${LANDING_ACCENT}b3` }}
          >
            NAVIGATION
          </p>
          <nav aria-label="Mobile Navigation" className="flex flex-col">
            {DRAWER_LINKS.map((item) => (
              <NavItem
                key={item.to + item.label}
                to={item.to}
                label={item.label}
                emphasize={item.emphasize}
                className="py-2.5 text-sm"
                onNavigate={() => setOpen(false)}
              />
            ))}
            <Link
              to="/audit"
              className="mt-3 block rounded-full px-4 py-3 text-center text-[11px] leading-[1.3]"
              style={scanCtaStyle}
              onClick={() => setOpen(false)}
            >
              {HERO_SCAN_CTA_LABEL}
            </Link>
            <ul className="mt-4 flex flex-wrap gap-3 border-t border-white/[0.06] pt-3">
              {LANDING_TRUST_MARKS.map((mark) => (
                <li
                  key={mark}
                  className="inline-flex items-center gap-1.5 text-[8px] tracking-[.14em]"
                  style={{ fontFamily: LANDING_MONO, color: '#7a7a82' }}
                >
                  <span
                    className="h-1 w-1 rounded-full"
                    style={{ backgroundColor: LANDING_GREEN }}
                    aria-hidden="true"
                  />
                  {mark}
                </li>
              ))}
            </ul>
          </nav>
        </div>
      )}
    </header>
  );
}
