import { describe, expect, it } from 'vitest';
import { formatNetVatGrossEur, grossFromNetEur } from '../../shared/pricing';

const norm = (s: string) => s.replace(/\u00a0|\u202f/g, ' ');

describe('UX-003 Netto/USt/Brutto', () => {
  it.each([
    [79, 94.01],
    [249, 296.31],
    [699, 831.81],
  ])('grossFromNetEur(%d) = %d', (net, gross) => {
    expect(grossFromNetEur(net)).toBe(gross);
  });

  it('formats plan card line', () => {
    expect(norm(formatNetVatGrossEur(79, 'EU_STANDARD'))).toBe('79 € netto zzgl. 19 % USt (94,01 € brutto)');
    expect(norm(formatNetVatGrossEur(249, 'EU_STANDARD'))).toBe('249 € netto zzgl. 19 % USt (296,31 € brutto)');
    expect(norm(formatNetVatGrossEur(699, 'EU_STANDARD'))).toBe('699 € netto zzgl. 19 % USt (831,81 € brutto)');
  });

  it('EXEMPT shows no VAT', () => {
    expect(norm(formatNetVatGrossEur(79, 'EXEMPT'))).toBe('79 €');
  });
});
