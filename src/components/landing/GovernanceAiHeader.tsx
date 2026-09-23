/** Production navigation — Brand Direction v1.0. */
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Menu, X } from 'lucide-react';
import { PUBLIC_CTA, PUBLIC_PRIMARY_NAV } from '../../config/public-nav';
import { GA_SANS, GA_LINE_SOFT, GA_MUTED, GA_TEXT } from './governance-ai-theme';
import { HERO_SCAN_CTA_LABEL } from '../governance-frontend/hero-content';

/** `/#product` → `#product`; alles andere bleibt eine Route. */
function localAnchor(to: string): string | null {
  return to.startsWith('/#') ? to.slice(1) : null;
}

function NavItem({ label, to, onClick }: { label: string; to: string; onClick?: () => void }) {
  const anchor = localAnchor(to);
  const className =
    'text-[15px] font-medium tracking-[-.005em] transition-colors hover:text-[var(--ga-text)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ga-accent-lite)] rounded';
  const style = { fontFamily: GA_SANS, color: GA_MUTED };

  return anchor ? (
    <a href={anchor} className={className} style={style} onClick={onClick}>
      {label}
    </a>
  ) : (
    <Link to={to} className={className} style={style} onClick={onClick}>
      {label}
    </Link>
  );
}

export function GovernanceAiHeader() {
  const [open, setOpen] = useState(false);

  const cta = (
    <Link
      to={PUBLIC_CTA.to}
      reloadDocument
      className="ga-pill-sheen relative inline-flex items-center gap-2 overflow-hidden whitespace-nowrap rounded-full px-[18px] py-[11px] text-[14px] font-semibold leading-[1.3] tracking-[-.005em] transition hover:brightness-[1.06] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ga-accent-lite)]"
      style={{
        fontFamily: GA_SANS,
        backgroundImage: 'var(--ga-pill-face)',
        color: 'var(--ga-pill-ink)',
        boxShadow: 'var(--ga-pill-shadow)',
      }}
      onClick={() => setOpen(false)}
    >
      {HERO_SCAN_CTA_LABEL}
      <ArrowRight className="h-4 w-4" aria-hidden="true" />
    </Link>
  );

  return (
    <header
      className="sticky top-0 z-50 border-b backdrop-blur-[18px]"
      style={{
        borderColor: GA_LINE_SOFT,
        backgroundColor: 'var(--ga-void)',
      }}
    >
      <div className="mx-auto flex h-[76px] w-full max-w-[1500px] items-center gap-6 px-[4vw]">
        <Link
          to="/"
          className="text-[21px] font-medium tracking-[-.02em]"
          style={{ fontFamily: GA_SANS, color: GA_TEXT }}
        >
          RealSync Dynamics.AI
        </Link>

        <nav className="ml-auto hidden items-center gap-[26px] lg:flex" aria-label="Hauptnavigation">
          {PUBLIC_PRIMARY_NAV.map((item) => (
            <NavItem key={item.to} label={item.label} to={item.to} />
          ))}
          {cta}
        </nav>

        <button
          type="button"
          className="ml-auto inline-flex h-10 w-10 items-center justify-center rounded-md border lg:hidden"
          style={{ borderColor: GA_LINE_SOFT, color: GA_TEXT }}
          aria-expanded={open}
          aria-label={open ? 'Navigation schließen' : 'Navigation öffnen'}
          onClick={() => setOpen((value) => !value)}
        >
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {open && (
        <nav
          className="flex flex-col gap-4 border-t px-[4vw] py-5 lg:hidden"
          style={{ borderColor: GA_LINE_SOFT, backgroundColor: 'var(--ga-void)' }}
          aria-label="Hauptnavigation"
        >
          {PUBLIC_PRIMARY_NAV.map((item) => (
            <NavItem
              key={item.to}
              label={item.label}
              to={item.to}
              onClick={() => setOpen(false)}
            />
          ))}
          <div className="pt-1">{cta}</div>
        </nav>
      )}
    </header>
  );
}
