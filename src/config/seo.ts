/**
 * Per-Route SEO-Config — Single Source of Truth fuer <title>, <meta description>,
 * <link rel=canonical>, OpenGraph-Tags und route-spezifisches JSON-LD.
 *
 * Homepage updated 2026-11-06 for KMU positioning.
 */

export interface SEOConfig {
  title: string;
  description: string;
  canonical?: string;
  ogTitle?: string;
  ogDescription?: string;
  ogImage?: string;
  ogType?: 'website' | 'article' | 'product';
  twitterTitle?: string;
  twitterDescription?: string;
  noIndex?: boolean;
  jsonLd?: Record<string, unknown> | Record<string, unknown>[];
}

const SITE_URL = 'https://realsyncdynamicsai.de';

export const SEO_CONFIG: Record<string, SEOConfig> = {
  '/': {
    title: 'Governance OS für KMU – DSGVO, EU AI Act & Website | RealSync Dynamics AI',
    description: 'Governance OS, Voice Agent und Landingpage Builder für den Mittelstand. KI sicher nach DSGVO und EU AI Act, Website fertig, Daten in der EU. Made in Thüringen. Kostenloser Scan.',
    canonical: `${SITE_URL}/`,
    ogTitle: 'Governance OS für KMU – DSGVO & EU AI Act',
    ogDescription: 'KI für Handwerk, Praxis, Kanzlei und Handel: sicher nach DSGVO und EU AI Act, Website fertig. Daten in der EU, Made in Thüringen.',
  },
  // ... remaining routes unchanged; full file should preserve all other entries
};

export function getSeoForPath(pathname: string): SEOConfig {
  const path = pathname === '/' ? '/' : pathname.replace(/\/$/, '');
  return SEO_CONFIG[path] ?? { title: 'RealSync Dynamics AI', description: 'EU-souveräne KI-Governance.' };
}
