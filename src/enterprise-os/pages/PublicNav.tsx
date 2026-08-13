import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Menu, X, ArrowRight } from 'lucide-react';
import { Logo } from '../../components/Logo';
import { Button } from '../components/Button';

const LINKS = [
  { label: 'Produkt', to: '/os/app' },
  { label: 'Automatisierung', to: '/os/automation' },
  { label: 'Evidence', to: '/os/evidence' },
  { label: 'AI Act', to: '/os/ai-act' },
  { label: 'Sicherheit', to: '/os/security' },
  { label: 'Preise', to: '/os/pricing' },
];

export function PublicNav() {
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 border-b border-white/10 bg-[#050b12]/85 backdrop-blur-xl">
      <div className="mx-auto flex h-[76px] max-w-[1440px] items-center justify-between gap-6 px-5 sm:px-8 lg:px-10">
        <Link to="/os" className="shrink-0">
          <Logo size={34} />
        </Link>

        <nav className="hidden items-center gap-1 xl:flex">
          {LINKS.map((link) => (
            <Link
              key={link.to}
              to={link.to}
              className="rounded-full px-3 py-2 text-sm font-medium text-titanium-300 transition hover:bg-white/5 hover:text-white"
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="hidden items-center gap-3 xl:flex">
          <Link to="/os/login" className="px-3 py-2 text-sm font-medium text-titanium-300 transition hover:text-white">
            Login
          </Link>
          <Link to="/os/audit">
            <Button variant="primary" size="sm">
              Kostenlos starten <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
            </Button>
          </Link>
        </div>

        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 text-titanium-300 xl:hidden"
          aria-label={open ? 'Menü schließen' : 'Menü öffnen'}
        >
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {open && (
        <div className="border-t border-white/10 bg-[#050b12] px-5 py-5 xl:hidden">
          <nav className="flex flex-col gap-1">
            {LINKS.map((link) => (
              <Link
                key={link.to}
                to={link.to}
                onClick={() => setOpen(false)}
                className="rounded-xl px-3 py-3 text-sm font-medium text-titanium-300 hover:bg-white/5 hover:text-white"
              >
                {link.label}
              </Link>
            ))}
            <Link
              to="/os/login"
              onClick={() => setOpen(false)}
              className="rounded-xl px-3 py-3 text-sm font-medium text-titanium-300 hover:bg-white/5 hover:text-white"
            >
              Login
            </Link>
          </nav>
          <Link to="/os/audit" onClick={() => setOpen(false)} className="mt-3 block">
            <Button variant="primary" size="md" className="w-full">
              Kostenlosen Audit starten <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
            </Button>
          </Link>
        </div>
      )}
    </header>
  );
}
