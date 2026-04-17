import { resolveEntitlements } from '../billing/entitlements';
import { 
  OrganizationContext, 
  SubscriptionSnapshot, 
  CurrentUsage, 
  EntitlementDecision 
} from '../billing/types';

/**
 * Mock Service Layer for resolving entitlements.
 * In a real application, this would fetch data from Supabase/PostgreSQL.
 */
export async function getEntitlementsForOrganization(organizationId: string): Promise<EntitlementDecision> {
  // TODO: Fetch from database (e.g., Supabase)
  // const org = await db.organizations.findById(organizationId);
  // const sub = await db.subscriptions.findByOrgId(organizationId);
  // const usage = await db.usage_counters.getCurrentMonth(organizationId);
  
  // Mock Data for demonstration
  const mockOrg: OrganizationContext = {
    organizationId,
    planKey: 'silver',
    roles: ['admin'],
    memberCount: 2,
    isPublicSector: false,
  };

  const mockSub: SubscriptionSnapshot = {
    customerId: 'cus_mock123',
    subscriptionId: 'sub_mock123',
    productId: 'prod_silver',
    priceId: 'price_silver_monthly',
    planKey: 'silver',
    interval: 'month',
    status: 'active',
    quantity: 0,
    cancelAtPeriodEnd: false,
    currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    addOns: [],
  };

  const mockUsage: CurrentUsage = {
    activeAssets: 150,
    monthlyRegistrations: 20,
    apiCallsMonthly: 500,
    bulkJobsMonthly: 2,
    complianceExportsMonthly: 0,
  };

  // Resolve the single source of truth for entitlements
  return resolveEntitlements(mockSub, mockOrg, mockUsage);
}
