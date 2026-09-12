/**
 * Shared dark public header for `/` and `/branchen`.
 *
 * Europe-OS mockup strip: Produkt | Evidence | Preise | Login + Free Audit starten.
 * Full ecosystem IA remains in PUBLIC_NAV_GROUPS (mobile drawer + Produkt mega).
 */

import { useEffect, useId, useRef, useState, type CSSProperties, type MouseEvent } from 'react';
import { Link } from 'react-router-dom';
import { ChevronDown, Menu, X } from 'lucide-react';
import {
  LANDING_ACCENT,
  LANDING_BG,
  LANDING_BUTTON,
  LANDING_BUTTON_TEXT,
  LANDING_MONO,
  LANDING_MUTED,
  LANDING_TEXT,
} from './landing-theme';
import {
  PUBLIC_ACCOUNT,
  PUBLIC_CTA,
  PUBLIC_NAV_GROUPS,
  PUBLIC_PRIMARY_NAV,
  badgeLabel,
  type PublicNavGroup,
  type PublicNavLeaf,
} from '../../config/public-nav';
import { useOptionalAuth } from './OsEntryLink';

function NavLink({
  to,
  label,
  className,
  onNavigate,
  style,
}: {
  to: string;
  label: string;
  className?: string;
  onNavigate?: () => void;
  style?: CSSProperties;
}) {
  const shared = {
    className: `text-[13px] transition-colors focus-visible:outline-none focus-visible:underline focus-visible:underline-offset-4${className ? ` ${className}` : ''}`,
    style: { color: LANDING_MUTED, ...style } as CSSProperties,
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

function LeafRow({
  leaf,
  onNavigate,
}: {
  leaf: PublicNavLeaf;
  onNavigate?: () => void;
}) {
  const badge = badgeLabel(leaf.badge);
  const content = (
    <>
      <span className="flex items-center gap-2">
        <span style={{ color: LANDING_TEXT }}>{leaf.label}</span>
        {badge && (
          <span
            className="rounded-full border px-1.5 py-0.5 text-[8px] tracking-[.12em]"
            style={{
              fontFamily: LANDING_MONO,
              borderColor: `${LANDING_ACCENT}55`,
              color: LANDING_ACCENT,
            }}
          >
            {badge}
          </span>
        )}
      </span>
      {leaf.description && (
        <span className="mt-0.5 block text-[10px]" style={{ color: LANDING_MUTED }}>
          {leaf.description}
        </span>
      )}
    </>
  );

  const cls =
    'block rounded-sm px-3 py-2.5 transition hover:bg-[#e4cfa2]/08 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#e4cfa2]/50';

  if (leaf.to.includes('#')) {
    return (
      <a href={leaf.to} className={cls} onClick={onNavigate}>
        {content}
      </a>
    );
  }
  return (
    <Link to={leaf.to} className={cls} onClick={onNavigate}>
      {content}
    </Link>
  );
}

function ProduktDropdown() {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const menuId = useId();
  const group = PUBLIC_NAV_GROUPS.find((g) => g.id === 'produkt') as PublicNavGroup | undefined;

  useEffect(() => {
    if (!open) return;
    function onDoc(e: Event) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  if (!group) {
    return <NavLink to="/#product" label="Produkt" />;
  }

  return (
    <div
      ref={rootRef}
      className="relative"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <button
        type="button"
        className="inline-flex items-center gap-1 text-[13px] transition-colors focus-visible:outline-none focus-visible:underline focus-visible:underline-offset-4"
        style={{ color: open ? LANDING_TEXT : LANDING_MUTED }}
        aria-expanded={open}
        aria-controls={menuId}
        onClick={() => setOpen((v) => !v)}
      >
        Produkt
        <ChevronDown className={`h-3 w-3 transition ${open ? 'rotate-180' : ''}`} aria-hidden />
      </button>
      {open && (
        <div
          id={menuId}
          role="menu"
          className="absolute left-0 top-full z-40 max-h-[70vh] min-w-[280px] overflow-y-auto border border-[#e4cfa2]/18 py-2 shadow-[0_18px_40px_rgba(0,0,0,0.45)]"
          style={{ backgroundColor: `${LANDING_BG}f5`, backdropFilter: 'blur(16px)' }}
        >
          {group.to && (
            <div className="mb-1 border-b border-[#e4cfa2]/10 px-1 pb-1">
              <LeafRow
                leaf={{ label: `Alle · ${group.label}`, to: group.to }}
                onNavigate={() => setOpen(false)}
              />
            </div>
          )}
          {group.children.map((leaf) => (
            <LeafRow key={leaf.to + leaf.label} leaf={leaf} onNavigate={() => setOpen(false)} />
          ))}
          {group.sections?.map((section) => (
            <div key={section.label} className="mt-1 border-t border-[#e4cfa2]/10 pt-1">
              <div className="flex items-center justify-between gap-2 px-3 py-1.5">
                {section.to ? (
                  <Link
                    to={section.to}
                    className="text-[10px] tracking-[.14em] transition hover:opacity-90"
                    style={{ fontFamily: LANDING_MONO, color: LANDING_ACCENT }}
                    onClick={() => setOpen(false)}
                  >
                    {section.label}
                  </Link>
                ) : (
                  <span
                    className="text-[10px] tracking-[.14em]"
                    style={{ fontFamily: LANDING_MONO, color: LANDING_ACCENT }}
                  >
                    {section.label}
                  </span>
                )}
                {badgeLabel(section.badge) && (
                  <span
                    className="rounded-full border px-1.5 py-0.5 text-[8px] tracking-[.12em]"
                    style={{
                      fontFamily: LANDING_MONO,
                      borderColor: `${LANDING_ACCENT}55`,
                      color: LANDING_ACCENT,
                    }}
                  >
                    {badgeLabel(section.badge)}
                  </span>
                )}
              </div>
              {section.children.map((leaf) => (
                <LeafRow
                  key={leaf.to + leaf.label}
                  leaf={leaf}
                  onNavigate={() => setOpen(false)}
                />
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function AccountNav({ onNavigate }: { onNavigate?: () => void }) {
  const { isAuthenticated, isLoading } = useOptionalAuth();

  if (isLoading) {
    return (
      <span className="text-[13px]" style={{ color: LANDING_MUTED }}>
        …
      </span>
    );
  }

  if (isAuthenticated) {
    return (
      <div className="flex items-center gap-4">
        <NavLink
          to={PUBLIC_ACCOUNT.dashboard.to}
          label={PUBLIC_ACCOUNT.dashboard.label}
          onNavigate={onNavigate}
        />
        <NavLink
          to={PUBLIC_ACCOUNT.logout.to}
          label={PUBLIC_ACCOUNT.logout.label}
          onNavigate={onNavigate}
        />
      </div>
    );
  }

  return (
    <NavLink
      to={PUBLIC_ACCOUNT.login.to}
      label={PUBLIC_ACCOUNT.login.label}
      onNavigate={onNavigate}
    />
  );
}

const scanCtaStyle: CSSProperties = {
  fontFamily: LANDING_MONO,
  backgroundColor: LANDING_BUTTON,
  color: LANDING_BUTTON_TEXT,
};

export function PublicDarkHeader({ overlay = false }: { overlay?: boolean }) {
  const [open, setOpen] = useState(false);

  return (
    <header
      className={`${overlay ? 'absolute bg-[rgba(2,4,10,0.55)]' : 'sticky bg-[rgba(2,4,10,0.82)]'} inset-x-0 top-0 z-30 border-b border-[#e4cfa2]/12 backdrop-blur-[18px]`}
      style={{ color: LANDING_TEXT }}
    >
      <div className="mx-auto flex h-[72px] max-w-[1500px] items-center gap-6 px-[4vw]">
        <Link
          to="/"
          className="flex min-w-0 items-center gap-2 rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#e4cfa2]/60"
          style={{ color: LANDING_TEXT }}
        >
          <span className="truncate whitespace-nowrap text-[15px] font-medium tracking-tight">
            RealSync Dynamics.AI
          </span>
        </Link>

        <nav className="ml-auto hidden items-center gap-6 lg:flex" aria-label="Hauptnavigation">
          <ProduktDropdown />
          {PUBLIC_PRIMARY_NAV.filter((item) => item.label !== 'Produkt').map((item) => (
            <NavLink key={item.to + item.label} to={item.to} label={item.label} />
          ))}
          <AccountNav />
          <Link
            to={PUBLIC_CTA.to}
            data-hero-cta
            className="rounded-full px-[18px] py-[11px] text-center text-[11px] font-semibold leading-[1.3] shadow-[0_0_30px_rgba(208,195,164,0.1)] transition hover:brightness-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#e4cfa2]"
            style={scanCtaStyle}
          >
            {PUBLIC_CTA.label}
          </Link>
        </nav>

        <div className="ml-auto flex items-center gap-2.5 lg:hidden">
          <Link
            to={PUBLIC_CTA.to}
            className="hidden rounded-full px-3.5 py-2 text-[10px] font-semibold sm:inline-flex"
            style={scanCtaStyle}
          >
            {PUBLIC_CTA.shortLabel}
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
          className="max-h-[80vh] overflow-y-auto border-t border-[#e4cfa2]/12 px-6 py-4 backdrop-blur-md lg:hidden"
          style={{ backgroundColor: `${LANDING_BG}fa` }}
          role="dialog"
          aria-label="Governance OS Navigation"
        >
          <nav aria-label="Mobile Navigation" className="flex flex-col gap-4">
            {PUBLIC_PRIMARY_NAV.map((item) => (
              <NavLink
                key={item.to + item.label}
                to={item.to}
                label={item.label}
                className="py-1 text-sm font-medium"
                style={{ color: LANDING_TEXT }}
                onNavigate={() => setOpen(false)}
              />
            ))}
            <div className="border-t border-[#e4cfa2]/12 pt-3">
              <AccountNav onNavigate={() => setOpen(false)} />
            </div>
            {PUBLIC_NAV_GROUPS.filter((g) => g.id !== 'preise').map((group) => (
              <div key={group.id} className="border-t border-[#e4cfa2]/10 pt-3">
                {group.to ? (
                  <NavLink
                    to={group.to}
                    label={group.label}
                    className="py-1 text-sm font-medium"
                    style={{ color: LANDING_ACCENT }}
                    onNavigate={() => setOpen(false)}
                  />
                ) : (
                  <p className="py-1 text-sm font-medium" style={{ color: LANDING_ACCENT }}>
                    {group.label}
                  </p>
                )}
                {group.children.length > 0 && (
                  <div className="mt-1 flex flex-col border-l border-[#e4cfa2]/15 pl-3">
                    {group.children.map((leaf) => (
                      <LeafRow
                        key={leaf.to + leaf.label}
                        leaf={leaf}
                        onNavigate={() => setOpen(false)}
                      />
                    ))}
                  </div>
                )}
                {group.sections?.map((section) => (
                  <div key={section.label} className="mt-3">
                    <p
                      className="mb-1 text-[9px] tracking-[.16em]"
                      style={{ fontFamily: LANDING_MONO, color: LANDING_ACCENT }}
                    >
                      {section.label}
                      {badgeLabel(section.badge) ? ` · ${badgeLabel(section.badge)}` : ''}
                    </p>
                    <div className="flex flex-col border-l border-[#e4cfa2]/15 pl-3">
                      {section.children.map((leaf) => (
                        <LeafRow
                          key={leaf.to + leaf.label}
                          leaf={leaf}
                          onNavigate={() => setOpen(false)}
                        />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            ))}
            <Link
              to={PUBLIC_CTA.to}
              className="mt-1 block rounded-full px-4 py-3 text-center text-[12px] font-semibold leading-[1.3]"
              style={scanCtaStyle}
              onClick={() => setOpen(false)}
            >
              {PUBLIC_CTA.label}
            </Link>
          </nav>
        </div>
      )}
    </header>
  );
}
