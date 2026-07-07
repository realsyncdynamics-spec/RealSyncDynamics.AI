import React from 'react';
import { Navigate, useSearchParams } from 'react-router-dom';

/**
 * /os/checkout Entry Point mit Plan-Validierung
 *
 * Routing:
 *   1. /os/checkout?plan=starter  → Redirect zu /checkout/starter (canonical route)
 *   2. enterprise oder invalid     → Redirect zu /contact-sales oder /os/pricing
 *
 * Canonical route /checkout/:planKey wird direkt durch CheckoutPageWrapper angezeigt.
 * Diese Entry Page dient nur zur Query-Parameter-Normalisierung.
 */
const VALID_PLAN_KEYS = new Set(['starter', 'growth', 'agency', 'scale', 'starter_yearly', 'growth_yearly', 'agency_yearly', 'scale_yearly']);

export function CheckoutEntryPage() {
  const [params] = useSearchParams();
  const plan = params.get('plan') || '';

  if (plan === 'enterprise') {
    return <Navigate to="/contact-sales?intent=enterprise&source=os-checkout-redirect" replace />;
  }
  if (VALID_PLAN_KEYS.has(plan)) {
    return <Navigate to={`/checkout/${plan}`} replace />;
  }
  return <Navigate to="/os/pricing" replace />;
}
