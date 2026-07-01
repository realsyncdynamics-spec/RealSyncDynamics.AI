/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect } from 'vitest';

import {
  OPTIMIZER_TIERS, tierRank, isPaidTier, tierCovers, formatTierPrice,
  MIN_TIER_FOR_FULL_REPORT,
} from '../../src/lib/optimizer/tiers';

describe('OPTIMIZER_TIERS', () => {
  it('enthält alle sechs Tiers in aufsteigender Preisreihenfolge', () => {
    expect(OPTIMIZER_TIERS.map((t) => t.id)).toEqual([
      'gratis', 'bronze', 'silber', 'gold', 'platin', 'diamant',
    ]);
    const prices = OPTIMIZER_TIERS.map((t) => t.priceMonthly);
    const sorted = [...prices].sort((a, b) => a - b);
    expect(prices).toEqual(sorted);
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
  it('zeigt „Kostenlos" für Gratis', () => {
    const gratis = OPTIMIZER_TIERS[0];
    expect(formatTierPrice(gratis)).toBe('Kostenlos');
  });
  it('formatiert Monatspreis', () => {
    const silber = OPTIMIZER_TIERS.find((t) => t.id === 'silber')!;
    expect(formatTierPrice(silber)).toBe('€49 / Monat');
  });
});
