import React from 'react';
import { Navigate, useSearchParams } from 'react-router-dom';

/**
 * /os/checkout — leitet auf den echten Stripe-Checkout-Flow unter
 * /checkout/:planKey weiter (siehe src/features/billing/CheckoutPage.tsx).
 * Gültige Plan-Keys: starter, growth, agency. Enterprise & unbekannte
 * Plan-IDs landen auf /contact-sales.
 */
const VALID_PLAN_KEYS = new Set(['starter', 'growth', 'agency']);

export function CheckoutEntryPage() {
  const [params] = useSearchParams();
  const planId = params.get('plan') ?? '';

  if (planId === 'enterprise') {
    return <Navigate to="/contact-sales?intent=enterprise&source=os-checkout-redirect" replace />;
  }
  if (VALID_PLAN_KEYS.has(planId)) {
    return <Navigate to={`/checkout/${planId}`} replace />;
  }
  return <Navigate to="/os/pricing" replace />;
}
