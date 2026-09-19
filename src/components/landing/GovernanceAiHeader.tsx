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
 * Kopiert ist hier nur die Optik, nicht der Inhalt: Navigation, Login und CTA
 * kommen aus `public-nav.ts` — derselben Quelle wie im Live-Header.
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
import { PUBLIC_ACCOUNT, PUBLIC_CTA, PUBLIC_PRIMARY_NAV } from '../../config/public-nav';
import { GA_DISPLAY, GA_LINE_SOFT, GA_MUTED, GA_TEXT } from './governance-ai-theme';

/** `/#product` → `#product`; alles andere bleibt eine Route. */
function localAnchor(to: string): string | null {
  return to.startsWith('/#') ? to.slice(1) : null;
}

/**
 * Die Navigation der Seite. `PUBLIC_PRIMARY_NAV` führt den Login-Eintrag schon
 * mit; nur falls er dort einmal herausfällt, hängt ihn `PUBLIC_ACCOUNT` an —
 * sonst stünde „Login" doppelt in der Leiste.
 */
const NAV_ITEMS: readonly { label: string; to: string }[] = PUBLIC_PRIMARY_NAV.some(
  (item) => item.to === PUBLIC_ACCOUNT.login.to,
)
  ? PUBLIC_PRIMARY_NAV
  : [...PUBLIC_PRIMARY_NAV, PUBLIC_ACCOUNT.login];

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
      className="ga-pill-sheen relative inline-flex items-center gap-2 overflow-hidden whitespace-nowrap rounded-full px-[18px] py-[11px] text-[14px] font-semibold leading-[1.3] tracking-[-.005em] transition hover:brightness-[1.06] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ga-accent-lite)]"
      style={{
        fontFamily: GA_DISPLAY,
        backgroundImage: 'var(--ga-pill-face)',
        color: 'var(--ga-pill-ink)',
        boxShadow: 'var(--ga-pill-shadow)',
      }}
      onClick={() => setOpen(false)}
    >
      {PUBLIC_CTA.label}
      <ArrowRight className="h-4 w-4" aria-hidden="true" />
    </Link>
  );

  return (
    <header
      className="relative z-20 border-b backdrop-blur-[18px]"
      style={{
        borderColor: GA_LINE_SOFT,
        backgroundImage: 'linear-gradient(180deg, rgba(0,0,0,.6), rgba(0,0,0,0))',
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
          {/* `PUBLIC_PRIMARY_NAV` führt den Login bereits — `PUBLIC_ACCOUNT`
              nur als Rückfall, falls er dort einmal herausfällt. */}
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
