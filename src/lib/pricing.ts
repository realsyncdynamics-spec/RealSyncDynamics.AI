/**
 * @file pricing.ts
 * @description Canonical source of truth for commercial packages, billing sources, and plan limits.
 * This file must remain free of UI imports and network side-effects to ensure stable backend deployment.
 */

export type PlanKey = 'gratis' | 'bronze' | 'silber' | 'gold' | 'platin' | 'diamant';
export type BillingSource = 'stripe' | 'invoice' | 'grant' | 'manual';

export const PLAN_ORDER: PlanKey[] = ['gratis', 'bronze', 'silber', 'gold', 'platin', 'diamant'];

export interface PlanDefinition {
  id: PlanKey;
  name: string;
  stripeProductId: string;
  limits: {
    assets: number | 'unlimited';
    teamMembers: number;
    apiRequestsPerMonth: number;
  };
  features: string[];
  modules: string[];
  complianceTier: 'baseline' | 'advanced' | 'institutional' | 'sovereign';
  grantEligible: boolean;
  riskControls: string[];
}

export const PLANS: Record<PlanKey, PlanDefinition> = {
  gratis: {
    id: 'gratis',
    name: 'Gratis',
    stripeProductId: 'prod_gratis_001',
    limits: { assets: 10, teamMembers: 1, apiRequestsPerMonth: 0 },
    features: ['link_registration', 'basic_verification'],
    modules: ['creator_os_basic'],
    complianceTier: 'baseline',
    grantEligible: false,
    riskControls: ['basic_identity_check'],
  },
  bronze: {
    id: 'bronze',
    name: 'Bronze',
    stripeProductId: 'prod_bronze_001',
    limits: { assets: 50, teamMembers: 1, apiRequestsPerMonth: 100 },
    features: ['link_registration', 'basic_monetization', 'identity_linked_registration'],
    modules: ['creator_os_pro', 'creator_seal_basic'],
    complianceTier: 'baseline',
    grantEligible: false,
    riskControls: ['basic_identity_check', 'metadata_integrity'],
  },
  silber: {
    id: 'silber',
    name: 'Silber',
    stripeProductId: 'prod_silber_001',
    limits: { assets: 'unlimited', teamMembers: 3, apiRequestsPerMonth: 1000 },
    features: ['marketplace_participation', 'strong_authenticity'],
    modules: ['creator_os_pro', 'creator_seal_pro', 'market_access'],
    complianceTier: 'advanced',
    grantEligible: true,
    riskControls: ['trust_profile', 'metadata_integrity', 'ownership_consistency'],
  },
  gold: {
    id: 'gold',
    name: 'Gold',
    stripeProductId: 'prod_gold_001',
    limits: { assets: 'unlimited', teamMembers: 10, apiRequestsPerMonth: 10000 },
    features: ['multi_channel_licensing', 'team_workflows', 'c2pa_integration'],
    modules: ['creator_os_pro', 'creator_seal_pro', 'market_access', 'deal_flow'],
    complianceTier: 'advanced',
    grantEligible: true,
    riskControls: ['trust_profile', 'c2pa_validation', 'tamper_evidence'],
  },
  platin: {
    id: 'platin',
    name: 'Platin',
    stripeProductId: 'prod_platin_001',
    limits: { assets: 'unlimited', teamMembers: 50, apiRequestsPerMonth: 100000 },
    features: ['revenue_intelligence', 'policy_controls', 'advanced_audit'],
    modules: ['creator_os_pro', 'creator_seal_pro', 'market_access', 'deal_flow', 'guardian_orchestrator'],
    complianceTier: 'institutional',
    grantEligible: true,
    riskControls: ['advanced_risk_scoring', 'anomaly_detection', 'dispute_resolution'],
  },
  diamant: {
    id: 'diamant',
    name: 'Diamant',
    stripeProductId: 'prod_diamant_001',
    limits: { assets: 'unlimited', teamMembers: 'unlimited' as any, apiRequestsPerMonth: 'unlimited' as any },
    features: ['api_access', 'white_label', 'compliance_exports', 'deep_auditability'],
    modules: ['creator_os_pro', 'creator_seal_pro', 'market_access', 'deal_flow', 'guardian_orchestrator', 'local_flow'],
    complianceTier: 'sovereign',
    grantEligible: true,
    riskControls: ['full_sovereign_control', 'custom_policy_engine', 'institutional_audit'],
  },
};

export function getPlan(planKey: PlanKey): PlanDefinition {
  return PLANS[planKey];
}
