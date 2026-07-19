import React from 'react';
import { Link } from 'react-router-dom';
import { ShieldCheck, Lock, MapPin } from 'lucide-react';
import { Logo } from '../../components/Logo';
import { openCookieSettings } from '../../components/CookieConsent';

const COLUMNS: { title: string; links: { label: string; to: string }[] }[] = [
  {
    title: 'Plattform',
    links: [
      { label: 'Executive Dashboard', to: '/os/app' },
      { label: 'Compliance Command Center', to: '/os/app/compliance' },
      { label: 'Evidence Vault', to: '/os/app/evidence' },
      { label: 'Risk Graph', to: '/os/app/risks' },
      { label: 'Monitoring', to: '/os/app/monitoring' },
      { label: 'AI Use Case Registry', to: '/os/app/ai-usecases' },
    ],
  },
  {
    title: 'Lösungen',
    links: [
      { label: 'DSGVO Audit', to: '/os/audit' },
      { label: 'EU AI Act Governance', to: '/os/ai-act' },
      { label: 'Agenturen / White Label', to: '/os/agencies' },
      { label: 'Pricing', to: '/os/pricing' },
    ],
  },
  {
    title: 'Rechtliches',
    links: [
      { label: 'Datenschutz', to: '/legal/privacy' },
      { label: 'Impressum', to: '/legal/impressum' },
      { label: 'Sub-Prozessoren', to: '/legal/sub-processors' },
      { label: 'Allgemeine Bedingungen', to: '/legal/terms' },
      { label: 'Widerruf', to: '/legal/widerruf' },
    ],
  },
  {
    title: 'Konto',
    links: [
      { label: 'Login', to: '/os/login' },
      { label: 'Registrieren', to: '/os/signup' },
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
