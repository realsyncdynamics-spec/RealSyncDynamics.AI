/**
 * Governance Module Status Configuration.
 * Defines which modules are Live, Beta, or Roadmap.
 */

export type ModuleStatus = 'live' | 'beta' | 'roadmap';

export interface ModuleDefinition {
  id: string;
  label: string;
  path: string;
  status: ModuleStatus;
  badge?: string;
  description?: string;
}

export const GOVERNANCE_MODULES: ModuleDefinition[] = [
  // Primary modules (Live)
  {
    id: 'keys',
    label: 'Keys',
    path: '/governance/keys',
    status: 'live',
    description: 'API Keys für Governance-Ingest'
  },
  {
    id: 'approvals',
    label: 'Approvals',
    path: '/governance/approvals',
    status: 'live',
    description: 'Policy-Entscheidungen mit Audit-Trail'
  },
  {
    id: 'dpias',
    label: 'DPIAs',
    path: '/governance/dpias',
    status: 'live',
    description: 'Datenschutz-Impact-Assessments'
  },
  {
    id: 'dsr',
    label: 'DSR',
    path: '/governance/dsr',
    status: 'live',
    description: 'Auskunftsanfragen (DSGVO Art. 15)'
  },
  {
    id: 'incidents',
    label: 'Incidents',
    path: '/governance/incidents',
    status: 'live',
    description: 'Sicherheitsvorfälle & Verstöße'
  },
  {
    id: 'vendors',
    label: 'Vendors',
    path: '/governance/vendors',
    status: 'beta',
    description: 'Vendor-Risiko-Management'
  },
  {
    id: 'connectors',
    label: 'Connectors',
    path: '/governance/connectors',
    status: 'beta',
    description: 'Integrationen mit externen Systemen'
  },

  // Advanced modules (Beta / Roadmap)
  {
    id: 'costs',
    label: 'Costs',
    path: '/governance/costs',
    status: 'beta',
    description: 'AI-Kostenvergleich & Budgets'
  },
  {
    id: 'remediation',
    label: 'Remediation',
    path: '/governance/remediation',
    status: 'roadmap',
    description: 'Automatische Behebung von Findings'
  },
  {
    id: 'matrix',
    label: 'Matrix',
    path: '/governance/mappings',
    status: 'live',
    description: 'Framework-Control-Mapping'
  },
  {
    id: 'log',
    label: 'Log',
    path: '/governance/admin-log',
    status: 'live',
    description: 'Audit-Trail aller Änderungen'
  },
  {
    id: 'report',
    label: 'Report',
    path: '/governance/reports',
    status: 'beta',
    description: 'Governance-Reports & Export'
  },
  {
    id: 'webhooks',
    label: 'Webhooks',
    path: '/governance/webhooks',
    status: 'beta',
    description: 'Event-Streams für externe Systeme'
  },
];

export function getModuleStatus(moduleId: string): ModuleStatus {
  const module = GOVERNANCE_MODULES.find((m) => m.id === moduleId);
  return module?.status ?? 'roadmap';
}

export function getModulesByStatus(status: ModuleStatus): ModuleDefinition[] {
  return GOVERNANCE_MODULES.filter((m) => m.status === status);
}
