import { getSupabase } from '../../lib/supabase';
import { normalizePlanKey, planByKey, type PlanKey } from '@/shared/pricing';
import { IS_STRIPE_TEST_MODE } from '../../config/stripeMode';

export type { PlanKey };

export interface CheckoutResult {
  ok: boolean;
  url?: string;
  session_id?: string;
  error?: { code: string; message: string };
  /** Vom Server gemeldeter Stripe-Modus (supabase/functions/_shared/stripe-mode.ts). */
  stripe_mode?: 'test' | 'live';
}

/**
 * Die Seite verspricht im Testmodus „es wird nichts belastet". Meldet der
 * Server trotzdem eine Live-Session (STRIPE_MODE=live, VITE_STRIPE_MODE nicht),
 * wird nicht zu Stripe weitergeleitet.
 */
function guardStripeMode(result: CheckoutResult): CheckoutResult {
  if (IS_STRIPE_TEST_MODE && result?.stripe_mode === 'live') {
    return {
      ok: false,
      error: {
        code: 'STRIPE_MODE_MISMATCH',
        message: 'Zahlungsmodus uneinheitlich konfiguriert – Checkout abgebrochen, es wurde nichts belastet.',
      },
    };
  }
  return result;
}

async function readCheckoutError(error: unknown): Promise<CheckoutResult> {
  const ctx = (error as { context?: Response })?.context;
  if (ctx && typeof ctx.json === 'function') {
    try {
      const body = (await ctx.json()) as CheckoutResult;
      if (body?.error?.code) return { ok: false, error: body.error };
    } catch { /* fall through */ }
  }
  return {
    ok: false,
    error: {
      code: 'NETWORK',
      message: error instanceof Error ? error.message : 'Checkout konnte nicht vorbereitet werden.',
    },
  };
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
  return guardStripeMode(data as CheckoutResult);
}

/**
 * Paid handoff after the SiteOS redesign preview.
 * Uses the canonical production website-rebuild checkout. The server resolves
 * the Governance Launch product, enforces tenant membership, and verifies
 * the one-time Stripe Price before creating the Checkout Session.
 */
export async function createSiteOsCheckoutSession(args: {
  tenantId: string;
  sourceUrl: string;
  siteSlug?: string;
  projectName?: string;
}): Promise<CheckoutResult> {
  const { data, error } = await getSupabase().functions.invoke('checkout-website-rebuild', {
    body: {
      tenant_id: args.tenantId,
      source_url: args.sourceUrl,
      site_slug: args.siteSlug,
      project_name: args.projectName,
      tier: 'governance_launch',
      redesign: true,
      return_url: window.location.origin,
    },
  });
  if (error) return readCheckoutError(error);
  return guardStripeMode(data as CheckoutResult);
}
