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
      'free', 'starter', 'growth', 'agency', 'partner', 'enterprise',
    ]);
  });
});

describe('isSelfServeCheckout', () => {
  it('starter/growth/agency und seit 2026-10-24 enterprise sind self-service', () => {
    expect(isSelfServeCheckout('starter')).toBe(true);
    expect(isSelfServeCheckout('growth')).toBe(true);
    expect(isSelfServeCheckout('agency')).toBe(true);
    expect(isSelfServeCheckout('free')).toBe(false);
    expect(isSelfServeCheckout('partner')).toBe(false);
    expect(isSelfServeCheckout('enterprise')).toBe(true);
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
  it('zeigt Enterprise (Diamant) seit 2026-10-24 als Self-Service-Preis', () => {
    const diamant = OPTIMIZER_TIERS.find((t) => t.id === 'diamant')!; // → enterprise checkout
    expect(formatTierPrice(diamant)).toBe('1.498\u00a0€/Monat netto');
  });
  it('zeigt für Partner (Platin) keinen Fake-Festpreis', () => {
    const platin = OPTIMIZER_TIERS.find((t) => t.id === 'platin')!;
    expect(formatTierPrice(platin)).toBe('Individuell');
  });
  it('zeigt Agency (Gold) als Self-Service-Preis', () => {
    const gold = OPTIMIZER_TIERS.find((t) => t.id === 'gold')!;
    expect(formatTierPrice(gold)).toBe('€699 / Monat');
  });
});
