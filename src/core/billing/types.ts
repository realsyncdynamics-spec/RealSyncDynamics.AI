export type PlanKey =
  | 'free'
  | 'bronze'
  | 'silver'
  | 'gold'
  | 'enterprise_public';

export type BillingInterval = 'month' | 'year' | 'custom';

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
  | 'asset.register'
  | 'asset.verify'
  | 'watermark.apply'
  | 'barcode.issue'
  | 'provenance.basic'
  | 'provenance.advanced'
  | 'c2pa.export'
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
  isActive: boolean;
  features: Record<FeatureKey, boolean>;
  limits: UsageLimits;
  seatsAllowed: number | null;
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
