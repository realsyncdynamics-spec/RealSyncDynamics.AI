export type PlanKey =
  // Provenance plans
  | 'free'
  | 'bronze'
  | 'silver'
  | 'gold'
  | 'enterprise_public'
  // Governance OS plans
  | 'starter_governance'
  | 'professional_governance'
  | 'governance_os'
  | 'enterprise_regulated';

export type BillingInterval = 'month' | 'year' | 'custom';

export type ProductType = 'provenance' | 'governance' | 'both';

export interface PlanMetadata {
  productType: ProductType;
  displayName: string;
  description: string;
  monthlyPrice: number | null;
  yearlyPrice: number | null;
  target: string;
  maxAssets: number | null;
}

export type SubscriptionStatus =
  | 'inactive'
  | 'trialing'
  | 'active'
  | 'past_due'
  | 'canceled'
  | 'unpaid'
  | 'incomplete'
  | 'paused';

export type TenantRole =
  | 'owner'
  | 'admin'
  | 'editor'
  | 'viewer_auditor';

export type FeatureKey =
  // Provenance features (legacy)
  | 'asset.register'
  | 'asset.verify'
  | 'watermark.apply'
  | 'barcode.issue'
  | 'provenance.basic'
  | 'provenance.advanced'
  | 'c2pa.export'
  // Governance OS features
  | 'website.scan'
  | 'website.resan'
  | 'cookie.tracking'
  | 'dsgvo.basic'
  | 'dsgvo.monitoring'
  | 'aiact.classification'
  | 'aiact.deeprisk'
  | 'evidence.vault'
  | 'policy.engine'
  | 'dpia.assessment'
  | 'vendor.screening'
  | 'automation.basic'
  | 'agents.industry'
  // Core cross-product
  | 'team.members'
  | 'api.access'
  | 'bulk.jobs'
  | 'compliance.export'
  | 'org.governance'
  | 'sso.enabled'
  | 'public-sector.mode';

export interface UsageLimits {
  activeAssets: number | null;
  monthlyRegistrations: number | null;
  teamSeatsIncluded: number | null;
  apiCallsMonthly: number | null;
  bulkJobsMonthly: number | null;
  complianceExportsMonthly: number | null;
}

export interface PlanFeatures {
  features: Record<FeatureKey, boolean>;
  limits: UsageLimits;
  metadata?: PlanMetadata;
}

export interface SubscriptionSnapshot {
  customerId: string;
  subscriptionId: string | null;
  productId: string | null;
  priceId: string | null;
  planKey: PlanKey;
  interval: BillingInterval;
  status: SubscriptionStatus;
  quantity: number | null;
  cancelAtPeriodEnd: boolean;
  currentPeriodEnd: string | null;
  trialEnd: string | null;
  addOns: string[];
}

export interface TenantContext {
  tenantId: string;
  planKey: PlanKey;
  roles: TenantRole[];
  memberCount: number;
  isPublicSector: boolean;
}

export interface EntitlementDecision {
  planKey: PlanKey;
  status: SubscriptionStatus;
  isActive: boolean;
  features: Record<FeatureKey, boolean>;
  limits: UsageLimits;
  seatsAllowed: number | null;
  trialEnd: string | null;
  overages: {
    seatsExceeded: boolean;
    assetsExceeded: boolean;
    apiExceeded: boolean;
    bulkJobsExceeded: boolean;
  };
}

export interface CurrentUsage {
  activeAssets: number;
  monthlyRegistrations: number;
  apiCallsMonthly: number;
  bulkJobsMonthly: number;
  complianceExportsMonthly: number;
}
