import { useState, type CSSProperties, type MouseEvent } from 'react';
import { Link } from 'react-router-dom';
import { Menu, X } from 'lucide-react';
import {
  LANDING_ACCENT,
  LANDING_BG,
  LANDING_BUTTON_ALT,
  LANDING_BUTTON_TEXT,
  LANDING_TEXT,
} from './landing-theme';

/**
 * Shared dark public header for `/` and `/branchen`.
 *
 * Dominik cyan night-map Referenz: sticky frosted bar, white nav, cyan pill CTA.
 * Working P0 nav targets from #1280/#1279 remain — hash targets use `/#…`
 * so they resolve from `/branchen` as well. `/ai-act` + `/sicherheit`
 * stay reachable (platform-capabilities contract).
 */
const LINKS = [
  { label: 'Produkt', to: '/#product', className: undefined },
  { label: 'Runtime', to: '/governance-runtime', className: undefined },
  { label: 'Branchen', to: '/branchen', className: undefined },
  { label: 'Evidence', to: '/#evidence', className: undefined },
  { label: 'Module', to: '/#tools', className: 'hidden lg:block' },
  { label: 'EU AI Act', to: '/ai-act', className: 'hidden xl:block' },
  { label: 'Sicherheit', to: '/sicherheit', className: 'hidden xl:block' },
  { label: 'Preise', to: '/#pricing', className: undefined },
  { label: 'Login', to: '/welcome', className: undefined },
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
    className: `text-[13px] font-medium tracking-tight transition-colors focus-visible:outline-none focus-visible:underline focus-visible:underline-offset-4${className ? ` ${className}` : ''}`,
    style: { color: 'rgba(255,255,255,0.78)' } as CSSProperties,
    onMouseEnter: (e: MouseEvent<HTMLAnchorElement>) => {
      e.currentTarget.style.color = LANDING_TEXT;
    },
    onMouseLeave: (e: MouseEvent<HTMLAnchorElement>) => {
      e.currentTarget.style.color = 'rgba(255,255,255,0.78)';
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
  backgroundColor: LANDING_BUTTON_ALT,
  color: LANDING_BUTTON_TEXT,
  fontWeight: 600,
};

export function PublicDarkHeader({ overlay = false }: { overlay?: boolean }) {
  const [open, setOpen] = useState(false);

  return (
    <header
      className={`${overlay ? 'absolute bg-[rgba(5,7,11,0.35)]' : 'sticky bg-[rgba(5,7,11,0.72)]'} inset-x-0 top-0 z-30 border-b border-white/[0.06] backdrop-blur-[18px]`}
      style={{ color: LANDING_TEXT }}
    >
      <div className="mx-auto flex h-[72px] max-w-[1500px] items-center gap-6 px-[4vw]">
        <div className="flex min-w-0 items-center gap-3">
          <Link
            to="/"
            className="flex min-w-0 items-center gap-2 rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00E5FF]/60"
            style={{ color: LANDING_TEXT }}
          >
            <span className="truncate whitespace-nowrap text-[15px] font-medium tracking-tight">
              RealSync Dynamics
              <span style={{ color: LANDING_ACCENT }}>.AI</span>
            </span>
          </Link>
          <span
            className="hidden items-center gap-1.5 rounded-full border px-2 py-1 text-[9px] tracking-[.16em] md:inline-flex"
            style={{
              fontFamily: "'DM Mono', ui-monospace, monospace",
              borderColor: 'rgba(0,229,255,0.35)',
              backgroundColor: 'rgba(0,229,255,0.08)',
              color: 'rgba(0,229,255,0.92)',
            }}
            title="Product category — not a live tenant metric"
          >
            <span
              className="h-1.5 w-1.5 rounded-full"
              style={{ backgroundColor: LANDING_ACCENT, boxShadow: `0 0 8px ${LANDING_ACCENT}` }}
              aria-hidden="true"
            />
            GOV OS
          </span>
        </div>

        <nav className="ml-auto hidden items-center gap-7 lg:flex" aria-label="Hauptnavigation">
          {LINKS.map((item) => (
            <NavItem key={item.to} {...item} />
          ))}
          <Link
            to="/audit"
            className="max-w-[11rem] rounded-full px-[18px] py-[11px] text-center text-[11px] leading-[1.3] shadow-[0_0_28px_rgba(0,229,255,0.22)] transition hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00E5FF]"
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
            className="rounded-md p-1.5 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00E5FF]/60"
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
            style={{ fontFamily: "'DM Mono', ui-monospace, monospace", color: `${LANDING_ACCENT}b3` }}
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
              className="mt-3 block rounded-full px-4 py-3 text-center text-[11px] leading-[1.3]"
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
