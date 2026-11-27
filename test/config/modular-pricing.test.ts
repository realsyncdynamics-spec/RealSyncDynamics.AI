import { describe, expect, it } from 'vitest';
import { MODULAR_OFFERS, MODULAR_PRODUCT_IDS, MODULAR_STANDALONE_MONTHLY_EUR, isModularCheckoutReleased, isValidModularSelection } from '../../shared/pricing';

describe('modular pricing preview', () => {
  it('defines the approved draft prices in order', () => {
    expect(MODULAR_OFFERS.map(o => o.monthlyEur)).toEqual([0, 49, 149, 399]);
    expect(MODULAR_STANDALONE_MONTHLY_EUR['claude-code-optimizer']).toBe(29);
  });
  it('rejects invalid, duplicate and excessive selections', () => {
    expect(isValidModularSelection('professional', ['ki-bots'])).toBe(true);
    expect(isValidModularSelection('growth', ['ki-bots', 'app-builder'])).toBe(true);
    expect(isValidModularSelection('agency', MODULAR_PRODUCT_IDS)).toBe(true);
    expect(isValidModularSelection('growth', ['ki-bots', 'ki-bots'])).toBe(false);
    expect(isValidModularSelection('professional', ['unknown'])).toBe(false);
    expect(isValidModularSelection('starter', ['ki-bots'])).toBe(false);
    expect(isValidModularSelection('unknown', [])).toBe(false);
  });
  it('cannot release checkout', () => expect(isModularCheckoutReleased()).toBe(false));
});
