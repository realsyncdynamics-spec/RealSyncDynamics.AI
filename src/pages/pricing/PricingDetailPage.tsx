import { useParams, Navigate } from 'react-router-dom';
import { PlanDetailPage } from '../../components/pricing/PlanDetailPage';
import { ALL_PLAN_SLUGS } from '../../content/pricingContent';

// Die Pricing-Karten (src/config/pricing.ts) verlinken ihre Info-Buttons auf
// /pricing/<tier.id>. Die Tier-Id des Free-Tiers ist 'free', die Content-
// Detailseite heißt aber 'free-audit' — ohne Alias bounced der Info-Button
// des Free-Pakets zurück auf /pricing.
const SLUG_ALIASES: Record<string, string> = {
  free: 'free-audit',
  free_audit: 'free-audit',
};

export function PricingDetailPageWrapper() {
  const { slug } = useParams<{ slug: string }>();

  const alias = slug ? SLUG_ALIASES[slug] : undefined;
  if (alias) {
    return <Navigate to={`/pricing/${alias}`} replace />;
  }

  if (!slug || !ALL_PLAN_SLUGS.includes(slug)) {
    return <Navigate to="/pricing" replace />;
  }

  return <PlanDetailPage planSlug={slug} />;
}
