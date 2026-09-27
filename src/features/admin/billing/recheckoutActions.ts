/**
 * Re-Checkout CTAs — display/redirect only.
 * - portal → POST /functions/v1/stripe-portal (existing)
 * - new_checkout → Frontend redirect to /checkout/:planKey
 * Optional post-return verify is already handled by /checkout/success → stripe-checkout-verify.
 */
import { openCustomerPortal } from '../../../lib/stripe';

export async function openPortalForTenant(
  tenantId: string,
  returnUrl?: string,
): Promise<{ ok: true; url: string } | { ok: false; message: string }> {
  try {
    const url = await openCustomerPortal(
      tenantId,
      returnUrl ?? (typeof window !== 'undefined' ? window.location.href : undefined),
    );
    if (!url) return { ok: false, message: 'Portal-URL fehlt in der Antwort.' };
    return { ok: true, url };
  } catch (e) {
    return {
      ok: false,
      message: e instanceof Error ? e.message : 'Stripe-Portal konnte nicht geöffnet werden.',
    };
  }
}

/** Frontend-only redirect into the existing Checkout route. */
export function checkoutPathForPlan(planKey: string | null | undefined): string {
  const key = (planKey ?? 'starter').toLowerCase();
  return `/checkout/${encodeURIComponent(key)}`;
}
