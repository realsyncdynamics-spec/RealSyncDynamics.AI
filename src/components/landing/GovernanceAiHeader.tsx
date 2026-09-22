/**
 * Header der Governance-AI-Vorschau.
 *
 * ## Warum nicht `PublicDarkHeader`
 *
 * Der Live-Header färbt Marke, Navigation und CTA über feste Konstanten aus
 * `landing-theme.ts` — Gold/Cream, per Design-Lock. Als Inline-Styles lassen
 * sie sich von außen nicht umfärben, und die Datei anzufassen hieße, die
 * Startseite umzubauen. Auf einer Seite, deren erste Aussage True Black und
 * Cyan ist, stünde sonst oben rechts eine goldene Pille.
 *
 * Navigation und CTA führen ausschließlich auf bestehende RealSync-Routen;
 * es gibt hier keine zweite Auth-, Audit- oder Pricing-Implementierung.
 *
 * ## Anker statt Startseite
 *
 * `PUBLIC_PRIMARY_NAV` zeigt auf `/#product`, `/#evidence`, `/#pricing`. In
 * der Vorschau tragen die Sektionen dieselben Anker, also bleibt der Sprung
 * auf der Seite, statt sie zu verlassen.
 */
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Menu, X } from 'lucide-react';
import { PUBLIC_CTA } from '../../config/public-nav';
import { GA_DISPLAY, GA_LINE_SOFT, GA_MUTED, GA_TEXT } from './governance-ai-theme';

/** `/#product` → `#product`; alles andere bleibt eine Route. */
function localAnchor(to: string): string | null {
  return to.startsWith('/#') ? to.slice(1) : null;
}

/** Claude-Design navigation mapped only to real, existing product routes. */
const NAV_ITEMS: readonly { label: string; to: string }[] = [
  { label: 'Plattform', to: '/#product' },
  { label: 'AI Governance', to: '/ai-act-governance' },
  { label: 'EU AI Act', to: '/ai-act' },
  { label: 'Evidenz', to: '/#evidence' },
  { label: 'Preise', to: '/#pricing' },
  { label: 'Login', to: '/welcome' },
] as const;

const GOVERNANCE_AUDIT_LABEL = 'Kostenloser Governance-Audit' as const;

function NavItem({ label, to, onClick }: { label: string; to: string; onClick?: () => void }) {
  const anchor = localAnchor(to);
  const className =
    'text-[15px] font-medium tracking-[-.005em] transition-colors hover:text-[var(--ga-text)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ga-accent-lite)] rounded';
  const style = { fontFamily: GA_DISPLAY, color: GA_MUTED };

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
        fontFamily: GA_DISPLAY,
        backgroundImage: 'var(--ga-pill-face)',
        color: 'var(--ga-pill-ink)',
        boxShadow: 'var(--ga-pill-shadow)',
      }}
      onClick={() => setOpen(false)}
    >
      {GOVERNANCE_AUDIT_LABEL}
      <ArrowRight className="h-4 w-4" aria-hidden="true" />
    </Link>
  );

  return (
    <header
      className="sticky top-0 z-50 border-b backdrop-blur-[18px]"
      style={{
        borderColor: GA_LINE_SOFT,
        backgroundImage: 'linear-gradient(180deg, rgba(0,0,0,.94), rgba(4,7,10,.86))',
      }}
    >
      <div className="mx-auto flex h-[76px] w-full max-w-[1500px] items-center gap-6 px-[4vw]">
        <Link
          to="/"
          className="text-[21px] font-medium tracking-[-.02em]"
          style={{ fontFamily: GA_DISPLAY, color: GA_TEXT }}
        >
          RealSync Dynamics.AI
        </Link>

        <nav className="ml-auto hidden items-center gap-[26px] lg:flex" aria-label="Hauptnavigation">
          {NAV_ITEMS.map((item) => (
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
          style={{ borderColor: GA_LINE_SOFT, backgroundColor: 'rgba(0,0,0,.92)' }}
          aria-label="Hauptnavigation"
        >
          {NAV_ITEMS.map((item) => (
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
