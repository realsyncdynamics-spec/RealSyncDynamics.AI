// Loads everything needed to resolve entitlements for a tenant from Supabase
// and runs resolveEntitlements(). Pure read operations, RLS-friendly.

import { resolveEntitlements } from '../billing/entitlements';
import type {
  TenantContext, SubscriptionSnapshot, CurrentUsage, EntitlementDecision, PlanKey, TenantRole,
} from '../billing/types';
import { getSupabase } from '../../lib/supabase';

export interface TenantSummary {
  tenantId: string;
  name: string;
  isPublicSector: boolean;
  role: TenantRole;
}

/** Returns all tenants the current user is a member of, with their role. */
export async function listMyTenants(): Promise<TenantSummary[]> {
  const sb = getSupabase();
  const { data, error } = await sb
    .from('memberships')
    .select('role,tenant:tenants(id,name,is_public_sector)')
    .order('created_at', { ascending: true });
  if (error) throw error;
  return (data ?? [])
    // deno-lint-ignore no-explicit-any
    .map((row: any) => ({
      tenantId: row.tenant?.id,
      name: row.tenant?.name ?? '(unbenannt)',
      isPublicSector: !!row.tenant?.is_public_sector,
      role: row.role as TenantRole,
    }))
    .filter((t) => t.tenantId);
}

/** Loads tenant context, subscription and usage, then resolves entitlements. */
export async function loadEntitlements(tenantId: string): Promise<EntitlementDecision> {
  const sb = getSupabase();

  const [tenantResp, subResp, usageResp, memberCountResp] = await Promise.all([
    sb.from('tenants').select('id,is_public_sector').eq('id', tenantId).maybeSingle(),
    sb.from('subscriptions').select('*').eq('tenant_id', tenantId)
      .order('updated_at', { ascending: false }).limit(1).maybeSingle(),
    sb.from('usage_counters').select('*').eq('tenant_id', tenantId)
      .order('month_bucket', { ascending: false }).limit(1).maybeSingle(),
    sb.from('memberships').select('id', { count: 'exact', head: true }).eq('tenant_id', tenantId),
  ]);

  if (tenantResp.error) throw tenantResp.error;
  if (subResp.error)    throw subResp.error;
  if (usageResp.error)  throw usageResp.error;

  const tenantRow = tenantResp.data;
  const subRow = subResp.data;
  const usageRow = usageResp.data;

  const planKey: PlanKey = (subRow?.plan_key as PlanKey) ?? 'free';

  const tenant: TenantContext = {
    tenantId,
    planKey,
    roles: [],
    memberCount: memberCountResp.count ?? 1,
    isPublicSector: !!tenantRow?.is_public_sector,
  };

  const sub: SubscriptionSnapshot = subRow
    ? {
        customerId: subRow.stripe_customer_id,
        subscriptionId: subRow.stripe_subscription_id,
        productId: subRow.stripe_product_id ?? null,
        priceId: subRow.stripe_price_id ?? null,
        planKey,
        interval: (subRow.billing_interval ?? 'month') as 'month' | 'year' | 'custom',
        status: subRow.status,
        quantity: subRow.quantity ?? 0,
        cancelAtPeriodEnd: !!subRow.cancel_at_period_end,
        currentPeriodEnd: subRow.current_period_end,
        addOns: [],
      }
    : freeSnapshot();

  const usage: CurrentUsage = {
    activeAssets: usageRow?.active_assets ?? 0,
    monthlyRegistrations: usageRow?.monthly_registrations ?? 0,
    apiCallsMonthly: usageRow?.api_calls_monthly ?? 0,
    bulkJobsMonthly: usageRow?.bulk_jobs_monthly ?? 0,
    complianceExportsMonthly: usageRow?.compliance_exports_monthly ?? 0,
  };

  return resolveEntitlements(sub, tenant, usage);
}

function freeSnapshot(): SubscriptionSnapshot {
  return {
    customerId: '',
    subscriptionId: null,
    productId: null,
    priceId: null,
    planKey: 'free',
    interval: 'month',
    status: 'inactive',
    quantity: 0,
    cancelAtPeriodEnd: false,
    currentPeriodEnd: null,
    addOns: [],
  };
}
