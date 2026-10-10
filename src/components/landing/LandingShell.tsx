import { Link } from 'react-router-dom';
import { PublicHeader } from '../brand/PublicHeader';
import { PublicFooter } from '../brand/PublicFooter';

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
  return (
    <PublicHeader
      nav={LANDING_NAV}
      login={{ label: 'Login', to: '/app' }}
      cta={{ label: '14 Tage testen', mobileLabel: '14 Tage kostenlos testen', to: TRIAL_CTA }}
    />
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
        { label: 'Warteliste', to: '/warteliste' },
      ],
    },
    {
      title: 'Ressourcen',
      links: [
        { label: 'Ressourcen', to: '/ressourcen' },
        { label: 'Onboarding erklärt', to: '/onboarding-erklaert' },
        { label: 'Evidence Runtime', to: '/evidence-runtime' },
        { label: 'KI-Governance in 5 Schritten', to: '/ki-governance-in-5-schritten' },
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
  return <PublicFooter linkColumns={cols} />;
}
