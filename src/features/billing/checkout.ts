import { getSupabase } from '../../lib/supabase';

export type PlanKey = 'free' | 'bronze' | 'silver' | 'gold' | 'enterprise_public';

export interface CheckoutResult {
  ok: boolean;
  url?: string;
  session_id?: string;
  error?: { code: string; message: string };
}

/**
 * Asks the stripe-checkout edge function for a Stripe Checkout Session.
 * On success, navigate window.location to the returned URL.
 *
 * pilot=true enables the 14-day-trial mode used for post-demo conversion
 * (see marketing/demo-skript.md). Auto-detected from URL query `?pilot=true`
 * if not passed explicitly.
 */
export async function createCheckoutSession(
  tenantId: string,
  planKey: PlanKey,
  pilot?: boolean,
): Promise<CheckoutResult> {
  if (planKey === 'free') {
    return { ok: false, error: { code: 'BAD_REQUEST', message: 'Free plan needs no checkout' } };
  }
  const isPilot = pilot ?? new URLSearchParams(window.location.search).get('pilot') === 'true';
  const sb = getSupabase();
  const { data, error } = await sb.functions.invoke('stripe-checkout', {
    body: { tenant_id: tenantId, plan_key: planKey, return_url: window.location.origin, pilot: isPilot },
  });
  if (error) return { ok: false, error: { code: 'NETWORK', message: error.message } };
  return data as CheckoutResult;
}
