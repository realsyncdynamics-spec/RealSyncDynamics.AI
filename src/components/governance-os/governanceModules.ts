import type { GovernanceModule } from './governanceBrowserTypes';

// Tier-Hierarchie (inklusiv: höherer Tier bekommt immer alles aus niedrigeren):
// free → starter → growth → agency → scale → enterprise
//
// Governance OS Browser Plan-Mapping:
//   Free       = free
//   Starter    = starter
//   Professional = growth
//   Enterprise = agency / scale / enterprise

export const GOVERNANCE_MODULES: GovernanceModule[] = [
  {
    id: 'overview',
    label: 'Übersicht',
    icon: 'Home',
    route: '/app',
    status: 'live',
    plans: ['free', 'starter', 'growth', 'agency', 'scale', 'enterprise'],
    description: 'Zentrale Governance-Übersicht',
  },
  {
    id: 'home',
    label: 'Workspace',
    icon: 'LayoutDashboard',
    route: '/app/home',
    status: 'live',
    plans: ['free', 'starter', 'growth', 'agency', 'scale', 'enterprise'],
    description: 'Echtzeit-Workspace mit Live-Daten (Auth erforderlich)',
  },
  {
    id: 'websites',
    label: 'Websites',
    icon: 'Globe',
    route: '/app/websites',
    status: 'live',
    plans: ['free', 'starter', 'growth', 'agency', 'scale', 'enterprise'],
    description: 'Website-Governance, Scans und Findings',
  },
  {
    id: 'evidence',
    label: 'Evidence',
    icon: 'FileCheck2',
    route: '/app/evidence',
    status: 'live',
    plans: ['free', 'starter', 'growth', 'agency', 'scale', 'enterprise'],
    description: 'Hashes, Snapshots und Audit Trails (read-only im Free-Plan)',
  },
  {
    id: 'ai-systems',
    label: 'KI-Systeme',
    icon: 'Cpu',
    route: '/app/ai-systems',
    status: 'beta',
    plans: ['starter', 'growth', 'agency', 'scale', 'enterprise'],
    description: 'KI-System-Registry und EU-AI-Act-Dokumentation',
  },
  {
    id: 'risks',
    label: 'Risiken',
    icon: 'AlertTriangle',
    route: '/app/risks',
    status: 'beta',
    plans: ['starter', 'growth', 'agency', 'scale', 'enterprise'],
    description: 'Risikoidentifikation und Priorisierung',
  },
  {
    id: 'monitoring',
    label: 'Monitoring',
    icon: 'Activity',
    route: '/app/monitoring',
    status: 'beta',
    plans: ['starter', 'growth', 'agency', 'scale', 'enterprise'],
    description: 'Runtime Monitoring und Drift Alerts',
  },
  {
    id: 'vendors',
    label: 'Vendors',
    icon: 'Building2',
    route: '/app/vendors',
    status: 'beta',
    plans: ['growth', 'agency', 'scale', 'enterprise'],
    description: 'Vendor- und DPA-Tracking',
  },
  {
    id: 'reports',
    label: 'Reports',
    icon: 'BarChart3',
    route: '/app/reports',
    status: 'beta',
    plans: ['growth', 'agency', 'scale', 'enterprise'],
    description: 'Compliance- und Audit-Reports',
  },
  {
    id: 'dpia',
    label: 'DSFA',
    icon: 'ClipboardList',
    route: '/app/dpia',
    status: 'roadmap',
    plans: ['growth', 'agency', 'scale', 'enterprise'],
    description: 'DSFA/DPIA Generator',
  },
  {
    id: 'alerts',
    label: 'Alerts',
    icon: 'Bell',
    route: '/app/alerts',
    status: 'beta',
    plans: ['starter', 'growth', 'agency', 'scale', 'enterprise'],
    description: 'Laufzeit-Alerts aus Scans, Policy-Engine und Evidence',
  },
  {
    id: 'remediation',
    label: 'Remediation',
    icon: 'Wrench',
    route: '/app/remediation',
    status: 'roadmap',
    plans: ['agency', 'scale', 'enterprise'],
    description: 'Auto-Fixes, Pull Requests und Maßnahmen',
  },
  {
    id: 'billing',
    label: 'Billing',
    icon: 'CreditCard',
    route: '/app/billing',
    status: 'live',
    plans: ['free', 'starter', 'growth', 'agency', 'scale', 'enterprise'],
    description: 'Plan, Abonnement und Abrechnung',
  },
  {
    id: 'team',
    label: 'Team',
    icon: 'Users',
    route: '/app/team',
    status: 'live',
    plans: ['starter', 'growth', 'agency', 'scale', 'enterprise'],
    description: 'Rollen, Team und Zugriff',
  },
  {
    id: 'workflows',
    label: 'Workflows',
    icon: 'GitMerge',
    route: '/app/workflows',
    status: 'live',
    plans: ['starter', 'growth', 'agency', 'scale', 'enterprise'],
    description: 'DSGVO-Prozesse automatisieren (n8n-Integration)',
  },
  {
    id: 'agents',
    label: 'Agenten',
    icon: 'Bot',
    route: '/app/agents',
    status: 'live',
    plans: ['free', 'starter', 'growth', 'agency', 'scale', 'enterprise'],
    description: 'Enterprise Skills - 15 spezialisierte Governance-Agenten',
  },
  {
    id: 'office',
    label: 'Office',
    icon: 'Briefcase',
    route: '/app/office',
    status: 'live',
    plans: ['free', 'starter', 'growth', 'agency', 'scale', 'enterprise'],
    description: 'Dokumente, Tabellen, Präsentationen, Meetings, Verträge und Policies — versioniert, auditiert, evidence-fähig',
  },
  {
    id: 'documents',
    label: 'Dokumente',
    icon: 'FileText',
    route: '/app/documents',
    status: 'live',
    plans: ['free', 'starter', 'growth', 'agency', 'scale', 'enterprise'],
    description: 'DSGVO-Dokumentengenerator: DSE, AVV, TOM, VVT, DSFA',
  },
  {
    id: 'audit',
    label: 'Audit Export',
    icon: 'ClipboardCheck',
    route: '/app/audit',
    status: 'live',
    plans: ['growth', 'agency', 'scale', 'enterprise'],
    description: 'Audit-Ready Reports und Behördenexporte',
  },
  {
    id: 'settings',
    label: 'Einstellungen',
    icon: 'Settings',
    route: '/app/settings',
    status: 'live',
    plans: ['free', 'starter', 'growth', 'agency', 'scale', 'enterprise'],
    description: 'Mandant, Sicherheit und Integrationen',
  },
];

// Alle nicht-Roadmap-Module für die Tab-Leiste
export const TAB_MODULES = GOVERNANCE_MODULES.filter(
  (m) => m.status === 'live' || m.status === 'beta',
);

// Roadmap-Module für den More-Dock
export const DOCK_MODULES = GOVERNANCE_MODULES.filter(
  (m) => m.status === 'roadmap',
);

// Tier-Reihenfolge für inklusiven Vergleich
const TIER_ORDER: GovernanceModule['plans'][number][] = [
  'free', 'starter', 'growth', 'agency', 'scale', 'enterprise',
];

/** Gibt true zurück wenn `userPlan` Zugriff auf das Modul hat. */
export function canAccessModule(module: GovernanceModule, userPlan: string): boolean {
  return module.plans.includes(userPlan as GovernanceModule['plans'][number]);
}

/** Mindest-Tier für ein Modul (erster Eintrag im plans-Array nach TIER_ORDER). */
export function minimumPlanForModule(module: GovernanceModule): string {
  for (const tier of TIER_ORDER) {
    if (module.plans.includes(tier)) return tier;
  }
  return 'enterprise';
}
