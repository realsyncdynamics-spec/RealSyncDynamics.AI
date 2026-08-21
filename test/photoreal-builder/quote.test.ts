import { describe, expect, it } from 'vitest';
import { BASE_CENTS, LADDER, aboForRung, firstInvoice, monthlyCents, rungByKey } from '../../src/features/photoreal-builder/quote';

describe('photoreal builder pricing ladder', () => {
  it('first paying moment is neue website: 249 setup + 79 abo', () => {
    expect(BASE_CENTS).toBe(24900);
    expect(firstInvoice('launch')).toBe(32800);
    expect(rungByKey(undefined).key).toBe('launch');
    expect(LADDER[0].highlighted).toBe(true);
  });

  it('every rung requires an abo and first invoice is setup plus month', () => {
    for (const r of LADDER) {
      expect(r.abo).toBeTruthy();
      expect(firstInvoice(r.key)).toBe(r.cents + monthlyCents(r.abo));
    }
    expect(firstInvoice('dialog')).toBeGreaterThan(firstInvoice('launch'));
    expect(firstInvoice('empfang')).toBeGreaterThan(firstInvoice('dialog'));
  });

  it('maps rungs onto existing Stripe abos', () => {
    expect(aboForRung('launch')).toBe('starter');
    expect(aboForRung('dialog')).toBe('starter');
    expect(aboForRung('empfang')).toBe('growth');
    expect(monthlyCents('starter')).toBe(7900);
    expect(monthlyCents('growth')).toBe(24900);
  });

  it('nests extras', () => {
    expect(LADDER[1].extras.includes('chat')).toBe(true);
    expect(LADDER[1].extras.includes('phone')).toBe(false);
    for (const extra of LADDER[1].extras) {
      expect(LADDER[2].extras.includes(extra)).toBe(true);
    }
  });
});
