import { getSupabase } from '../../lib/supabase';
import { normalizePlanKey, planByKey, type PlanKey } from '@/shared/pricing';

export type { PlanKey };

export interface CheckoutResult {
  ok: boolean;
  url?: string;
  session_id?: string;
  error?: { code: string; message: string };
}

async function readCheckoutError(error: unknown): Promise<CheckoutResult> {
  const ctx = (error as { context?: Response })?.context;
  if (ctx && typeof ctx.json === 'function') {
    try {
      const body = (await ctx.json()) as CheckoutResult;
      if (body?.error?.code) return { ok: false, error: body.error };
    } catch { /* fall through */ }
  }
  return { ok: false, error: { code: 'NETWORK', message: error instanceof Error ? error.message : 'Checkout konnte nicht vorbereitet werden.' } };
}

/** Standard billing checkout using the canonical pricing SSoT. */
export async function createCheckoutSession(
  tenantId: string,
  planKey: string,
  pilot?: boolean,
): Promise<CheckoutResult> {
  const key = normalizePlanKey(planKey);
  const plan = key ? planByKey(key) : null;
  if (!key || !plan) return { ok: false, error: { code: 'UNKNOWN_PLAN', message: `Unbekannter Plan: ${planKey}` } };
  if (plan.purchaseMode === 'free') return { ok: false, error: { code: 'BAD_REQUEST', message: 'Free Audit braucht keinen Checkout' } };
  if (plan.purchaseMode === 'inquiry') return { ok: false, error: { code: 'INQUIRY_ONLY', message: `${plan.name} wird über /contact-sales abgeschlossen` } };
  const isPilot = pilot ?? new URLSearchParams(window.location.search).get('pilot') === 'true';
  const { data, error } = await getSupabase().functions.invoke('stripe-checkout', {
    body: { tenant_id: tenantId, plan_key: key, return_url: window.location.origin, pilot: isPilot },
  });
  if (error) return readCheckoutError(error);
  return data as CheckoutResult;
}

/**
 * Paid handoff after SiteOS preview/offer. This endpoint requires the current
 * user's tenant membership and uses the same products/Stripe/entitlement
 * model as the normal billing surface.
 */
export async function createSiteOsCheckoutSession(args: {
  tenantId: string;
  planKey: string;
  sourceUrl: string;
  siteSlug?: string;
  projectName?: string;
  redesign?: boolean;
}): Promise<CheckoutResult> {
  const key = normalizePlanKey(args.planKey) ?? args.planKey;
  if (!key) return { ok: false, error: { code: 'UNKNOWN_PLAN', message: `Unbekannter Plan: ${args.planKey}` } };
  const { data, error } = await getSupabase().functions.invoke('checkout-siteos-project', {
    body: {
      tenant_id: args.tenantId,
      plan_key: key,
      source_url: args.sourceUrl,
      site_slug: args.siteSlug,
      project_name: args.projectName,
      redesign: args.redesign ?? true,
      return_url: window.location.origin,
    },
  });
  if (error) return readCheckoutError(error);
  return data as CheckoutResult;
}
