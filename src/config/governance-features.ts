/**
 * Governance OS Feature-Gating Configuration
 *
 * Maps pricing tiers to available governance modules and features.
 * Single Source of Truth for tier-based access control.
 *
 * Consumed by:
 *   - src/components/governance/GovernanceTierGate.tsx
 *   - Edge Functions: /governance-* (tier validation)
 *   - UI: View-level access control in src/features/governance/
 */

import type { TierId } from './pricing';

export interface GovernanceFeature {
  id: string;
  name: string;
  description: string;
  icon: string; // lucide icon name
  requiredTier: TierId; // minimum tier to access
  beta?: boolean;
}

export interface GovernanceTierConfig {
  tier: TierId;
  label: string;
  /** Maximum number of audit reports per month */
  auditReportsPerMonth: number;
  /** Maximum number of concurrent remediation plans */
  remediationPlans: number;
  /** Evidence items storage (GB) */
  evidenceStorageGb: number;
  /** API keys allowed */
  apiKeysAllowed: number;
  /** Frameworks covered */
  frameworks: string[];
  /** Features available in this tier */
  features: string[];
  /** Support tier: email, priority, dedicated */
  support: 'email' | 'priority' | 'dedicated';
}

/**
 * Tier-to-Feature Matrix
 *
 * Free / Starter: Basic DSGVO compliance only
 * Growth: Full multi-framework (DSGVO + AI Act + ISO 27001)
 * Agency: All Growth + NIS2 + ISO 42001 + Advanced Automation
 * Scale/Enterprise: Unlimited access to all modules
 */
export const GOVERNANCE_TIERS: Record<TierId, GovernanceTierConfig> = {
  free: {
    tier: 'free',
    label: 'Free Audit',
    auditReportsPerMonth: 1,
    remediationPlans: 0,
    evidenceStorageGb: 0.5,
    apiKeysAllowed: 0,
    frameworks: ['dsgvo_basic'],
    features: ['ai_register', 'dsgvo_directory_read'],
    support: 'email',
  },

  starter: {
    tier: 'starter',
    label: 'Starter',
    auditReportsPerMonth: 2,
    remediationPlans: 5,
    evidenceStorageGb: 2,
    apiKeysAllowed: 1,
    frameworks: ['dsgvo', 'ai_act_basic'],
    features: [
      'ai_register',
      'dsgvo_directory',
      'ai_act_risk_assessment_read',
      'evidence_vault_basic',
      'gap_analysis_read',
      'audit_report_basic',
    ],
    support: 'email',
  },

  growth: {
    tier: 'growth',
    label: 'Growth',
    auditReportsPerMonth: 12,
    remediationPlans: 20,
    evidenceStorageGb: 10,
    apiKeysAllowed: 3,
    frameworks: ['dsgvo', 'ai_act', 'iso27001'],
    features: [
      'ai_register',
      'dsgvo_directory',
      'ai_act_risk_assessment',
      'iso27001_controls',
      'evidence_vault_advanced',
      'gap_analysis',
      'remediation_plan_basic',
      'audit_report',
      'workflow_onboarding',
      'compliance_scoring',
    ],
    support: 'priority',
  },

  agency: {
    tier: 'agency',
    label: 'Agency',
    auditReportsPerMonth: 50,
    remediationPlans: 100,
    evidenceStorageGb: 50,
    apiKeysAllowed: 10,
    frameworks: ['dsgvo', 'ai_act', 'iso27001', 'nis2', 'iso42001'],
    features: [
      'ai_register',
      'dsgvo_directory',
      'ai_act_risk_assessment',
      'iso27001_controls',
      'iso42001_controls',
      'nis2_incidents',
      'evidence_vault_advanced',
      'gap_analysis',
      'remediation_plan',
      'audit_report',
      'workflow_onboarding',
      'compliance_scoring',
      'gap_remediation_automation',
      'evidence_versioning',
      'api_access',
      'webhook_notifications',
      'bulk_operations',
      'report_scheduling',
    ],
    support: 'priority',
  },

  scale: {
    tier: 'scale',
    label: 'Scale',
    auditReportsPerMonth: 200,
    remediationPlans: 500,
    evidenceStorageGb: 200,
    apiKeysAllowed: 50,
    frameworks: ['dsgvo', 'ai_act', 'iso27001', 'nis2', 'iso42001', 'dora'],
    features: [
      'ai_register',
      'dsgvo_directory',
      'ai_act_risk_assessment',
      'iso27001_controls',
      'iso42001_controls',
      'nis2_incidents',
      'evidence_vault_advanced',
      'gap_analysis',
      'remediation_plan',
      'audit_report',
      'workflow_onboarding',
      'compliance_scoring',
      'gap_remediation_automation',
      'evidence_versioning',
      'api_access',
      'webhook_notifications',
      'bulk_operations',
      'report_scheduling',
      'multi_tenant_management',
      'custom_workflows',
      'sso_integration',
      'advanced_analytics',
    ],
    support: 'dedicated',
  },

  enterprise: {
    tier: 'enterprise',
    label: 'Enterprise',
    auditReportsPerMonth: -1, // unlimited
    remediationPlans: -1,
    evidenceStorageGb: -1,
    apiKeysAllowed: -1,
    frameworks: ['dsgvo', 'ai_act', 'iso27001', 'nis2', 'iso42001', 'dora', 'nist', 'sox', 'hipaa'],
    features: [
      'ai_register',
      'dsgvo_directory',
      'ai_act_risk_assessment',
      'iso27001_controls',
      'iso42001_controls',
      'nis2_incidents',
      'evidence_vault_advanced',
      'gap_analysis',
      'remediation_plan',
      'audit_report',
      'workflow_onboarding',
      'compliance_scoring',
      'gap_remediation_automation',
      'evidence_versioning',
      'api_access',
      'webhook_notifications',
      'bulk_operations',
      'report_scheduling',
      'multi_tenant_management',
      'custom_workflows',
      'sso_integration',
      'advanced_analytics',
      'dedicated_environment',
      'custom_integrations',
      'sla_monitoring',
    ],
    support: 'dedicated',
  },
};

