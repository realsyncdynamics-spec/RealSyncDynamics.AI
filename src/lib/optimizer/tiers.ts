/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Paket-Definitionen für den Cloud Code Optimizer.
 *
 * Single Source of Truth für die Pricing-Seite (SEITE 6) und die
 * tier-abhängigen Aktionen im Dashboard (SEITE 7). Preise/Features
 * spiegeln die Direktive; die verbindliche Abrechnung läuft weiterhin
 * über die kanonische /pricing- bzw. Checkout-Strecke (Stripe).
 */

export type OptimizerTierId = 'gratis' | 'bronze' | 'silber' | 'gold' | 'platin' | 'diamant';

export interface OptimizerTier {
  id: OptimizerTierId;
  name: string;
  /** Monatspreis in EUR; 0 = kostenlos. */
  priceMonthly: number;
  tagline: string;
  /** Was der Optimizer in diesem Tier für dich tut. */
  optimizerFeature: string;
  highlight?: boolean;
}

export const OPTIMIZER_TIERS: OptimizerTier[] = [
  { id: 'gratis', name: 'Gratis', priceMonthly: 0, tagline: 'Erster Scan & Übersicht', optimizerFeature: 'Score + Kategorie-Übersicht, manuelles Fixen' },
  { id: 'bronze', name: 'Bronze', priceMonthly: 19, tagline: 'Vollständiger Bericht', optimizerFeature: 'Alle Befunde im Detail + geführte Fix-Schritte' },
  { id: 'silber', name: 'Silber', priceMonthly: 49, tagline: 'Auto-Fix', optimizerFeature: 'Automatisches Beheben ausgewählter Probleme', highlight: true },
  { id: 'gold', name: 'Gold', priceMonthly: 99, tagline: 'Monitoring', optimizerFeature: 'Kontinuierliches Monitoring deiner Domain' },
  { id: 'platin', name: 'Platin', priceMonthly: 199, tagline: 'Priorisiert', optimizerFeature: 'Priorisierte Analyse + regelmäßige Reports' },
  { id: 'diamant', name: 'Diamant', priceMonthly: 299, tagline: 'Enterprise-Umfang', optimizerFeature: 'Dedizierter Umfang + SLA' },
];

/** Ab welchem Tier gibt es den vollständigen Bericht? */
export const MIN_TIER_FOR_FULL_REPORT: OptimizerTierId = 'bronze';

const TIER_RANK: Record<OptimizerTierId, number> = {
  gratis: 0, bronze: 1, silber: 2, gold: 3, platin: 4, diamant: 5,
};

export function tierRank(id: OptimizerTierId): number {
  return TIER_RANK[id] ?? 0;
}

/** Bezahlter Tier (alles über Gratis). */
export function isPaidTier(id: OptimizerTierId): boolean {
  return tierRank(id) >= tierRank('bronze');
}

/** Deckt `tier` mindestens `min` ab? */
export function tierCovers(tier: OptimizerTierId, min: OptimizerTierId): boolean {
  return tierRank(tier) >= tierRank(min);
}

/** Preis-Anzeige, z. B. "€49 / Monat" oder "Kostenlos". */
export function formatTierPrice(tier: OptimizerTier): string {
  return tier.priceMonthly === 0 ? 'Kostenlos' : `€${tier.priceMonthly} / Monat`;
}
