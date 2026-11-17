import type { ProductLandingContent } from '../types';
import { APP_BUILDER_CONTENT } from './appBuilder';
import { BROWSER_AGENT_CONTENT } from './browserAgent';
import { GOVERNANCE_OS_CONTENT } from './governanceOs';
import { KI_BOTS_CONTENT } from './kiBots';
import { OPTIMIZER_CONTENT } from './optimizer';

export type ProductSlug = ProductLandingContent['slug'];

/** Reihenfolge = Reihenfolge in der Produktnavigation. */
export const PRODUCT_LANDINGS: readonly ProductLandingContent[] = [
  APP_BUILDER_CONTENT,
  KI_BOTS_CONTENT,
  OPTIMIZER_CONTENT,
  GOVERNANCE_OS_CONTENT,
  BROWSER_AGENT_CONTENT,
];

export function productLandingBySlug(slug: ProductSlug): ProductLandingContent {
  const found = PRODUCT_LANDINGS.find((p) => p.slug === slug);
  if (!found) throw new Error(`[product-landing] unbekannter Slug: ${slug}`);
  return found;
}

export const productLandingPath = (slug: ProductSlug): string => `/produkte/${slug}`;
