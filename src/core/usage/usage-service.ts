import { resolveEntitlements } from '../billing/entitlements';
import {
  TenantContext,
  SubscriptionSnapshot,
  CurrentUsage,
  EntitlementDecision,
  PlanKey,
  BillingInterval,
  SubscriptionStatus,
  TenantRole,
} from '../billing/types';
import { getSupabase, isSupabaseConfigured } from '../../lib/supabase';

const USAGE_KEYS_TO_FIELD: Record<string, keyof CurrentUsage> = {
  'limit.active_assets': 'activeAssets',
  'limit.monthly_registrations': 'monthlyRegistrations',
  'limit.api_calls_monthly': 'apiCallsMonthly',
  'limit.bulk_jobs_monthly': 'bulkJobsMonthly',
  'limit.compliance_exports_monthly': 'complianceExportsMonthly',
};

const ZERO_USAGE: CurrentUsage = {
  activeAssets: 0,
  monthlyRegistrations: 0,
  apiCallsMonthly: 0,
  bulkJobsMonthly: 0,
  complianceExportsMonthly: 0,
};

const FREE_PLAN: PlanKey = 'free';

const periodMonth = (d = new Date()): string =>
  `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-01`;

function freeSnapshot(customerId = ''): SubscriptionSnapshot {
  return {
    customerId,
    subscriptionId: null,
    productId: null,
    priceId: null,
    planKey: FREE_PLAN,
    interval: 'month',
    status: 'inactive',
    quantity: null,
    cancelAtPeriodEnd: false,
    currentPeriodEnd: null,
    addOns: [],
  };
}

/**
 * Resolve entitlements for a tenant by reading the live DB state under RLS.
 *
 * If Supabase is not configured (dev preview, smoke build), returns a free-tier
 * snapshot with zero usage so consumers can render without crashing instead of
 * silently falling back to an in-memory mock that would mis-report quotas.
 */
export async function getEntitlementsForTenant(tenantId: string): Promise<EntitlementDecision> {
  if (!isSupabaseConfigured()) {
    const tenant: TenantContext = {
      tenantId,
      planKey: FREE_PLAN,
      roles: [],
      memberCount: 0,
      isPublicSector: false,
    };
    return resolveEntitlements(freeSnapshot(), tenant, ZERO_USAGE);
  }

  const sb = getSupabase();

  const [tenantRow, subRow, memberCount, currentRole, usageRows] = await Promise.all([
    sb.from('tenants').select('id,is_public_sector').eq('id', tenantId).maybeSingle(),
    sb.from('subscriptions')
      .select('stripe_customer_id,stripe_subscription_id,stripe_product_id,stripe_price_id,plan_key,billing_interval,status,quantity,cancel_at_period_end,current_period_end')
      .eq('tenant_id', tenantId)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
    sb.from('memberships').select('user_id', { count: 'exact', head: true }).eq('tenant_id', tenantId),
    currentUserRole(tenantId),
    sb.from('usage_totals')
      .select('entitlement_key,total')
      .eq('tenant_id', tenantId)
      .eq('period_month', periodMonth()),
  ]);

  if (tenantRow.error) throw tenantRow.error;
  if (!tenantRow.data) throw new Error(`Tenant ${tenantId} not found or not accessible.`);
  if (subRow.error) throw subRow.error;
  if (memberCount.error) throw memberCount.error;
  if (usageRows.error) throw usageRows.error;

  const sub: SubscriptionSnapshot = subRow.data
    ? {
        customerId: subRow.data.stripe_customer_id ?? '',
        subscriptionId: subRow.data.stripe_subscription_id,
        productId: subRow.data.stripe_product_id,
        priceId: subRow.data.stripe_price_id,
        planKey: (subRow.data.plan_key ?? FREE_PLAN) as PlanKey,
        interval: (subRow.data.billing_interval ?? 'month') as BillingInterval,
        status: (subRow.data.status ?? 'inactive') as SubscriptionStatus,
        quantity: subRow.data.quantity,
        cancelAtPeriodEnd: !!subRow.data.cancel_at_period_end,
        currentPeriodEnd: subRow.data.current_period_end,
        addOns: [],
      }
    : freeSnapshot();

  const usage: CurrentUsage = { ...ZERO_USAGE };
  for (const row of usageRows.data ?? []) {
    const field = USAGE_KEYS_TO_FIELD[row.entitlement_key];
    if (field) usage[field] = row.total ?? 0;
  }

  const tenant: TenantContext = {
    tenantId,
    planKey: sub.planKey,
    roles: currentRole ? [currentRole] : [],
    memberCount: memberCount.count ?? 0,
    isPublicSector: !!tenantRow.data.is_public_sector,
  };

  return resolveEntitlements(sub, tenant, usage);
}

async function currentUserRole(tenantId: string): Promise<TenantRole | null> {
  const sb = getSupabase();
  const { data: sessionData } = await sb.auth.getSession();
  const userId = sessionData?.session?.user?.id;
  if (!userId) return null;
  const { data } = await sb
    .from('memberships')
    .select('role')
    .eq('tenant_id', tenantId)
    .eq('user_id', userId)
    .maybeSingle();
  return (data?.role ?? null) as TenantRole | null;
}
