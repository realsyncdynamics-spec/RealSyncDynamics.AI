import { useEffect, useId, useState, type ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { LangToggle } from '../handoff/LangToggle';
import { cx } from './cx';

/**
 * Gemeinsamer Kopf der öffentlichen Seitenrahmen im Look des v4-Landing-Headers
 * (`V4Header` in landing/v4): Wortmarke links, ruhige Navlinks, goldene
 * CTA-Pille, DE/EN-Umschalter, mobiles Menü mit Escape-Schließen.
 *
 * Nav-Ziele und CTA kommen vom jeweiligen Rahmen (PageShell, LandingShell, …),
 * damit sich beim Umstellen keine Ziele oder Labels ändern.
 */
export interface PublicHeaderLink {
  label: string;
  to: string;
}

export interface PublicHeaderCta {
  label: string;
  /** Kürzeres Label im mobilen Menü (optional). */
  mobileLabel?: string;
  to: string;
  /** Abweichendes Ziel im mobilen Menü (z. B. anderer `source`-Parameter). */
  mobileTo?: string;
}

export interface PublicHeaderProps {
  nav?: readonly PublicHeaderLink[];
  /** Login-Link rechts neben der Navigation (optional). */
  login?: PublicHeaderLink;
  cta?: PublicHeaderCta | null;
  /** Zweite Zeile unter dem Kopf, z. B. Breadcrumb oder Kontextzeile. */
  subbar?: ReactNode;
  /** Ersetzt die Wortmarke (z. B. Produktname im Optimizer). */
  brand?: ReactNode;
  /** `fixed` für Rahmen mit eigenem Top-Padding (PageShell), sonst `sticky`. */
  position?: 'sticky' | 'fixed';
  showLangToggle?: boolean;
}

function NavItem({
  item,
  active,
  className,
  onClick,
}: {
  item: PublicHeaderLink;
  active?: boolean;
  className: string;
  onClick?: () => void;
}) {
  const cls = cx(className, active && 'text-[var(--brand-champ-hi)]');
  if (item.to.startsWith('/')) {
    return (
      <Link to={item.to} className={cls} onClick={onClick} aria-current={active ? 'page' : undefined}>
        {item.label}
      </Link>
    );
  }
  return (
    <a href={item.to} className={cls} onClick={onClick}>
      {item.label}
    </a>
  );
}

const FOCUS =
  'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand-champ)]';

export function PublicHeader({
  nav = [],
  login,
  cta = null,
  subbar,
  brand,
  position = 'sticky',
  showLangToggle = true,
}: PublicHeaderProps) {
  const [open, setOpen] = useState(false);
  const [stuck, setStuck] = useState(false);
  const { pathname } = useLocation();
  const menuId = useId();
  const hasMenu = nav.length > 0 || !!login || !!cta;

  useEffect(() => {
    const onScroll = () => setStuck(window.scrollY > 16);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => setOpen(false), [pathname]);

  const close = () => setOpen(false);
  const isActive = (to: string) => pathname === to.split(/[?#]/)[0];
  const linkCls = cx(
    'text-[13px] font-medium tracking-tight text-[var(--brand-titan)] hover:text-[var(--brand-champ-hi)] transition-colors rounded-[var(--brand-radius-sm)]',
    FOCUS,
  );

  return (
    <header
      data-testid="public-header"
      className={cx(
        position === 'fixed' ? 'fixed inset-x-0 top-0' : 'sticky top-0',
        'z-50 border-b font-[family-name:var(--brand-sans)] transition-colors',
        stuck || open
          ? 'bg-[rgba(5,6,7,0.88)] backdrop-blur-xl border-[var(--brand-line-dark)]'
          : 'bg-[rgba(5,6,7,0.6)] backdrop-blur-md border-[var(--brand-line-dark)]',
      )}
      onKeyDown={(event) => {
        if (open && event.key === 'Escape') {
          setOpen(false);
          event.currentTarget.querySelector<HTMLButtonElement>('[data-nav-toggle]')?.focus();
        }
      }}
    >
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
        <Link
          to="/"
          className={cx(
            'shrink-0 select-none font-[family-name:var(--brand-serif)] text-[17px] font-semibold tracking-tight text-[var(--brand-champ-hi)] hover:opacity-90 rounded-[var(--brand-radius-sm)]',
            FOCUS,
          )}
          aria-label="RealSync Dynamics.AI – Startseite"
        >
          {brand ?? (
            <>
              RealSync <span className="font-medium text-[var(--brand-titan)]">Dynamics.AI</span>
            </>
          )}
        </Link>

        <div className="hidden min-w-0 items-center gap-6 xl:flex">
          {nav.length > 0 && (
            <nav aria-label="Hauptnavigation" className="flex items-center gap-6">
              {nav.map((item) => (
                <NavItem key={item.to + item.label} item={item} active={isActive(item.to)} className={linkCls} />
              ))}
            </nav>
          )}
          {login && <NavItem item={login} className={linkCls} />}
          {cta && (
            <Link
              to={cta.to}
              className={cx(
                'group inline-flex items-center gap-1.5 rounded-full bg-gradient-to-b from-[var(--brand-champ-hi)] to-[var(--brand-champ)] px-4 py-2 text-[13px] font-semibold tracking-tight text-[var(--brand-gold-ink)] hover:from-[var(--brand-champ-hi)] hover:to-[var(--brand-champ-hi)] transition-colors',
                FOCUS,
              )}
            >
              {cta.label}
              <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
            </Link>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-3">
          {showLangToggle && <LangToggle />}
          {hasMenu && (
            <button
              type="button"
              data-nav-toggle=""
              className={cx(
                'inline-flex h-10 w-10 flex-col items-center justify-center gap-[5px] rounded-[var(--brand-radius-md)] border border-[var(--brand-line-dark)] xl:hidden',
                FOCUS,
              )}
              aria-label={open ? 'Navigation schließen' : 'Navigation öffnen'}
              aria-expanded={open}
              aria-controls={menuId}
              onClick={() => setOpen((v) => !v)}
            >
              <span
                className={cx(
                  'block h-px w-4 bg-[var(--brand-champ-hi)] transition-transform',
                  open && 'translate-y-[3px] rotate-45',
                )}
              />
              <span
                className={cx(
                  'block h-px w-4 bg-[var(--brand-champ-hi)] transition-transform',
                  open && '-translate-y-[3px] -rotate-45',
                )}
              />
            </button>
          )}
        </div>
      </div>

      {hasMenu && open && (
        <div id={menuId} className="border-t border-[var(--brand-line-dark)] bg-[var(--brand-bg-1)] xl:hidden">
          <nav aria-label="Hauptnavigation mobil" className="mx-auto max-w-7xl space-y-1 px-4 py-3">
            {nav.map((item) => (
              <NavItem
                key={item.to + item.label}
                item={item}
                active={isActive(item.to)}
                onClick={close}
                className={cx(
                  'block rounded-[var(--brand-radius-md)] px-3 py-3 text-base font-medium text-[var(--brand-champ-hi)] hover:bg-[rgba(242,201,138,0.08)]',
                  FOCUS,
                )}
              />
            ))}
            {login && (
              <NavItem
                item={login}
                onClick={close}
                className={cx(
                  'block rounded-[var(--brand-radius-md)] px-3 py-3 text-base font-medium text-[var(--brand-champ-hi)] hover:bg-[rgba(242,201,138,0.08)]',
                  FOCUS,
                )}
              />
            )}
            {cta && (
              <Link
                to={cta.mobileTo ?? cta.to}
                onClick={close}
                className={cx(
                  'mt-2 flex items-center justify-between rounded-full bg-[var(--brand-champ)] px-4 py-3 text-base font-semibold text-[var(--brand-gold-ink)]',
                  FOCUS,
                )}
              >
                {cta.mobileLabel ?? cta.label} <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
            )}
          </nav>
        </div>
      )}

      {subbar && (
        <div className="border-t border-[var(--brand-line-dark)] bg-[var(--brand-bg-0)]">
          <div className="mx-auto flex min-h-10 max-w-7xl items-center gap-3 px-4 py-2 sm:px-6 lg:px-8">{subbar}</div>
        </div>
      )}
    </header>
  );
}
