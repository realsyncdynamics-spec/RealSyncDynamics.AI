import { useParams, Navigate } from 'react-router-dom';
import { FeatureDetailPage } from '../../components/pricing/FeatureDetailPage';
import { ALL_FEATURE_SLUGS } from '../../content/pricingContent';

export function FeatureDetailPageWrapper() {
  const { slug } = useParams<{ slug: string }>();

  if (!slug || !ALL_FEATURE_SLUGS.includes(slug)) {
    return <Navigate to="/pricing" replace />;
  }

  return <FeatureDetailPage featureSlug={slug} />;
}
