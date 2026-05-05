export type PlanLevel = 'free' | 'bronze' | 'silver' | 'gold' | 'platinum';

export interface UserEntitlements {
  plan: PlanLevel;
  features: Record<string, boolean>;
}

const planFeatures: Record<PlanLevel, string[]> = {
  free: [
    'use_chat_basic'
  ],
  bronze: [
    'use_chat_basic',
    'use_extension',
  ],
  silver: [
    'use_chat_basic',
    'use_extension',
    'use_c2pa_assets'
  ],
  gold: [
    'use_chat_basic',
    'use_extension',
    'use_c2pa_assets',
    'use_workflows'
  ],
  platinum: [
    'use_chat_basic',
    'use_extension',
    'use_c2pa_assets',
    'use_workflows',
    'use_byo_api_keys'
  ]
};

export function hasFeature(plan: PlanLevel, featureKey: string): boolean {
  return planFeatures[plan]?.includes(featureKey) ?? false;
}

// Mock User Session for MVP
export function getCurrentUserEntitlements(): UserEntitlements {
  const currentPlan: PlanLevel = 'gold'; // Hardcoded for MVP
  
  const features = planFeatures[currentPlan].reduce((acc, feature) => {
    acc[feature] = true;
    return acc;
  }, {} as Record<string, boolean>);

  return {
    plan: currentPlan,
    features
  };
}
