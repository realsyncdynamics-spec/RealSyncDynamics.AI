import React from 'react';
import { Link } from 'react-router-dom';
import { ShieldCheck, Lock, MapPin } from 'lucide-react';
import { Logo } from '../../components/Logo';
import { openCookieSettings } from '../../components/CookieConsent';
import { PUBLIC_FOOTER_LINKS } from '../../config/public-nav';

/**
 * Enterprise-OS public footer — wired to canonical /app and legal routes.
 * (Prototype /os/* paths are no longer advertised as production destinations.)
 */
const COLUMNS: { title: string; links: { label: string; to: string }[] }[] = [
  {
    title: 'Plattform',
    links: [
      { label: 'Dashboard', to: '/welcome?next=/app/dashboard' },
      { label: 'Governance Runtime', to: '/governance-runtime' },
      { label: 'Websites / Domains', to: '/welcome?next=/app/websites' },
      { label: 'Builder', to: '/welcome?next=/build' },
      { label: 'Bots', to: '/app/bots' },
      { label: 'Scanner', to: '/audit' },
    ],
  },
  {
    title: 'Lösungen',
    links: [
      { label: 'DSGVO Audit', to: '/audit' },
      { label: 'EU AI Act', to: '/ai-act' },
      { label: 'Branchen', to: '/branchen' },
      { label: 'Preise', to: '/pricing' },
      { label: 'Roadmap', to: '/roadmap' },
    ],
  },
  {
    title: 'Rechtliches & Sicherheit',
    links: [
      ...PUBLIC_FOOTER_LINKS.map((l) => ({ label: l.label, to: l.to })),
      { label: 'Sub-Prozessoren (Art. 28)', to: '/legal/sub-processors' },
      { label: 'Security', to: '/sicherheit' },
    ],
  },
  {
    title: 'Konto',
    links: [
      { label: 'Login / Check-in', to: '/welcome' },
      { label: 'Dashboard', to: '/app/dashboard' },
      { label: 'Logout / Check-out', to: '/logout' },
    ],
  },
];

export function PublicFooter() {
  return (
    <footer className="border-t border-titanium-800 bg-obsidian-950">
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="grid grid-cols-2 gap-8 sm:grid-cols-3 lg:grid-cols-5">
          <div className="col-span-2 sm:col-span-3 lg:col-span-1">
            <Logo size={28} />
            <p className="mt-4 max-w-xs text-sm text-titanium-400">
              Governance OS für DSGVO, EU AI Act und Website-Compliance — entwickelt und betrieben in der EU.
            </p>
            <div className="mt-4 flex flex-col gap-2">
              <span className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-wider text-titanium-500">
                <MapPin className="h-3.5 w-3.5 text-security-400" /> Hosting & Betrieb in der EU
              </span>
              <span className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-wider text-titanium-500">
                <ShieldCheck className="h-3.5 w-3.5 text-security-400" /> DSGVO-konform by Design
              </span>
              <span className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-wider text-titanium-500">
                <Lock className="h-3.5 w-3.5 text-security-400" /> EU AI Act Ready
              </span>
            </div>
          </div>

          {COLUMNS.map((col) => (
            <div key={col.title}>
              <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.2em] text-titanium-600">{col.title}</p>
              <ul className="mt-4 space-y-2.5">
                {col.links.map((link) => (
                  <li key={link.label + link.to}>
                    <Link to={link.to} className="text-sm text-titanium-400 transition-colors hover:text-titanium-100">
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-12 flex flex-col items-start justify-between gap-4 border-t border-titanium-800 pt-6 sm:flex-row sm:items-center">
          <p className="font-mono text-[10px] uppercase tracking-wider text-titanium-600">
            © {new Date().getFullYear()} RealSync Dynamics.AI — Alle Rechte vorbehalten.
          </p>
          <div className="flex items-center gap-4">
            <button
              onClick={openCookieSettings}
              className="font-mono text-[10px] uppercase tracking-wider text-titanium-600 hover:text-titanium-300 bg-transparent border-0 p-0 cursor-pointer"
            >
              Cookie-Einstellungen
            </button>
            <p className="font-mono text-[10px] uppercase tracking-wider text-titanium-600">
              Made & hosted in the European Union
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
}
