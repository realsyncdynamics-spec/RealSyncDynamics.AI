import { useState, type CSSProperties, type MouseEvent } from 'react';
import { Link } from 'react-router-dom';
import { Menu, X } from 'lucide-react';
import {
  LANDING_ACCENT,
  LANDING_BG,
  LANDING_BUTTON_ALT,
  LANDING_BUTTON_TEXT,
  LANDING_MONO,
  LANDING_MUTED,
  LANDING_TEXT,
} from './landing-theme';

/**
 * Shared dark public header for `/` and `/branchen`.
 *
 * Dominik-Referenz: sticky frosted bar, DM Mono CTA, gold brand mark.
 * Working P0 nav targets from #1280/#1279 remain — hash targets use `/#…`
 * so they resolve from `/branchen` as well. `/ai-act` + `/sicherheit`
 * stay reachable (platform-capabilities contract).
 */
type NavLink = {
  label: string;
  to: string;
  className?: string;
  /**
   * `pill`  → hervorgehobener Preis-Einstieg (Monetarisierung sichtbar).
   * `badge` → Enterprise-Pfad mit kleinem B2B-Chip.
   * Nur im Desktop-Nav; der Drawer rendert alle Einträge als Liste.
   */
  variant?: 'pill' | 'badge';
};

const LINKS: readonly NavLink[] = [
  { label: 'Produkt', to: '/#product' },
  { label: 'Runtime', to: '/governance-runtime' },
  { label: 'Branchen', to: '/branchen' },
  { label: 'Evidence', to: '/#evidence' },
  { label: 'Module', to: '/#tools', className: 'hidden lg:block' },
  { label: 'EU AI Act', to: '/ai-act', className: 'hidden xl:block' },
  { label: 'Sicherheit', to: '/sicherheit', className: 'hidden xl:block' },
  { label: 'Enterprise', to: '/enterprise', className: 'hidden xl:inline-flex', variant: 'badge' },
  { label: 'Preise', to: '/#pricing', variant: 'pill' },
  { label: 'Login', to: '/welcome' },
];

function NavItem({
  to,
  label,
  className,
  variant,
  onNavigate,
}: {
  to: string;
  label: string;
  className?: string;
  variant?: 'pill' | 'badge';
  onNavigate?: () => void;
}) {
  const focus = 'transition-colors focus-visible:outline-none focus-visible:underline focus-visible:underline-offset-4';
  const suffix = className ? ` ${className}` : '';

  const shared =
    variant === 'pill'
      ? {
          className: `${focus} rounded-full border px-3 py-1.5 text-[11px] font-medium hover:bg-[#e4cfa2]/10${suffix}`,
          style: { color: LANDING_ACCENT, borderColor: `${LANDING_ACCENT}66` } as CSSProperties,
        }
      : {
          className: `${focus} ${variant === 'badge' ? 'inline-flex items-center gap-1.5 ' : ''}text-[12px]${suffix}`,
          style: { color: LANDING_MUTED } as CSSProperties,
          onMouseEnter: (e: MouseEvent<HTMLAnchorElement>) => {
            e.currentTarget.style.color = LANDING_TEXT;
          },
          onMouseLeave: (e: MouseEvent<HTMLAnchorElement>) => {
            e.currentTarget.style.color = LANDING_MUTED;
          },
        };

  const content =
    variant === 'badge' ? (
      <>
        {label}
        <span
          className="rounded-full border px-1.5 py-[2px] text-[7px] tracking-[.16em]"
          style={{
            fontFamily: LANDING_MONO,
            borderColor: `${LANDING_ACCENT}66`,
            backgroundColor: `${LANDING_ACCENT}14`,
            color: LANDING_ACCENT,
          }}
          aria-hidden="true"
        >
          B2B
        </span>
      </>
    ) : (
      label
    );

  if (to.includes('#')) {
    return (
      <a href={to} {...shared} onClick={onNavigate}>
        {content}
      </a>
    );
  }
  return (
    <Link to={to} {...shared} onClick={onNavigate}>
      {content}
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

        <nav className="ml-auto hidden items-center gap-6 lg:flex" aria-label="Hauptnavigation">
          {LINKS.map((item) => (
            <NavItem key={item.to} {...item} />
          ))}
          <Link
            to="/audit"
            className="max-w-[9.5rem] rounded-full px-[18px] py-[11px] text-center text-[10px] leading-[1.3] shadow-[0_0_30px_rgba(228,207,162,0.08)] transition hover:brightness-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#e4cfa2]"
            style={scanCtaStyle}
          >
            Kostenlosen Governance Scan starten
          </Link>
        </nav>

        <div className="ml-auto flex items-center gap-2.5 lg:hidden">
          <Link
            to="/audit"
            className="hidden rounded-full px-3.5 py-2 text-[10px] sm:inline-flex"
            style={scanCtaStyle}
          >
            Governance Scan
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
            SYSTEM DRAWER · PUBLIC
          </p>
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
              className="mt-3 block rounded-full px-4 py-3 text-center text-[10px] leading-[1.3]"
              style={scanCtaStyle}
              onClick={() => setOpen(false)}
            >
              Kostenlosen Governance Scan starten
            </Link>
          </nav>
        </div>
      )}
    </header>
  );
}
