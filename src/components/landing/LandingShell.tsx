import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Menu, X, ArrowRight } from 'lucide-react';
import { Logo } from '../Logo';

/**
 * Geteilter Light-Theme-Rahmen für die öffentlichen Funnel-Seiten
 * (MainLanding + AI-DSGVO-Bot-Produktseite). Nutzt die „European Enterprise
 * Trust"-Sprache aus CLAUDE.md: Slate-Neutrals, Petrol-Akzent, ruhige Radien
 * (rounded-chip/card/panel), Monospace ausschließlich für Metadaten.
 *
 * Die Navigation ist bewusst auf den Produkt-Funnel reduziert; der Trial-CTA
 * dominiert optisch, die Enterprise-Demo bleibt als sekundärer Pfad sichtbar.
 */

/**
 * SmartLink — interne Routen ("/...") via react-router-Link (SPA),
 * Anker ("#...") und externe Links via <a>.
 */
export function SmartLink({
  to,
  className,
  children,
}: {
  to: string;
  className?: string;
  children: React.ReactNode;
}) {
  if (to.startsWith('/')) {
    return (
      <Link to={to} className={className}>
        {children}
      </Link>
    );
  }
  return (
    <a href={to} className={className}>
      {children}
    </a>
  );
}

// Vereinfachte Produkt-Navigation — bildet den Funnel ab statt einer
// Marketing-Linksammlung.
export const LANDING_NAV = [
  { label: 'Startseite', to: '/' },
  { label: 'Runtime SaaS', to: '/runtime' },
  { label: 'AI Act & Governance', to: '/ai-act' },
  { label: 'DSGVO Website Audit', to: '/audit' },
  { label: 'AI DSGVO Bot', to: '/ai-dsgvo-bot' },
  { label: 'Preise', to: '/pricing' },
  { label: 'Ressourcen', to: '/ressourcen' },
];

// Zentrale CTA-Ziele — Trial primär, Enterprise-Demo sekundär.
export const TRIAL_CTA = '/welcome?source=landing-trial';
export const DEMO_CTA = '/contact-sales?source=landing-demo';
export const SCAN_CTA = '/audit?source=landing-scan';

export function LandingHeader() {
  const [open, setOpen] = useState(false);
  return (
    <header className="sticky top-0 z-50 bg-white/90 backdrop-blur-xl border-b border-slate-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
        <Link to="/" className="inline-flex items-center gap-2.5 hover:opacity-80 transition-opacity select-none shrink-0">
          <Logo size={26} iconOnly />
          <span className="font-display font-bold text-base tracking-tight">
            <span className="text-slate-900">RealSync</span>
            <span className="font-medium text-slate-400 ml-0.5">Dynamics.AI</span>
          </span>
        </Link>

        <nav className="hidden xl:flex items-center gap-6">
          {LANDING_NAV.map((item) => (
            <SmartLink
              key={item.to}
              to={item.to}
              className="text-sm font-medium tracking-tight text-slate-500 hover:text-slate-900 transition-colors"
            >
              {item.label}
            </SmartLink>
          ))}
        </nav>

        <div className="hidden xl:flex items-center gap-4 shrink-0">
          <SmartLink to="/app" className="text-sm font-medium text-slate-500 hover:text-slate-900 transition-colors">
            Login
          </SmartLink>
          <SmartLink
            to={TRIAL_CTA}
            className="group inline-flex items-center gap-1.5 rounded-chip bg-petrol-700 text-white hover:bg-petrol-600 px-4 py-2 text-sm font-semibold tracking-tight transition-colors"
          >
            14 Tage testen
            <ArrowRight className="h-3.5 w-3.5 group-hover:translate-x-0.5 transition-transform" />
          </SmartLink>
        </div>

        <button
          onClick={() => setOpen(!open)}
          className="xl:hidden text-slate-600 hover:text-slate-900"
          aria-label="Menü öffnen"
        >
          {open ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>
      </div>

      {open && (
        <div className="xl:hidden border-t border-slate-100 bg-white">
          <div className="px-4 py-3 space-y-1">
            {LANDING_NAV.map((item) => (
              <SmartLink
                key={item.to}
                to={item.to}
                className="block px-3 py-2.5 text-base font-medium text-slate-700 hover:bg-slate-50 rounded-chip"
              >
                {item.label}
              </SmartLink>
            ))}
            <SmartLink
              to="/app"
              className="block px-3 py-2.5 text-base font-medium text-slate-700 hover:bg-slate-50 rounded-chip"
            >
              Login
            </SmartLink>
            <SmartLink
              to={TRIAL_CTA}
              className="flex items-center justify-between px-3 py-3 mt-2 text-base font-semibold rounded-chip bg-petrol-700 text-white"
            >
              14 Tage kostenlos testen <ArrowRight className="h-4 w-4" />
            </SmartLink>
          </div>
        </div>
      )}
    </header>
  );
}

export function LandingFooter() {
  const cols = [
    {
      title: 'Produkt',
      links: [
        { label: 'Runtime SaaS', to: '/runtime' },
        { label: 'AI Act & Governance', to: '/ai-act' },
        { label: 'DSGVO Website Audit', to: '/audit' },
        { label: 'AI DSGVO Bot', to: '/ai-dsgvo-bot' },
        { label: 'Preise', to: '/pricing' },
      ],
    },
    {
      title: 'Ressourcen',
      links: [
        { label: 'Ressourcen', to: '/ressourcen' },
        { label: 'Dokumentation', to: '/docs' },
        { label: 'Sicherheit', to: '/sicherheit' },
        { label: 'Roadmap', to: '/roadmap' },
      ],
    },
    {
      title: 'Unternehmen',
      links: [
        { label: 'Über uns', to: '/about' },
        { label: 'Kontakt', to: '/contact-sales' },
        { label: 'Enterprise-Demo', to: DEMO_CTA },
      ],
    },
    {
      title: 'Rechtliches',
      links: [
        { label: 'Impressum', to: '/impressum' },
        { label: 'Datenschutz', to: '/datenschutz' },
        { label: 'Rechtliches', to: '/agb' },
      ],
    },
  ];
  return (
    <footer className="border-t border-slate-200 bg-slate-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-8 lg:gap-10">
          <div className="col-span-2 sm:col-span-3 lg:col-span-1">
            <Link to="/" className="inline-flex items-center gap-2.5 mb-4">
              <Logo size={24} iconOnly />
              <span className="font-display font-bold text-sm tracking-tight text-slate-900">
                RealSync<span className="font-medium text-slate-400 ml-0.5">Dynamics.AI</span>
              </span>
            </Link>
            <p className="text-sm text-slate-500 leading-relaxed max-w-xs">
              Die KI-Governance-Plattform für Mittelstand und regulierte
              Unternehmen. In Deutschland entwickelt, EU-gehostet.
            </p>
          </div>
          {cols.map((c) => (
            <div key={c.title}>
              <h4 className="font-mono text-[11px] tracking-widest text-slate-400 uppercase mb-4">{c.title}</h4>
              <ul className="space-y-2.5">
                {c.links.map((l) => (
                  <li key={l.label}>
                    <SmartLink to={l.to} className="text-sm text-slate-600 hover:text-petrol-700 transition-colors">
                      {l.label}
                    </SmartLink>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="mt-12 pt-6 border-t border-slate-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <p className="font-mono text-[11px] text-slate-400">© 2026 RealSync Dynamics. SaaS &amp; KI-Governance.</p>
          <span className="font-mono text-[11px] text-slate-400">EU-Hosting · DSGVO · EU AI Act</span>
        </div>
      </div>
    </footer>
  );
}
