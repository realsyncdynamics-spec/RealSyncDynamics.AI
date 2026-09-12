import { useState, type CSSProperties, type MouseEvent } from 'react';
import { Link } from 'react-router-dom';
import { Menu, X } from 'lucide-react';
import { HERO_SCAN_CTA_LABEL } from '../governance-frontend/hero-content';
import {
  LANDING_ACCENT,
  LANDING_BG,
  LANDING_BUTTON_ALT,
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
 * Dominik-Referenz: sticky frosted bar, DM Mono CTA, gold brand mark.
 * Working P0 nav targets from #1280/#1279 remain — hash targets use `/#…`
 * so they resolve from `/branchen` as well. `/ai-act` + `/sicherheit`
 * stay reachable (platform-capabilities contract).
 *
 * Monetization: Preise slightly emphasized; Enterprise → inquiry path;
 * optional honest trust strip (no fake SLA / ISO-company claims).
 */
const LINKS = [
  { label: 'Produkt', to: '/#product', className: undefined, emphasize: false },
  { label: 'Runtime', to: '/governance-runtime', className: undefined, emphasize: false },
  { label: 'Branchen', to: '/branchen', className: undefined, emphasize: false },
  { label: 'Evidence', to: '/#evidence', className: undefined, emphasize: false },
  { label: 'Module', to: '/#tools', className: 'hidden lg:block', emphasize: false },
  { label: 'EU AI Act', to: '/ai-act', className: 'hidden xl:block', emphasize: false },
  { label: 'Sicherheit', to: '/sicherheit', className: 'hidden xl:block', emphasize: false },
  { label: 'Preise', to: '/#pricing', className: undefined, emphasize: true },
  { label: 'Enterprise', to: '/#enterprise', className: undefined, emphasize: false },
  { label: 'Login', to: '/welcome', className: undefined, emphasize: false },
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
    className: `text-[12px] transition-colors focus-visible:outline-none focus-visible:underline focus-visible:underline-offset-4${emphasize ? ' font-medium tracking-wide' : ''}${className ? ` ${className}` : ''}`,
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
  backgroundColor: LANDING_BUTTON_ALT,
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
          <span
            className="hidden items-center gap-1.5 rounded-full border px-2 py-1 text-[9px] tracking-[.16em] md:inline-flex"
            style={{
              fontFamily: LANDING_MONO,
              borderColor: `${LANDING_ACCENT}40`,
              backgroundColor: `${LANDING_ACCENT}14`,
              color: `${LANDING_ACCENT}e6`,
            }}
            title="Product category — not a live tenant metric"
          >
            <span className="h-1.5 w-1.5 rounded-full bg-[#20d69a]/90" aria-hidden="true" />
            GOV OS
          </span>
        </div>

        <nav className="ml-auto hidden items-center gap-5 xl:gap-6 lg:flex" aria-label="Hauptnavigation">
          {LINKS.map((item) => (
            <NavItem key={item.to + item.label} {...item} />
          ))}
          <Link
            to="/audit"
            className="landing-cta-glow max-w-[9.5rem] rounded-full px-[18px] py-[11px] text-center text-[10px] leading-[1.3] transition hover:brightness-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#e4cfa2]"
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

      {/* Honest trust strip — standards only, no fake uptime/SLA */}
      <div
        className="hidden border-t border-white/[0.04] lg:block"
        style={{ backgroundColor: 'rgba(5,7,11,0.45)' }}
        aria-label="Vertrauenssignale"
      >
        <ul className="mx-auto flex max-w-[1500px] items-center gap-5 px-[4vw] py-1.5">
          {LANDING_TRUST_MARKS.map((mark) => (
            <li
              key={mark}
              className="inline-flex items-center gap-1.5 text-[8px] tracking-[.16em]"
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
            SYSTEM DRAWER · PUBLIC
          </p>
          <nav aria-label="Mobile Navigation" className="flex flex-col">
            {LINKS.map((item) => (
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
              className="mt-3 block rounded-full px-4 py-3 text-center text-[10px] leading-[1.3]"
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
