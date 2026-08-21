/**
 * Single source of truth for competitor pricing and transfer posture.
 * Keep marketing-facing competitor values in one place to prevent drift.
 */
export const COMPETITOR_PRICING = {
  OneTrust: {
    pricing: '~1.500–25.000+ €/Jahr',
    pricingNote: 'Enterprise-only, Quote-on-Request',
    origin: 'US',
    euHosted: 'partial',
    transfer: 'drittland-garantien',
  },
  Usercentrics: {
    pricing: '~150 €/M',
    pricingNote: 'Ab-Preis / marktübliche Orientierung',
    origin: 'EU',
    euHosted: 'yes',
    transfer: 'eu-intern',
  },
  Cookiebot: {
    pricing: '~10 €/M',
    pricingNote: 'Ab-Preis / marktübliche Orientierung',
    origin: 'EU',
    euHosted: 'partial',
    transfer: 'drittland-garantien',
  },
  TrustArc: {
    pricing: '~400 €/M',
    pricingNote: 'Ab-Preis / marktübliche Orientierung',
    origin: 'US',
    euHosted: 'partial',
    transfer: 'drittland-garantien',
  },
  DataGuard: {
    pricing: '~300 €/M',
    pricingNote: 'Ab-Preis / marktübliche Orientierung',
    origin: 'EU',
    euHosted: 'yes',
    transfer: 'eu-intern',
  },
  BorlabsCookie: {
    pricing: '79 €/Jahr (WP-only)',
    pricingNote: 'WordPress-only',
    origin: 'EU',
    euHosted: 'yes',
    transfer: 'eu-intern',
  },
} as const;

export type CompetitorKey = keyof typeof COMPETITOR_PRICING;
export type CompetitorData = (typeof COMPETITOR_PRICING)[CompetitorKey];
