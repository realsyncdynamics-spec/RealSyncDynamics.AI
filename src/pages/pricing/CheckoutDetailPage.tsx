import { useParams, Navigate } from 'react-router-dom';
import { CheckoutPlanPage } from '../../components/pricing/CheckoutPlanPage';
import { ALL_PLAN_SLUGS } from '../../content/pricingContent';

export function CheckoutDetailPageWrapper() {
  const { slug } = useParams<{ slug: string }>();

  if (!slug || !ALL_PLAN_SLUGS.includes(slug)) {
    return <Navigate to="/pricing" replace />;
  }

  return <CheckoutPlanPage planSlug={slug} />;
}
