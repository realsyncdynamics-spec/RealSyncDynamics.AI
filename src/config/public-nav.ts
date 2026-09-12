/**
 * Public Dark chrome — information architecture for header + footer.
 *
 * Every destination is a real route or an in-page hash on `/`.
 * Preview / Coming Soon capabilities still resolve to a real page.
 * Never ship dead `#` stubs from outside `/`.
 */

export type NavBadge = 'live' | 'preview' | 'coming-soon';

export interface PublicNavLeaf {
  label: string;
  to: string;
  description?: string;
  badge?: NavBadge;
}

export interface PublicNavGroup {
  id: string;
  label: string;
  /** Top-level href when the group itself is clickable (desktop). */
  to?: string;
  children: PublicNavLeaf[];
}

/** Primary header groups — honest submenus, no fake mega-menus. */
export const PUBLIC_NAV_GROUPS: PublicNavGroup[] = [
  {
    id: 'produkt',
    label: 'Produkt',
    to: '/#product',
    children: [
      {
        label: 'Runtime',
        to: '/governance-runtime',
        description: 'Detect · Govern · Prove',
      },
      {
        label: 'Evidence',
        to: '/welcome?next=/app/evidence',
        description: 'Prüfpfad & Herkunftsnachweis',
      },
      {
        label: 'Module / Tools',
        to: '/#tools',
        description: 'Builder, Bots, Scanner',
      },
      {
        label: 'Roadmap',
        to: '/roadmap',
        description: 'Live · Preview · Coming Soon',
      },
      {
        label: 'EU AI Act',
        to: '/ai-act',
        description: 'Risiko, Transparenz, Dokumentation',
      },
      {
        label: 'Sicherheit',
        to: '/sicherheit',
        description: 'EU-Hosting & Kontrollen',
      },
    ],
  },
  {
    id: 'module',
    label: 'Module',
    to: '/#tools',
    children: [
      {
        label: 'Builder',
        to: '/welcome?next=/build',
        description: 'SiteOS Workspace',
        badge: 'live',
      },
      {
        label: 'WhatsApp Bot',
        to: '/chatbot/start',
        description: 'Bot starten',
        badge: 'preview',
      },
      {
        label: 'Telefonbot',
        to: '/phonebot/start',
        description: 'Voice-Kanal',
        badge: 'preview',
      },
      {
        label: 'Domain Checker',
        to: '/audit',
        description: 'Öffentlicher Governance Scan',
        badge: 'live',
      },
      {
        label: 'Websites / Custom Domain',
        to: '/welcome?next=/app/websites',
        description: 'Tenant-Domain binden',
        badge: 'preview',
      },
      {
        label: 'Audit / Scanner',
        to: '/audit',
        description: 'Kostenloser Governance Scan',
        badge: 'live',
      },
    ],
  },
  {
    id: 'branchen',
    label: 'Branchen',
    to: '/branchen',
    children: [],
  },
  {
    id: 'preise',
    label: 'Preise',
    to: '/#pricing',
    children: [
      {
        label: 'Starter · monatlich',
        to: '/checkout/starter',
        description: '79 € / Monat',
        badge: 'live',
      },
      {
        label: 'Growth · monatlich',
        to: '/checkout/growth',
        description: '249 € / Monat',
        badge: 'live',
      },
      {
        label: 'Agency · monatlich',
        to: '/checkout/agency',
        description: '699 € / Monat',
        badge: 'live',
      },
      {
        label: 'Yearly',
        to: '/pricing',
        description: 'Jahresabrechnung',
        badge: 'coming-soon',
      },
      {
        label: 'Enterprise',
        to: '/contact-sales?source=nav-enterprise&intent=enterprise',
        description: 'Anfrage',
        badge: 'live',
      },
    ],
  },
  {
    id: 'legal',
    label: 'Legal',
    to: '/impressum',
    children: [
      { label: 'Impressum', to: '/impressum' },
      { label: 'AGB', to: '/agb' },
      { label: 'Datenschutz', to: '/datenschutz' },
      { label: 'Widerruf', to: '/legal/widerruf' },
      { label: 'Kontakt', to: '/kontakt' },
      { label: 'Roadmap', to: '/roadmap' },
    ],
  },
];

/** Compact footer legal/company links for the Dark landing. */
export const PUBLIC_FOOTER_LINKS: PublicNavLeaf[] = [
  { label: 'Impressum', to: '/impressum' },
  { label: 'AGB', to: '/agb' },
  { label: 'Datenschutz', to: '/datenschutz' },
  { label: 'Widerruf', to: '/legal/widerruf' },
  { label: 'Kontakt', to: '/kontakt' },
  { label: 'Roadmap', to: '/roadmap' },
];

export const PUBLIC_CTA = {
  label: 'Kostenlosen Governance Scan starten',
  shortLabel: 'Governance Scan',
  to: '/audit',
} as const;

export const PUBLIC_ACCOUNT = {
  login: { label: 'Login', to: '/welcome' },
  dashboard: { label: 'Dashboard', to: '/app/dashboard' },
  logout: { label: 'Logout', to: '/logout' },
} as const;

export function badgeLabel(badge: NavBadge | undefined): string | null {
  if (badge === 'preview') return 'Preview';
  if (badge === 'coming-soon') return 'Coming Soon';
  return null;
}
