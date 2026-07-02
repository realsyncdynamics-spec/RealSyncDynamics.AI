/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Paket-Definitionen für den Cloud Code Optimizer.
 *
 * WICHTIG (Phase 3): Die Optimizer-Karten sind eine Marketing-Sicht auf
 * die **realen** SaaS-Tiers aus `src/config/pricing.ts`. Preise und
 * Checkout laufen ausschließlich über die kanonische Plan-/Stripe-Strecke —
 * jede Optimizer-Kachel ist über `planKey` fest mit einem realen Tier
 * verknüpft, damit an der Kasse kein anderer Preis erscheint als auf der
 * Karte.
 */

import { tierById, type TierId } from '../../config/pricing';

export type OptimizerTierId = 'gratis' | 'bronze' | 'silber' | 'gold' | 'platin' | 'diamant';

export interface OptimizerTier {
  id: OptimizerTierId;
  name: string;
  /** Realer SaaS-Tier, der diese Marketing-Kachel abbildet (Preis-Quelle). */
  planKey: TierId;
  tagline: string;
  /** Was der Optimizer in diesem Tier für dich tut. */
  optimizerFeature: string;
  highlight?: boolean;
}

// Optimizer-Kachel → realer Tier. Aufsteigend; jede Kachel erbt Preis und
// Feature-Zugriff vom verknüpften realen Plan.
export const OPTIMIZER_TIERS: OptimizerTier[] = [
  { id: 'gratis', name: 'Gratis', planKey: 'free', tagline: 'Erster Scan & Übersicht', optimizerFeature: 'Score + Kategorie-Übersicht, manuelles Fixen' },
  { id: 'bronze', name: 'Bronze', planKey: 'starter', tagline: 'Vollständiger Bericht', optimizerFeature: 'Alle Befunde im Detail + monatlicher Scan' },
  { id: 'silber', name: 'Silber', planKey: 'growth', tagline: 'Fix-Snippets & Monitoring', optimizerFeature: 'Fix-Snippets, tägliches Monitoring, Drift-Erkennung', highlight: true },
  { id: 'gold', name: 'Gold', planKey: 'agency', tagline: 'Multi-Domain & White-Label', optimizerFeature: 'Bis zu 10 Domains, White-Label-Reports, API/Webhooks' },
  { id: 'platin', name: 'Platin', planKey: 'scale', tagline: 'Skalierung', optimizerFeature: '50 Mandanten, eigene Subdomain, White-Label-Dashboard' },
  { id: 'diamant', name: 'Diamant', planKey: 'enterprise', tagline: 'Enterprise-Umfang', optimizerFeature: 'Dedizierter Runtime, SLA, Evidence-Vault, eigene Policies' },
];

/** Realer Tier, der den vollständigen Bericht erstmals freischaltet. */
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

/**
 * Self-Service-Checkout ist nur für starter/growth/agency verfügbar
 * (siehe VALID_PLAN_KEYS in features/billing/CheckoutPage). free braucht
 * keinen Checkout; scale/enterprise laufen über den Kontakt-/Sales-Pfad.
 */
const SELF_SERVE_PLAN_KEYS = new Set<TierId>(['starter', 'growth', 'agency']);

export function isSelfServeCheckout(planKey: TierId): boolean {
  return SELF_SERVE_PLAN_KEYS.has(planKey);
}

export function optimizerTierById(id: OptimizerTierId): OptimizerTier | undefined {
  return OPTIMIZER_TIERS.find((t) => t.id === id);
}

/** Realer Monatspreis der Kachel, aus der kanonischen Pricing-Config. */
export function realPriceEur(tier: OptimizerTier): number {
  return tierById(tier.planKey)?.priceEur ?? 0;
}

/** Preis-Anzeige aus der realen Config: "Kostenlos" / "Individuell" / "€79 / Monat". */
export function formatTierPrice(tier: OptimizerTier): string {
  if (tier.planKey === 'free') return 'Kostenlos';
  const price = realPriceEur(tier);
  // priceEur=0 bei Enterprise bedeutet „individuell", nicht kostenlos.
  return price === 0 ? 'Individuell' : `€${price} / Monat`;
}
