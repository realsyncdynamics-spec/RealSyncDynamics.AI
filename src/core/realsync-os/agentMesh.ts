/**
 * RealSync Agent OS — specialist mesh registry.
 * Status is honest: only Compliance (+ SiteOS evaluate_governance) is preview-runnable.
 * Maturity aligns with src/product/implementation-status.ts ('coming-soon' hyphen).
 */

import type { ImplementationStatus } from '../../product/implementation-status';
import { STATUS_LABEL } from '../../product/implementation-status';

export type MeshAgentId =
  | 'orchestrator'
  | 'compliance'
  | 'product'
  | 'marketing'
  | 'sales'
  | 'growth_product_evolution'
  | 'qa_e2e'
  | 'onboarding'
  | 'pricing'
  | 'lead'
  | 'advertising'
  | 'scaling'
  | 'expansion'
  | 'implementation'
  | 'evidence'
  | 'security'
  | 'devops';

export type MeshAgent = {
  id: MeshAgentId;
  label: string;
  role: string;
  maturity: ImplementationStatus;
  /** True only when the Command Center may open a runnable/preview session for this agent. */
  runnable: boolean;
  keywords: string[];
};

/**
 * Governance Command Center → Governance Orchestrator (Policy · Tenant · Audit)
 * → specialist mesh. Do not flatten this hierarchy in the UI copy.
 */
export const AGENT_MESH: readonly MeshAgent[] = [
  {
    id: 'orchestrator',
    label: 'Governance Orchestrator',
    role: 'Policy · Tenant · Audit',
    maturity: 'preview',
    runnable: false,
    keywords: ['orchestrator', 'policy', 'tenant', 'audit'],
  },
  {
    id: 'compliance',
    label: 'Compliance',
    role: 'DSGVO · EU AI Act · Governance Checks',
    maturity: 'preview',
    runnable: true,
    keywords: ['compliance', 'dsgvo', 'gdpr', 'ai act', 'governance'],
  },
  {
    id: 'product',
    label: 'Product',
    role: 'Produktentscheidungen und Roadmap-Signale',
    maturity: 'coming-soon',
    runnable: false,
    keywords: ['product', 'produkt'],
  },
  {
    id: 'marketing',
    label: 'Marketing',
    role: 'Kampagnen und Content-Governance',
    maturity: 'coming-soon',
    runnable: false,
    keywords: ['marketing'],
  },
  {
    id: 'sales',
    label: 'Sales',
    role: 'Pipeline und Angebotsfreigaben',
    maturity: 'coming-soon',
    runnable: false,
    keywords: ['sales', 'vertrieb'],
  },
  {
    id: 'growth_product_evolution',
    label: 'Growth + Product Evolution',
    role: 'Integrity Loop Landing ↔ Pricing ↔ Stripe ↔ Entitlements',
    maturity: 'coming-soon',
    runnable: false,
    keywords: ['growth', 'evolution', 'pricing'],
  },
  {
    id: 'qa_e2e',
    label: 'QA / E2E',
    role: 'Regression und Freigabe-Gates',
    maturity: 'coming-soon',
    runnable: false,
    keywords: ['qa', 'e2e', 'test'],
  },
  {
    id: 'onboarding',
    label: 'Onboarding',
    role: 'Mandanten-Aktivierung',
    maturity: 'coming-soon',
    runnable: false,
    keywords: ['onboarding'],
  },
  {
    id: 'pricing',
    label: 'Pricing',
    role: 'Plan- und Entitlement-Konsistenz',
    maturity: 'coming-soon',
    runnable: false,
    keywords: ['pricing', 'preis'],
  },
  {
    id: 'lead',
    label: 'Lead',
    role: 'Lead-Qualifizierung',
    maturity: 'coming-soon',
    runnable: false,
    keywords: ['lead'],
  },
  {
    id: 'advertising',
    label: 'Advertising',
    role: 'Ads-Governance',
    maturity: 'coming-soon',
    runnable: false,
    keywords: ['ads', 'advertising', 'werbung'],
  },
  {
    id: 'scaling',
    label: 'Scaling',
    role: 'Kapazität und Limits',
    maturity: 'coming-soon',
    runnable: false,
    keywords: ['scaling', 'skalierung'],
  },
  {
    id: 'expansion',
    label: 'Expansion',
    role: 'Markt- und Modul-Expansion',
    maturity: 'coming-soon',
    runnable: false,
    keywords: ['expansion'],
  },
  {
    id: 'implementation',
    label: 'Implementation',
    role: 'Umsetzungspläne',
    maturity: 'coming-soon',
    runnable: false,
    keywords: ['implementation', 'umsetzung'],
  },
  {
    id: 'evidence',
    label: 'Evidence',
    role: 'Nachweise und Prüfpfad',
    maturity: 'coming-soon',
    runnable: false,
    keywords: ['evidence', 'nachweis', 'prüfpfad'],
  },
  {
    id: 'security',
    label: 'Security',
    role: 'Security-Findings und Gates',
    maturity: 'coming-soon',
    runnable: false,
    keywords: ['security', 'sicherheit'],
  },
  {
    id: 'devops',
    label: 'DevOps',
    role: 'Deploy- und Runtime-Ops',
    maturity: 'coming-soon',
    runnable: false,
    keywords: ['devops', 'deploy'],
  },
] as const;

export function listMeshAgents(): readonly MeshAgent[] {
  return AGENT_MESH;
}

export function getRunnableMeshAgents(): readonly MeshAgent[] {
  return AGENT_MESH.filter((agent) => agent.runnable);
}

export function maturityBadgeDe(maturity: ImplementationStatus): string {
  return STATUS_LABEL[maturity];
}
