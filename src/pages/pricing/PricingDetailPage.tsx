import { useParams, Navigate } from 'react-router-dom';
import { PlanDetailPage } from '../../components/pricing/PlanDetailPage';
import { ALL_PLAN_SLUGS } from '../../content/pricingContent';

export function PricingDetailPageWrapper() {
  const { slug } = useParams<{ slug: string }>();

  if (!slug || !ALL_PLAN_SLUGS.includes(slug)) {
    return <Navigate to="/pricing" replace />;
  }

  return <PlanDetailPage planSlug={slug} />;
}
