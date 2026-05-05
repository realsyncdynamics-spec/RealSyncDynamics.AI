// In-process usage helpers for edge functions.
//
// Two layers:
//
// 1. Read current month total:           getCurrentTotal(admin, tenantId, key)
// 2. Check + record in one go:           consumeUsage(admin, tenantId, key, delta)
//
// `consumeUsage` is the canonical pattern: it loads the per-tenant entitlement
// limit (from product_entitlements via tenant_entitlements), checks any global
// hard cap from usage_limits_config, then inserts a usage_events row. The DB
// trigger updates usage_totals atomically.
//
// Failure semantics:
//   QUOTA_EXCEEDED  the new total would exceed the per-plan or global hard limit
//   INTERNAL        DB error
//
// The check-then-insert sequence is intentionally cheap and explicit. It is
// race-prone under heavy concurrency; for hard isolation we'd need a SELECT ...
// FOR UPDATE on usage_totals or a SERIALIZABLE transaction. That's an opt-in
// follow-up; the v1 contract is "one increment per request, the trigger keeps
// totals correct, brief over-shoot under contention is acceptable for soft
// quotas".

import type { SupabaseClient } from 'jsr:@supabase/supabase-js@2';

export class UsageError extends Error {
  code: 'QUOTA_EXCEEDED' | 'INTERNAL' | 'NOT_FOUND' = 'QUOTA_EXCEEDED';
  details?: Record<string, unknown>;
  constructor(message: string, code: UsageError['code'] = 'QUOTA_EXCEEDED', details?: Record<string, unknown>) {
    super(message); this.code = code; this.details = details;
  }
}

export interface UsageSnapshot {
  total: number;
  hardLimit: number | null;     // -1 = unlimited, null = no cap
  softLimit: number | null;
  billingMode: 'included' | 'metered' | 'overage' | 'none';
  warning: boolean;             // true if total >= softLimit
}

const periodMonth = (d = new Date()): string =>
  `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-01`;

export async function getCurrentTotal(
  admin: SupabaseClient,
  tenantId: string,
  entitlementKey: string,
): Promise<number> {
  const { data, error } = await admin
    .from('usage_totals')
    .select('total')
    .eq('tenant_id', tenantId)
    .eq('entitlement_key', entitlementKey)
    .eq('period_month', periodMonth())
    .maybeSingle();
  if (error) throw new UsageError(error.message, 'INTERNAL');
  return data?.total ?? 0;
}

interface PlanLimitRow { value: number }
interface ConfigRow { hard_limit: number | null; soft_limit: number | null; billing_mode: UsageSnapshot['billingMode'] }

async function loadLimits(
  admin: SupabaseClient,
  tenantId: string,
  entitlementKey: string,
): Promise<{ planLimit: number | null; cfg: ConfigRow | null }> {
  const [planResp, cfgResp] = await Promise.all([
    admin.rpc('tenant_entitlements', { p_tenant_id: tenantId }),
    admin.from('usage_limits_config')
      .select('hard_limit, soft_limit, billing_mode')
      .eq('entitlement_key', entitlementKey)
      .maybeSingle(),
  ]);
  if (planResp.error) throw new UsageError(planResp.error.message, 'INTERNAL');
  if (cfgResp.error)  throw new UsageError(cfgResp.error.message, 'INTERNAL');

  const planRow = ((planResp.data ?? []) as Array<{ key: string; value: number }>)
    .find((r) => r.key === entitlementKey) as PlanLimitRow | undefined;

  return {
    planLimit: planRow?.value ?? null,
    cfg: cfgResp.data as ConfigRow | null,
  };
}

/**
 * Record a usage delta without checking limits.
 *
 * Use this AFTER an external resource (LLM call, third-party API) has been
 * paid for, when refusing to log would silently lose the usage. The DB trigger
 * still keeps usage_totals correct; consumers can react to over-limit on the
 * next read.
 */
export async function recordUsage(
  admin: SupabaseClient,
  tenantId: string,
  entitlementKey: string,
  delta = 1,
  metadata: Record<string, unknown> = {},
): Promise<void> {
  if (delta === 0) return;
  const { error } = await admin.from('usage_events').insert({
    tenant_id: tenantId,
    entitlement_key: entitlementKey,
    delta,
    metadata,
  });
  if (error) throw new UsageError(error.message, 'INTERNAL');
}

export async function consumeUsage(
  admin: SupabaseClient,
  tenantId: string,
  entitlementKey: string,
  delta = 1,
  metadata: Record<string, unknown> = {},
): Promise<UsageSnapshot> {
  const [current, limits] = await Promise.all([
    getCurrentTotal(admin, tenantId, entitlementKey),
    loadLimits(admin, tenantId, entitlementKey),
  ]);

  const next = current + delta;

  // Per-plan limit (from product_entitlements). -1 = unlimited, 0 / missing = no quota.
  const planLimit = limits.planLimit;
  if (planLimit !== null && planLimit !== -1 && delta > 0 && next > planLimit) {
    throw new UsageError(
      `quota ${entitlementKey} exceeded for plan (${next} / ${planLimit})`,
      'QUOTA_EXCEEDED',
      { entitlementKey, current, requested: delta, limit: planLimit, source: 'plan' },
    );
  }

  // Global cap from usage_limits_config (orthogonal to plan).
  const hard = limits.cfg?.hard_limit ?? null;
  if (hard !== null && delta > 0 && next > hard) {
    throw new UsageError(
      `quota ${entitlementKey} exceeded global cap (${next} / ${hard})`,
      'QUOTA_EXCEEDED',
      { entitlementKey, current, requested: delta, limit: hard, source: 'global' },
    );
  }

  // Insert event — trigger keeps usage_totals in sync.
  const { error: insertErr } = await admin.from('usage_events').insert({
    tenant_id: tenantId,
    entitlement_key: entitlementKey,
    delta,
    metadata,
  });
  if (insertErr) throw new UsageError(insertErr.message, 'INTERNAL');

  const soft = limits.cfg?.soft_limit ?? null;
  return {
    total: next,
    hardLimit: hard ?? planLimit ?? null,
    softLimit: soft,
    billingMode: limits.cfg?.billing_mode ?? 'included',
    warning: soft !== null && next >= soft,
  };
}
