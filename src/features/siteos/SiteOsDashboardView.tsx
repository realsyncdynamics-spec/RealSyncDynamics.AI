import { SiteOsCustomerHome } from './SiteOsCustomerHome';

/**
 * Customer-facing SiteOS entry after Governance Launch checkout.
 * The customer experience is transformation-first; the enterprise Control Plane
 * remains separate at /app.
 */
export function SiteOsDashboardView() {
  return <SiteOsCustomerHome />;
}
