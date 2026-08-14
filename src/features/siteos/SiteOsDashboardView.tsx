import { WebsiteTransformationDashboard } from './WebsiteTransformationDashboard';

/**
 * Customer-facing SiteOS entry after Governance Launch checkout.
 *
 * The primary product value is the new landing page. Advanced governance
 * tooling remains available from the Control Plane; this route is deliberately
 * project-centric and shows the transformation, audit basis and publish gate.
 */
export function SiteOsDashboardView() {
  return <WebsiteTransformationDashboard />;
}
