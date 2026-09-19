// Shared Stripe → public.subscriptions upsert.
// Used by stripe-webhook (event-driven) and stripe-checkout-verify (reconcile
// when webhook lags). Keep one write path so verify cannot invent a different
// plan_key / conflict target than the webhook.

import type Stripe from 'npm:stripe@16.12.0';
import type { SupabaseClient } from 'jsr:@supabase/supabase-js@2';
import { normalizePlanKey } from './pricing.generated.ts';

/** Minimal admin surface needed for subscription upsert. */
export type SubscriptionSyncAdmin = {
  from(table: string): {
    select(columns?: string): {
      eq(col: string, val: unknown): {
        maybeSingle(): Promise<{ data: unknown; error: unknown }>;
      };
    };
    upsert(
      row: Record<string, unknown>,
      options?: Record<string, unknown>,
    ): Promise<{ data: unknown; error: unknown }>;
  };
};

/**
 * Plan line item among subscription items — skip known add-on prices.
 * Stripe does not guarantee items[0] is the plan.
 */
export function pickPlanItem(
  items: readonly Stripe.SubscriptionItem[],
  addonPriceIds: ReadonlySet<string>,
): Stripe.SubscriptionItem | undefined {
  return items.find((i) => !addonPriceIds.has(i.price?.id ?? '')) ?? items[0];
}

export async function loadAddonPriceIds(admin: SupabaseClient): Promise<Set<string>> {
  const ids = new Set<string>();
  const { data, error } = await admin
    .from('plan_addons')
    .select('stripe_price_id')
    .not('stripe_price_id', 'is', null);
  if (error) {
    console.warn(`[stripe-subscription-sync] plan_addons unreadable: ${error.message}`);
    return ids;
  }
  for (const row of (data ?? []) as { stripe_price_id: string | null }[]) {
    if (row.stripe_price_id) ids.add(row.stripe_price_id);
  }
  return ids;
}

/**
 * Resolve plan_key: price.metadata → products.default_for_plan_key → free_audit.
 * Never invent a paid plan when lookup fails.
 */
export async function resolvePlanKeyFromItem(
  admin: SubscriptionSyncAdmin,
  item: Stripe.SubscriptionItem | undefined,
): Promise<string> {
  const fromMeta = normalizePlanKey(item?.price?.metadata?.plan_key);
  if (fromMeta) return fromMeta;

  const priceId = item?.price?.id;
  if (priceId) {
    const { data } = await admin
      .from('products')
      .select('default_for_plan_key')
      .eq('stripe_price_id', priceId)
      .maybeSingle();
    const fromProducts = normalizePlanKey(
      (data as { default_for_plan_key?: string } | null)?.default_for_plan_key,
    );
    if (fromProducts) return fromProducts;
  }

  return 'free_audit';
}

/**
 * Upsert Stripe subscription into public.subscriptions (onConflict tenant_id).
 * Returns false when a terminal event for a superseded subscription is ignored.
 */
export async function syncSubscriptionFromStripe(
  admin: SubscriptionSyncAdmin,
  sub: Stripe.Subscription,
  addonPriceIds: ReadonlySet<string> = new Set(),
): Promise<boolean> {
  const tenantId =
    (sub.metadata && sub.metadata.tenant_id) ||
    (typeof sub.customer === 'object' ? sub.customer?.metadata?.tenant_id : undefined);

  if (!tenantId) {
    throw new Error(
      `subscription ${sub.id} has no metadata.tenant_id (set it on Customer or Subscription)`,
    );
  }

  const item = pickPlanItem(sub.items.data, addonPriceIds);
  const planKey = await resolvePlanKeyFromItem(admin, item);

  let pastDueSince: string | null = null;
  if (sub.status === 'past_due') {
    const { data: vorhanden } = await admin
      .from('subscriptions')
      .select('past_due_since')
      .eq('stripe_subscription_id', sub.id)
      .maybeSingle();
    pastDueSince =
      (vorhanden as { past_due_since?: string | null } | null)?.past_due_since ??
      new Date().toISOString();
  }

  const row = {
    tenant_id: tenantId,
    stripe_customer_id: typeof sub.customer === 'string' ? sub.customer : sub.customer.id,
    stripe_subscription_id: sub.id,
    stripe_product_id:
      typeof item?.price?.product === 'string'
        ? item.price.product
        : item?.price?.product?.id ?? null,
    stripe_price_id: item?.price?.id ?? null,
    plan_key: planKey,
    billing_interval: item?.price?.recurring?.interval ?? 'month',
    status: sub.status,
    quantity: item?.quantity ?? 1,
    cancel_at_period_end: sub.cancel_at_period_end,
    current_period_end: sub.current_period_end
      ? new Date(sub.current_period_end * 1000).toISOString()
      : null,
    unit_amount_cents: item?.price?.unit_amount ?? null,
    currency: item?.price?.currency ?? null,
    trial_start: sub.trial_start ? new Date(sub.trial_start * 1000).toISOString() : null,
    trial_end: sub.trial_end ? new Date(sub.trial_end * 1000).toISOString() : null,
    canceled_at: sub.canceled_at ? new Date(sub.canceled_at * 1000).toISOString() : null,
    started_at: sub.start_date ? new Date(sub.start_date * 1000).toISOString() : null,
    past_due_since: pastDueSince,
  };

  const TERMINALE_STATUS = ['canceled', 'incomplete_expired'];
  if (TERMINALE_STATUS.includes(sub.status)) {
    const { data: aktuell } = await admin
      .from('subscriptions')
      .select('stripe_subscription_id')
      .eq('tenant_id', tenantId)
      .maybeSingle();
    const gespeicherte = (aktuell as { stripe_subscription_id?: string | null } | null)
      ?.stripe_subscription_id;
    if (gespeicherte && gespeicherte !== sub.id) {
      console.log(
        `[stripe-subscription-sync] ${sub.status} for ${sub.id} ignored — tenant ${tenantId} ` +
          `already holds ${gespeicherte}. Stale event for superseded subscription.`,
      );
      return false;
    }
  }

  const { error } = await admin.from('subscriptions').upsert(row, { onConflict: 'tenant_id' });
  if (error) throw error;
  return true;
}
