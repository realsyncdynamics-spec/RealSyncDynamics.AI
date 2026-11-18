import { describe, expect, it } from 'vitest';
import { TAX_NOTICE, TAX_NOTICE_EN } from '../../shared/pricing';
import { HANDOFF_COPY, translate } from '../../src/i18n/handoff';

describe('Kanonische §-19-Hinweise im Handoff (#2157)', () => {
  it.each([
    ['de', TAX_NOTICE],
    ['en', TAX_NOTICE_EN],
  ] as const)('%s: Basis und wirksame Übersetzung verwenden den zentralen Hinweis', (lang, notice) => {
    for (const key of ['pricingSub', 'pricingFoot'] as const) {
      expect(HANDOFF_COPY[lang][key]).toContain(notice);
      expect(translate(lang, key)).toContain(notice);
      expect(translate(lang, key)).not.toMatch(/Preise netto|Prices net|excl\. VAT/i);
    }
    // Der bestehende Override beschränkt die Residency-Zusage auf den belegten Hoster.
    expect(translate(lang, 'pricingSub')).toContain('Supabase Frankfurt');
    expect(translate(lang, 'pricingSub')).not.toMatch(/Alle Daten|All data/);
  });
});
