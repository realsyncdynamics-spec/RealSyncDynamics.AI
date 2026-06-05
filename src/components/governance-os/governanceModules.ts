import type { GovernanceModule } from './governanceBrowserTypes';

export const GOVERNANCE_MODULES: GovernanceModule[] = [
  {
    id: 'overview',
    label: 'Übersicht',
    icon: 'Home',
    route: '/app',
    status: 'live',
    plans: ['free', 'starter', 'professional', 'enterprise'],
    description: 'Zentrale Governance-Übersicht',
  },
  {
    id: 'websites',
    label: 'Websites',
    icon: 'Globe',
    route: '/app/websites',
    status: 'live',
    plans: ['free', 'starter', 'professional', 'enterprise'],
    description: 'Website-Governance, Scans und Findings',
  },
  {
    id: 'evidence',
    label: 'Evidence',
    icon: 'FileCheck2',
    route: '/app/evidence',
    status: 'live',
    plans: ['starter', 'professional', 'enterprise'],
    description: 'Hashes, Snapshots und Audit Trails',
  },
  {
    id: 'ai-systems',
    label: 'KI-Systeme',
    icon: 'Bot',
    route: '/app/ai-systems',
    status: 'beta',
    plans: ['professional', 'enterprise'],
    description: 'KI-System-Registry und EU-AI-Act-Dokumentation',
  },
  {
    id: 'risks',
    label: 'Risiken',
    icon: 'AlertTriangle',
    route: '/app/risks',
    status: 'beta',
    plans: ['professional', 'enterprise'],
    description: 'Risikoidentifikation und Priorisierung',
  },
  {
    id: 'monitoring',
    label: 'Monitoring',
    icon: 'Activity',
    route: '/app/monitoring',
    status: 'beta',
    plans: ['starter', 'professional', 'enterprise'],
    description: 'Runtime Monitoring und Drift Alerts',
  },
  {
    id: 'vendors',
    label: 'Vendors',
    icon: 'Building2',
    route: '/app/vendors',
    status: 'beta',
    plans: ['professional', 'enterprise'],
    description: 'Vendor- und DPA-Tracking',
  },
  {
    id: 'reports',
    label: 'Reports',
    icon: 'BarChart3',
    route: '/app/reports',
    status: 'beta',
    plans: ['starter', 'professional', 'enterprise'],
    description: 'Compliance- und Audit-Reports',
  },
  {
    id: 'dpia',
    label: 'DSFA',
    icon: 'ClipboardList',
    route: '/app/dpia',
    status: 'roadmap',
    plans: ['professional', 'enterprise'],
    description: 'DSFA/DPIA Generator',
  },
  {
    id: 'remediation',
    label: 'Remediation',
    icon: 'Wrench',
    route: '/app/remediation',
    status: 'roadmap',
    plans: ['enterprise'],
    description: 'Auto-Fixes, Pull Requests und Maßnahmen',
  },
  {
    id: 'team',
    label: 'Team',
    icon: 'Users',
    route: '/app/team',
    status: 'live',
    plans: ['professional', 'enterprise'],
    description: 'Rollen, Team und Zugriff',
  },
  {
    id: 'settings',
    label: 'Einstellungen',
    icon: 'Settings',
    route: '/app/settings',
    status: 'live',
    plans: ['free', 'starter', 'professional', 'enterprise'],
    description: 'Mandant, Sicherheit und Integrationen',
  },
];

// Tabs sichtbar in der Browser-Nav (Live + Beta, kein Roadmap)
export const TAB_MODULES = GOVERNANCE_MODULES.filter(
  (m) => m.status === 'live' || m.status === 'beta',
);

// Roadmap-Module für den ModuleDock
export const DOCK_MODULES = GOVERNANCE_MODULES.filter(
  (m) => m.status === 'roadmap',
);
