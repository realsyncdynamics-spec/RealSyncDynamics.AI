import { ProductLanding } from '../components/landing/product/ProductLanding';
import { productLandingBySlug, type ProductSlug } from '../components/landing/product/content';

/**
 * Produkt-Landings `/produkte/<slug>` (17.11.2026) — Inhalte aus dem
 * Claude-Design „Startseite v3 und Produkt-Landings“, an Pricing-SSoT und
 * Status-Registry angepasst. Die Startseite `/` bleibt unverändert.
 */
export function ProductLandingPage({ slug }: { slug: ProductSlug }) {
  return <ProductLanding content={productLandingBySlug(slug)} />;
}
