import { useMemo } from 'react';
import { PLAN_CONFIG } from '../core/billing/plan-config';
import { FeatureKey, PlanKey } from '../core/billing/types';

export function useFeatureGate(planKey?: PlanKey) {
  return useMemo(() => {
    const key = planKey || 'free';
    const plan = PLAN_CONFIG[key];

    if (!plan) {
      return {
        hasFeature: (feature: FeatureKey) => false,
        canAccessAssets: (count: number) => false,
        planMetadata: null,
      };
    }

    return {
      hasFeature: (feature: FeatureKey) => plan.features[feature] ?? false,
      canAccessAssets: (count: number) => {
        const limit = plan.limits.activeAssets;
        return limit === null || count <= limit;
      },
      planMetadata: plan.metadata || null,
    };
  }, [planKey]);
}

export function useGovernanceFeatures(planKey?: PlanKey) {
  const gate = useFeatureGate(planKey);

  return useMemo(() => {
    const features = {
      websiteScan: gate.hasFeature('website.scan'),
      websiteRescan: gate.hasFeature('website.resan'),
      cookieTracking: gate.hasFeature('cookie.tracking'),
      dsgvoBasic: gate.hasFeature('dsgvo.basic'),
      dsgvoMonitoring: gate.hasFeature('dsgvo.monitoring'),
      aiactClassification: gate.hasFeature('aiact.classification'),
      aiactDeepRisk: gate.hasFeature('aiact.deeprisk'),
      evidenceVault: gate.hasFeature('evidence.vault'),
      policyEngine: gate.hasFeature('policy.engine'),
      dpiaAssessment: gate.hasFeature('dpia.assessment'),
      vendorScreening: gate.hasFeature('vendor.screening'),
      automationBasic: gate.hasFeature('automation.basic'),
      agentsIndustry: gate.hasFeature('agents.industry'),
    };

    return {
      ...features,
      isStarter: !features.dsgvoMonitoring && features.websiteScan,
      isProfessional: features.dsgvoMonitoring && !features.policyEngine,
      isGovernanceOS: features.policyEngine && !features.agentsIndustry,
      isEnterprise: features.agentsIndustry,
    };
  }, [gate]);
}
