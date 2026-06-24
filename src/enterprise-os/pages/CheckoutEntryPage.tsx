import React from 'react';
import { Navigate, useSearchParams, useParams } from 'react-router-dom';
import { CheckoutPageWrapper } from './CheckoutPageWrapper';

/**
 * /os/checkout oder /checkout/:planKey mit Enterprise-OS Design
 *
 * Routing:
 *   1. /os/checkout?plan=starter  → Shows CheckoutPageWrapper (new design)
 *   2. /checkout/starter (direct)  → Shows CheckoutPageWrapper (new design)
 *   3. enterprise oder invalid     → Redirect zu /contact-sales oder /os/pricing
 */
const VALID_PLAN_KEYS = new Set(['starter', 'growth', 'agency']);

export function CheckoutEntryPage() {
  const [params] = useSearchParams();
  const { planKey } = useParams<{ planKey?: string }>();

  // Support both /os/checkout?plan=X and /checkout/:planKey
  const plan = planKey || params.get('plan') || '';

  if (plan === 'enterprise') {
    return <Navigate to="/contact-sales?intent=enterprise&source=os-checkout-redirect" replace />;
  }
  if (VALID_PLAN_KEYS.has(plan)) {
    return <CheckoutPageWrapper />;
  }
  return <Navigate to="/os/pricing" replace />;
}
