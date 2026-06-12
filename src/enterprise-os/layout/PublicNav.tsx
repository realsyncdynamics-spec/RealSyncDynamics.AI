import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Menu, X, ArrowRight } from 'lucide-react';
import { Logo } from '../../components/Logo';
import { Button } from '../components/Button';

const LINKS = [
  { label: 'Plattform', to: '/os/app' },
  { label: 'DSGVO Audit', to: '/audit' },
  { label: 'AI Governance', to: '/ai-act' },
  { label: 'Agenturen', to: '/agencies' },
  { label: 'Pricing', to: '/pricing' },
];

export function PublicNav() {
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 border-b border-titanium-800 bg-obsidian-950/90 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link to="/os" className="shrink-0">
          <Logo size={28} />
        </Link>

        <nav className="hidden items-center gap-1 lg:flex">
          {LINKS.map((link) => (
            <Link
              key={link.to}
              to={link.to}
              className="px-3 py-2 text-sm font-medium text-titanium-300 transition-colors hover:text-titanium-50"
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="hidden items-center gap-3 lg:flex">
          <Link to="/welcome" className="px-3 py-2 text-sm font-medium text-titanium-300 transition-colors hover:text-titanium-50">
            Login
          </Link>
          <Link to="/pricing">
            <Button variant="primary" size="sm">
              14 Tage kostenlos starten <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
            </Button>
          </Link>
        </div>

        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="flex h-9 w-9 items-center justify-center text-titanium-300 lg:hidden"
          aria-label="Menü öffnen"
        >
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {open && (
        <div className="border-t border-titanium-800 bg-obsidian-950 px-4 py-4 lg:hidden">
          <nav className="flex flex-col gap-1">
            {LINKS.map((link) => (
              <Link
                key={link.to}
                to={link.to}
                onClick={() => setOpen(false)}
                className="px-3 py-2.5 text-sm font-medium text-titanium-300 hover:text-titanium-50"
              >
                {link.label}
              </Link>
            ))}
            <Link
              to="/welcome"
              onClick={() => setOpen(false)}
              className="px-3 py-2.5 text-sm font-medium text-titanium-300 hover:text-titanium-50"
            >
              Login
            </Link>
          </nav>
          <Link to="/pricing" onClick={() => setOpen(false)} className="mt-3 block">
            <Button variant="primary" size="md" className="w-full">
              14 Tage kostenlos starten <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
            </Button>
          </Link>
        </div>
      )}
    </header>
  );
}
