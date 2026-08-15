import { SiteOsCustomerCommandCenter } from './SiteOsCustomerCommandCenter';

/**
 * Customer-facing SiteOS entry after Governance Launch checkout.
 *
 * The customer sees the transformation first: the generated landing page,
 * real pipeline state, findings, governance gate and publish action. The
 * enterprise Control Plane remains separate at /app.
 */
export function SiteOsDashboardView() {
  return <SiteOsCustomerCommandCenter />;
}
