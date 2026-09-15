/**
 * Public Dark chrome — information architecture for header + footer.
 *
 * Complianty-style ecosystem hierarchy (clear capability menu),
 * NEVER a flat toolbox of 20 scanners. Destinations are real App.tsx routes
 * or /welcome?next=/app/… — no dead hashes outside `/`.
 *
 * Spec: docs/product/scan-funnel.md
 */

export type NavBadge = 'live' | 'preview' | 'coming-soon';

export interface PublicNavLeaf {
  label: string;
  to: string;
  description?: string;
  badge?: NavBadge;
}

/** Nested capability cluster inside a top-level group (Produkt). */
export interface PublicNavSection {
  label: string;
  /** Optional hub for the cluster */
  to?: string;
  badge?: NavBadge;
  children: PublicNavLeaf[];
}

export interface PublicNavGroup {
  id: string;
  label: string;
  /** Top-level href when the group itself is clickable (desktop). */
  to?: string;
  /** Flat children (Lösungen, Ressourcen, Preise, …). */
  children: PublicNavLeaf[];
  /** Ecosystem sections — hierarchy, not a tool strip. */
  sections?: PublicNavSection[];
}

/** Primary header groups — Produkt / Lösungen / Ressourcen / Unternehmen / Preise. */
export const PUBLIC_NAV_GROUPS: PublicNavGroup[] = [
  {
    id: 'produkt',
    label: 'Produkt',
    to: '/#product',
    children: [
      {
        label: 'Governance Runtime',
        to: '/governance-runtime',
        description: 'Detect → Analyze → Govern → Remediate → Evidence → Monitor',
        badge: 'live',
      },
    ],
    sections: [
      {
        label: 'AI Governance',
        to: '/ai-act-governance',
        children: [
          {
            label: 'AI Inventory',
            to: '/welcome?next=/app/risk-inventory',
            description: 'KI-Systeme ohne Excel-Schatten',
            badge: 'live',
          },
          {
            label: 'AI Act',
            to: '/ai-act',
            description: 'Risiko, Transparenz, Pflichten',
            badge: 'live',
          },
          {
            label: 'Risk Engine',
            to: '/welcome?next=/app/risks',
            description: 'Risiken bewerten und priorisieren',
            badge: 'live',
          },
          {
            label: 'Policies',
            to: '/policy-engine',
            description: 'Regeln als ausführbare Kontrollen',
            badge: 'live',
          },
          {
            label: 'Controls',
            to: '/welcome?next=/app/governance/iso27001',
            description: 'Kontrollen im Governance OS',
            badge: 'live',
          },
        ],
      },
      {
        label: 'Privacy Governance',
        to: '/audit',
        children: [
          {
            label: 'DSGVO',
            to: '/dsgvo-ki-checkliste',
            description: 'Datenschutz & KI-Checkliste',
            badge: 'live',
          },
          {
            label: 'Processing / VVT',
            to: '/vvt-wizard',
            description: 'Verzeichnis von Verarbeitungstätigkeiten',
            badge: 'live',
          },
          {
            label: 'AVV',
            to: '/avv-generator',
            description: 'Auftragsverarbeitung',
            badge: 'live',
          },
          {
            label: 'Consent',
            to: '/consent-timing',
            description: 'Einwilligungs-Timing',
            badge: 'live',
          },
        ],
      },
      {
        label: 'Agent Governance',
        to: '/agent-governance',
        badge: 'preview',
        children: [
          {
            label: 'Registry',
            to: '/welcome?next=/app/agents',
            description: 'Agenten inventarisieren',
            badge: 'preview',
          },
          {
            label: 'Policies',
            to: '/policy-engine',
            description: 'Agent-Policies (geteilt)',
            badge: 'preview',
          },
          {
            label: 'Actions',
            to: '/welcome?next=/app/approvals',
            description: 'Action Request → Permission',
            badge: 'preview',
          },
          {
            label: 'Monitoring',
            to: '/welcome?next=/app/monitoring',
            description: 'Agent-Läufe überwachen',
            badge: 'preview',
          },
        ],
      },
      {
        label: 'Evidence',
        to: '/evidence-vault',
        children: [
          {
            label: 'Vault',
            to: '/welcome?next=/app/evidence',
            description: 'Nachweisspeicher',
            badge: 'live',
          },
          {
            label: 'Prüfpfad',
            to: '/welcome?next=/app/governance/audit-trail',
            description: 'Audit Trail',
            badge: 'live',
          },
          {
            label: 'Provenance / C2PA',
            to: '/welcome?next=/app/provenance',
            description: 'Herkunftsnachweis',
            badge: 'live',
          },
        ],
      },
      {
        label: 'Automation',
        to: '/automations',
        children: [
          {
            label: 'Detect',
            to: '/audit',
            description: 'Acquisition-Scan (kein Produktende)',
            badge: 'live',
          },
          {
            label: 'Remediate',
            to: '/welcome?next=/app/remediation',
            description: 'Maßnahmen & Fix-Pläne',
            badge: 'live',
          },
          {
            label: 'Workflows',
            to: '/welcome?next=/app/workflows',
            description: 'Governance-Workflows',
            badge: 'live',
          },
          {
            label: 'Alerts',
            to: '/welcome?next=/app/alerts',
            description: 'Benachrichtigungen',
            badge: 'live',
          },
        ],
      },
      {
        label: 'Platform',
        to: '/developers',
        children: [
          {
            label: 'API',
            to: '/api',
            description: 'REST & Docs',
            badge: 'live',
          },
          {
            label: 'Integrations',
            to: '/integrations',
            description: 'Anbindungen',
            badge: 'live',
          },
          {
            label: 'White Label',
            to: '/welcome?next=/settings/branding',
            description: 'Branding im Workspace',
            badge: 'preview',
          },
          {
            label: 'Analytics',
            to: '/welcome?next=/app/analytics',
            description: 'Compliance-Analytics',
            badge: 'live',
          },
        ],
      },
    ],
  },
  {
    id: 'loesungen',
    label: 'Lösungen',
    to: '/branchen',
    children: [
      {
        label: 'Unternehmen',
        to: '/fuer-saas',
        description: 'SaaS & Mittelstand',
        badge: 'live',
      },
      {
        label: 'Agenturen',
        to: '/fuer-agenturen',
        description: 'Multi-Tenant Governance',
        badge: 'live',
      },
      {
        label: 'DPO / Datenschutz',
        to: '/kanzleien',
        description: 'Kanzleien & Datenschutzrollen',
        badge: 'live',
      },
      {
        label: 'AI Teams',
        to: '/ai-act-governance',
        description: 'KI-Inventar & Klassifikation',
        badge: 'preview',
      },
      {
        label: 'Enterprise',
        to: '/enterprise',
        description: 'Guided Activation & Scale',
        badge: 'live',
      },
      {
        label: 'Entwickler',
        to: '/developers',
        description: 'API, Docs, Integrationen',
        badge: 'live',
      },
    ],
  },
  {
    id: 'ressourcen',
    label: 'Ressourcen',
    to: '/docs',
    children: [
      {
        label: 'AI Act Guide',
        to: '/ai-act',
        description: 'EU AI Act Orientierung',
        badge: 'live',
      },
      {
        label: 'DSGVO Guide',
        to: '/dsgvo-ki-checkliste',
        description: 'DSGVO & KI',
        badge: 'live',
      },
      {
        label: 'Docs',
        to: '/docs',
        description: 'Runtime-Dokumentation',
        badge: 'live',
      },
      {
        label: 'API',
        to: '/api',
        description: 'API-Referenz',
        badge: 'live',
      },
      {
        label: 'Security',
        to: '/sicherheit',
        description: 'EU-Hosting & Kontrollen',
        badge: 'live',
      },
      {
        label: 'Roadmap',
        to: '/roadmap',
        description: 'Live · Preview · Coming Soon',
        badge: 'live',
      },
    ],
  },
  {
    id: 'unternehmen',
    label: 'Unternehmen',
    to: '/about',
    children: [
      { label: 'Über uns', to: '/about' },
      { label: 'Kontakt', to: '/kontakt' },
      { label: 'Sicherheit', to: '/sicherheit' },
      { label: 'Impressum', to: '/impressum' },
    ],
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
  /** Acquisition CTA — never „Demo“ / „testen“. Scan is entry, not the product. */
  label: 'Free Audit starten',
  shortLabel: 'Free Audit starten',
  to: '/audit',
} as const;

/**
 * Europe-OS mock strip — visible top-level links on PublicDarkHeader.
 * Produkt / Evidence / Preise / Login (+ Free Audit CTA). Fuller IA in drawer.
 */
export const PUBLIC_PRIMARY_NAV: readonly PublicNavLeaf[] = [
  { label: 'Produkt', to: '/#product' },
  { label: 'Evidence', to: '/#evidence' },
  { label: 'Preise', to: '/#pricing' },
  { label: 'Login', to: '/welcome' },
] as const;

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
