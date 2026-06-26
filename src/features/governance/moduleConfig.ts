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
    path: '/app/keys',
    status: 'live',
    description: 'API Keys für Governance-Ingest'
  },
  {
    id: 'approvals',
    label: 'Approvals',
    path: '/app/approvals',
    status: 'live',
    description: 'Policy-Entscheidungen mit Audit-Trail'
  },
  {
    id: 'dpias',
    label: 'DPIAs',
    path: '/app/dpia',
    status: 'live',
    description: 'Datenschutz-Impact-Assessments'
  },
  {
    id: 'dsr',
    label: 'DSR',
    path: '/app/dsr',
    status: 'live',
    description: 'Auskunftsanfragen (DSGVO Art. 15)'
  },
  {
    id: 'incidents',
    label: 'Incidents',
    path: '/app/incidents',
    status: 'live',
    description: 'Sicherheitsvorfälle & Verstöße'
  },
  {
    id: 'vendors',
    label: 'Vendors',
    path: '/app/vendors',
    status: 'beta',
    description: 'Vendor-Risiko-Management'
  },
  {
    id: 'connectors',
    label: 'Connectors',
    path: '/app/connectors',
    status: 'beta',
    description: 'Integrationen mit externen Systemen'
  },

  // Advanced modules (Beta / Roadmap)
  {
    id: 'costs',
    label: 'Costs',
    path: '/app/costs',
    status: 'beta',
    description: 'AI-Kostenvergleich & Budgets'
  },
  {
    id: 'remediation',
    label: 'Remediation',
    path: '/app/remediation',
    status: 'roadmap',
    description: 'Automatische Behebung von Findings'
  },
  {
    id: 'matrix',
    label: 'Matrix',
    path: '/app/mappings',
    status: 'live',
    description: 'Framework-Control-Mapping'
  },
  {
    id: 'log',
    label: 'Log',
    path: '/app/admin-log',
    status: 'live',
    description: 'Audit-Trail aller Änderungen'
  },
  {
    id: 'report',
    label: 'Report',
    path: '/app/compliance',
    status: 'beta',
    description: 'Governance-Reports & Export'
  },
  {
    id: 'webhooks',
    label: 'Webhooks',
    path: '/app/webhooks',
    status: 'beta',
    description: 'Event-Streams für externe Systeme'
  },
  {
    id: 'analytics',
    label: 'Analytics',
    path: '/app/analytics',
    status: 'beta',
    badge: 'NEW',
    description: 'Real-time KPI-Metriken & Compliance-Reports'
  },
];

export function getModuleStatus(moduleId: string): ModuleStatus {
  const module = GOVERNANCE_MODULES.find((m) => m.id === moduleId);
  return module?.status ?? 'roadmap';
}

export function getModulesByStatus(status: ModuleStatus): ModuleDefinition[] {
  return GOVERNANCE_MODULES.filter((m) => m.status === status);
}
