import { useParams, Navigate } from 'react-router-dom';
import { PlanDetailPage } from '../../components/pricing/PlanDetailPage';
import { planDetailSlugFor } from '../../content/pricingContent';

// Die Pricing-Karten (src/config/pricing.ts) verlinken ihre Info-Buttons auf
// /pricing/<tier.id>. Die Zuordnung Tier-Id → Detailseiten-Slug (inklusive
// des Alias free → free-audit) liegt in pricingContent.ts, damit die Karten
// dieselbe Regel nutzen können, um den Button gar nicht erst anzubieten,
// wenn es keine Detailseite gibt.
export function PricingDetailPageWrapper() {
  const { slug } = useParams<{ slug: string }>();

  const target = slug ? planDetailSlugFor(slug) : null;
  if (!target) {
    return <Navigate to="/pricing" replace />;
  }
  if (target !== slug) {
    return <Navigate to={`/pricing/${target}`} replace />;
  }

  return <PlanDetailPage planSlug={target} />;
}
