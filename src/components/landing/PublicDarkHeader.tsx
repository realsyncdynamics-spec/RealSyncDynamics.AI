import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Menu, Snowflake, X } from 'lucide-react';

const LINKS = [
  { label: 'Produkt', to: '/#platform' },
  { label: 'Branchen', to: '/branchen' },
  { label: 'Evidence', to: '/#evidence' },
  { label: 'EU AI Act', to: '/ai-act' },
  { label: 'Preise', to: '/pricing' },
  { label: 'Login', to: '/welcome' },
] as const;

export function PublicDarkHeader({ overlay = false }: { overlay?: boolean }) {
  const [open, setOpen] = useState(false);

  return (
    <header className={`${overlay ? 'absolute' : 'sticky bg-[rgb(3,7,18)]/95 backdrop-blur-md'} inset-x-0 top-0 z-30 border-b border-white/10`}>
      <div className="mx-auto flex h-20 max-w-7xl items-center justify-between px-6 lg:px-10">
        <Link to="/" className="flex items-center gap-2.5">
          <Snowflake className="h-6 w-6 text-[#e8c98a]" strokeWidth={1.5} />
          <span className="text-base font-semibold tracking-tight text-white sm:text-lg">
            RealSync <span className="font-normal text-white/80">Dynamics.AI</span>
          </span>
        </Link>

        <nav className="hidden items-center gap-6 md:flex" aria-label="Hauptnavigation">
          {LINKS.map((item) =>
            item.to.includes('#') ? (
              <a key={item.to} href={item.to} className="text-sm text-white/65 transition-colors hover:text-white">
                {item.label}
              </a>
            ) : (
              <Link key={item.to} to={item.to} className="text-sm text-white/65 transition-colors hover:text-white">
                {item.label}
              </Link>
            ),
          )}
          <Link
            to="/audit"
            className="rounded-full bg-[#f0e6d2] px-5 py-2.5 text-sm font-semibold text-[#1a1714] transition hover:bg-[#f6efe4]"
          >
            Kostenlos scannen
          </Link>
        </nav>

        <button
          type="button"
          className="text-white/70 hover:text-white md:hidden"
          aria-expanded={open}
          aria-label={open ? 'Menü schließen' : 'Menü öffnen'}
          onClick={() => setOpen((v) => !v)}
        >
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {open && (
        <div className="border-t border-white/10 bg-[rgb(3,7,18)] px-6 py-3 md:hidden">
          {LINKS.map((item) =>
            item.to.includes('#') ? (
              <a key={item.to} href={item.to} className="block py-2.5 text-sm text-white/80" onClick={() => setOpen(false)}>
                {item.label}
              </a>
            ) : (
              <Link key={item.to} to={item.to} className="block py-2.5 text-sm text-white/80" onClick={() => setOpen(false)}>
                {item.label}
              </Link>
            ),
          )}
          <Link to="/audit" className="mt-2 block rounded-full bg-[#f0e6d2] px-4 py-2.5 text-center text-sm font-semibold text-[#1a1714]" onClick={() => setOpen(false)}>
            Kostenlos scannen
          </Link>
        </div>
      )}
    </header>
  );
}
