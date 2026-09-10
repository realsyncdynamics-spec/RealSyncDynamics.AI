import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Menu, Snowflake, X } from 'lucide-react';

/**
 * Shared dark public header for `/` and `/branchen`.
 *
 * Nav hierarchy follows P0 Governance-OS (#1280): Produkt → Runtime → Evidence
 * → Module, with Branchen slotted in (#1279) without displacing Runtime.
 * Hash targets use `/#…` so they resolve from `/branchen` as well.
 */
const LINKS = [
  { label: 'Produkt', to: '/#platform', className: undefined },
  { label: 'Runtime', to: '/governance-runtime', className: undefined },
  { label: 'Branchen', to: '/branchen', className: undefined },
  { label: 'Evidence', to: '/#evidence', className: undefined },
  { label: 'Module', to: '/#tools', className: 'hidden lg:block' },
  { label: 'EU AI Act', to: '/ai-act', className: 'hidden xl:block' },
  { label: 'Sicherheit', to: '/sicherheit', className: 'hidden xl:block' },
  { label: 'Preise', to: '/pricing', className: undefined },
  { label: 'Login', to: '/welcome', className: undefined },
] as const;

const linkClass = (extra?: string) =>
  `text-sm text-white/65 transition-colors hover:text-white focus-visible:outline-none focus-visible:text-white focus-visible:underline focus-visible:underline-offset-4${extra ? ` ${extra}` : ''}`;

const scanCtaClass =
  'rounded-full bg-[#f0e6d2] text-sm font-semibold text-[#1a1714] transition hover:bg-[#f6efe4] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#e8c98a] focus-visible:ring-offset-2 focus-visible:ring-offset-[rgb(3,7,18)]';

export function PublicDarkHeader({ overlay = false }: { overlay?: boolean }) {
  const [open, setOpen] = useState(false);

  return (
    <header
      className={`${overlay ? 'absolute' : 'sticky bg-[rgb(3,7,18)]/95 backdrop-blur-md'} inset-x-0 top-0 z-30 border-b border-white/10`}
    >
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-6 sm:h-20 lg:px-10">
        <Link
          to="/"
          className="flex min-w-0 items-center gap-2.5 rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#e8c98a]/60"
        >
          <Snowflake className="h-6 w-6 shrink-0 text-[#e8c98a]" strokeWidth={1.5} />
          <span className="truncate text-base font-semibold tracking-tight text-white sm:text-lg">
            RealSync <span className="font-normal text-white/80">Dynamics.AI</span>
          </span>
        </Link>

        <nav className="hidden items-center gap-5 xl:gap-6 lg:flex" aria-label="Hauptnavigation">
          {LINKS.map((item) =>
            item.to.includes('#') ? (
              <a key={item.to} href={item.to} className={linkClass(item.className)}>
                {item.label}
              </a>
            ) : (
              <Link key={item.to} to={item.to} className={linkClass(item.className)}>
                {item.label}
              </Link>
            ),
          )}
          <Link to="/audit" className={`${scanCtaClass} px-5 py-2.5`}>
            Kostenlosen Governance Scan starten
          </Link>
        </nav>

        {/* Tablet/phone: P0 Scan-CTA bleibt sichtbar neben dem Menü. */}
        <div className="flex items-center gap-2.5 lg:hidden">
          <Link
            to="/audit"
            className={`${scanCtaClass} hidden px-3.5 py-2 text-[13px] sm:inline-flex`}
          >
            Governance Scan
          </Link>
          <button
            type="button"
            className="rounded-md p-1.5 text-white/70 transition hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#e8c98a]/60"
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
          className="border-t border-white/10 bg-[rgb(3,7,18)]/98 px-6 py-4 backdrop-blur-md lg:hidden"
        >
          <nav aria-label="Mobile Navigation" className="flex flex-col">
            {LINKS.map((item) =>
              item.to.includes('#') ? (
                <a
                  key={item.to}
                  href={item.to}
                  className="rounded-md py-2.5 text-sm text-white/80 transition hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#e8c98a]/50"
                  onClick={() => setOpen(false)}
                >
                  {item.label}
                </a>
              ) : (
                <Link
                  key={item.to}
                  to={item.to}
                  className="rounded-md py-2.5 text-sm text-white/80 transition hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#e8c98a]/50"
                  onClick={() => setOpen(false)}
                >
                  {item.label}
                </Link>
              ),
            )}
            <Link
              to="/audit"
              className={`${scanCtaClass} mt-3 block px-4 py-3 text-center`}
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
