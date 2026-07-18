/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect } from 'vitest';

import {
  OPTIMIZER_TIERS, tierRank, isPaidTier, tierCovers, formatTierPrice, isSelfServeCheckout,
  MIN_TIER_FOR_FULL_REPORT,
} from '../../src/lib/optimizer/tiers';

describe('OPTIMIZER_TIERS', () => {
  it('enthält alle sechs Tiers in fester Reihenfolge', () => {
    expect(OPTIMIZER_TIERS.map((t) => t.id)).toEqual([
      'gratis', 'bronze', 'silber', 'gold', 'platin', 'diamant',
    ]);
  });
  it('ist mit realen Plan-Keys aufsteigend verknüpft', () => {
    expect(OPTIMIZER_TIERS.map((t) => t.planKey)).toEqual([
      'free', 'starter', 'growth', 'agency', 'scale', 'enterprise',
    ]);
  });
});

describe('isSelfServeCheckout', () => {
  it('nur starter/growth/agency sind self-service', () => {
    expect(isSelfServeCheckout('starter')).toBe(true);
    expect(isSelfServeCheckout('growth')).toBe(true);
    expect(isSelfServeCheckout('agency')).toBe(true);
    expect(isSelfServeCheckout('free')).toBe(false);
    expect(isSelfServeCheckout('scale')).toBe(false);
    expect(isSelfServeCheckout('enterprise')).toBe(false);
  });
});

describe('tierRank / isPaidTier', () => {
  it('gratis ist rank 0 und nicht bezahlt', () => {
    expect(tierRank('gratis')).toBe(0);
    expect(isPaidTier('gratis')).toBe(false);
  });
  it('bronze und höher sind bezahlt', () => {
    expect(isPaidTier('bronze')).toBe(true);
    expect(isPaidTier('diamant')).toBe(true);
    expect(tierRank('diamant')).toBeGreaterThan(tierRank('gold'));
  });
});

describe('tierCovers', () => {
  it('deckt gleichen oder höheren Tier ab', () => {
    expect(tierCovers('silber', MIN_TIER_FOR_FULL_REPORT)).toBe(true);
    expect(tierCovers('bronze', 'bronze')).toBe(true);
    expect(tierCovers('gratis', 'bronze')).toBe(false);
  });
});

describe('formatTierPrice', () => {
  it('zeigt „Kostenlos" für Gratis (free)', () => {
    const gratis = OPTIMIZER_TIERS[0];
    expect(formatTierPrice(gratis)).toBe('Kostenlos');
  });
  it('nutzt den realen Preis aus der Pricing-Config', () => {
    const bronze = OPTIMIZER_TIERS.find((t) => t.id === 'bronze')!; // → starter €79
    expect(formatTierPrice(bronze)).toBe('€79 / Monat');
  });
  it('zeigt den realen Enterprise-Preis (seit Pricing-Rebalance 2026-07 kein „Individuell" mehr)', () => {
    const diamant = OPTIMIZER_TIERS.find((t) => t.id === 'diamant')!; // → enterprise 1.249 €
    expect(formatTierPrice(diamant)).toBe('€1249 / Monat');
  });
});