/**
 * Feature-level configuration
 */
export const GOVERNANCE_FEATURES: GovernanceFeature[] = [
  {
    id: 'ai_register',
    name: 'AI-System Register',
    description: 'Register and classify all AI systems in your organization',
    icon: 'Brain',
    requiredTier: 'starter',
  },
  {
    id: 'dsgvo_directory',
    name: 'DSGVO-Verzeichnis',
    description: 'GDPR data processing directory (Art. 5)',
    icon: 'FileText',
    requiredTier: 'starter',
  },
  {
    id: 'ai_act_risk_assessment',
    name: 'AI-Act Risikoprüfung',
    description: 'Automatic AI Act risk classification (minimal/limited/high/prohibited)',
    icon: 'AlertTriangle',
    requiredTier: 'growth',
  },
  {
    id: 'iso27001_controls',
    name: 'ISO 27001 Kontrollen',
    description: 'Information Security Management System controls',
    icon: 'Lock',
    requiredTier: 'growth',
  },
  {
    id: 'iso42001_controls',
    name: 'ISO 42001 Kontrollen',
    description: 'AI Management System controls',
    icon: 'Brain',
    requiredTier: 'agency',
  },
  {
    id: 'nis2_incidents',
    name: 'NIS2-Meldepflichten',
    description: 'Incident reporting deadlines and compliance tracking (6h/24h/72h)',
    icon: 'Clock',
    requiredTier: 'agency',
  },
  {
    id: 'gap_analysis',
    name: 'Gap-Analyse',
    description: 'Identify and track compliance gaps across frameworks',
    icon: 'Target',
    requiredTier: 'growth',
  },
  {
    id: 'evidence_vault_advanced',
    name: 'Nachweis-Vault Advanced',
    description: 'Evidence management with framework linking and versioning',
    icon: 'FileText',
    requiredTier: 'growth',
  },
  {
    id: 'remediation_plan',
    name: 'Behebungsplan',
    description: 'Milestone tracking and remediation progress management',
    icon: 'Target',
    requiredTier: 'growth',
  },
  {
    id: 'audit_report',
    name: 'Audit-Berichte',
    description: 'Multi-framework compliance reporting',
    icon: 'BarChart3',
    requiredTier: 'growth',
  },
  {
    id: 'api_access',
    name: 'API & Webhooks',
    description: 'Programmatic access to governance data and events',
    icon: 'Zap',
    requiredTier: 'agency',
  },
  {
    id: 'bulk_operations',
    name: 'Massen-Operationen',
    description: 'Bulk import/export, batch processing',
    icon: 'Upload',
    requiredTier: 'agency',
  },
  {
    id: 'report_scheduling',
    name: 'Report-Planung',
    description: 'Schedule and automate compliance reports',
    icon: 'Clock',
    requiredTier: 'agency',
  },
  {
    id: 'multi_tenant_management',
    name: 'Multi-Tenant-Verwaltung',
    description: 'Manage compliance across multiple organizations/domains',
    icon: 'Users',
    requiredTier: 'scale',
  },
  {
    id: 'sso_integration',
    name: 'SSO-Integration',
    description: 'Single Sign-On and identity provider integration',
    icon: 'Lock',
    requiredTier: 'scale',
  },
  {
    id: 'dedicated_environment',
    name: 'Dedicated Environment',
    description: 'Isolated infrastructure with custom configuration',
    icon: 'Server',
    requiredTier: 'enterprise',
    beta: false,
  },
];

/**
 * Check if a tier has access to a feature
 */
export function tierHasFeature(tier: TierId, featureId: string): boolean {
  const tierConfig = GOVERNANCE_TIERS[tier];
  if (!tierConfig) return false;
  return tierConfig.features.includes(featureId);
}

/**
 * Get minimum tier required for a feature
 */
export function getFeatureMinimumTier(featureId: string): TierId | undefined {
  const feature = GOVERNANCE_FEATURES.find(f => f.id === featureId);
  return feature?.requiredTier;
}

/**
 * List all features available in a tier
 */
export function getFeaturesByTier(tier: TierId): GovernanceFeature[] {
  const tierConfig = GOVERNANCE_TIERS[tier];
  if (!tierConfig) return [];
  return GOVERNANCE_FEATURES.filter(f => tierConfig.features.includes(f.id));
}

/**
 * Calculate tier upgrade cost recommendation based on needed features
 */
export function getRecommendedTierForFeatures(requiredFeatures: string[]): TierId {
  let minTier: TierId = 'free';
  const tierOrder: TierId[] = ['free', 'starter', 'growth', 'agency', 'scale', 'enterprise'];

  for (const feature of requiredFeatures) {
    const requiredTier = getFeatureMinimumTier(feature);
    if (requiredTier) {
      const currentIndex = tierOrder.indexOf(minTier);
      const requiredIndex = tierOrder.indexOf(requiredTier);
      if (requiredIndex > currentIndex) {
        minTier = requiredTier;
      }
    }
  }

  return minTier;
}
