import { describe, it, expect } from 'vitest';
import {
  computeFindingSeverity,
  compareSeverity,
  sortFindingsBySeverity,
  type FindingInput,
  type FindingSeverity,
} from '../../src/lib/governance/finding-severity';

describe('computeFindingSeverity', () => {
  describe('pre_consent_tracking', () => {
    it('ist immer critical, unabhängig von weiteren Inputs', () => {
      const cases: FindingInput[] = [
        { category: 'pre_consent_tracking' },
        { category: 'pre_consent_tracking', preConsent: true },
        { category: 'pre_consent_tracking', preConsent: false },
        { category: 'pre_consent_tracking', vendorKnown: true },
      ];
      for (const input of cases) {
        expect(computeFindingSeverity(input)).toBe('critical');
      }
    });
  });

  describe('unknown_vendor', () => {
    it('preConsent=true → critical', () => {
      expect(
        computeFindingSeverity({ category: 'unknown_vendor', preConsent: true }),
      ).toBe('critical');
    });
    it('preConsent=false → high', () => {
      expect(
        computeFindingSeverity({ category: 'unknown_vendor', preConsent: false }),
      ).toBe('high');
    });
    it('preConsent fehlt → high (default)', () => {
      expect(
        computeFindingSeverity({ category: 'unknown_vendor' }),
      ).toBe('high');
    });
  });

  describe('missing_required', () => {
    it('Datenschutzerklärung fehlt → critical', () => {
      expect(
        computeFindingSeverity({
          category: 'missing_required',
          requiredKind: 'privacy_policy',
        }),
      ).toBe('critical');
    });
    it('Impressum fehlt → high', () => {
      expect(
        computeFindingSeverity({
          category: 'missing_required',
          requiredKind: 'imprint',
        }),
      ).toBe('high');
    });
    it('unknown requiredKind → high (sicherer Default)', () => {
      expect(
        computeFindingSeverity({
          category: 'missing_required',
          requiredKind: 'unknown',
        }),
      ).toBe('high');
    });
    it('ohne requiredKind → high', () => {
      expect(
        computeFindingSeverity({ category: 'missing_required' }),
      ).toBe('high');
    });
  });

  describe('ai_widget', () => {
    it('dokumentiertes Widget → low', () => {
      expect(
        computeFindingSeverity({
          category: 'ai_widget',
          widgetDocumented: true,
        }),
      ).toBe('low');
    });
    it('undokumentiert + preConsent → high', () => {
      expect(
        computeFindingSeverity({
          category: 'ai_widget',
          widgetDocumented: false,
          preConsent: true,
        }),
      ).toBe('high');
    });
    it('undokumentiert ohne preConsent → medium', () => {
      expect(
        computeFindingSeverity({
          category: 'ai_widget',
          widgetDocumented: false,
        }),
      ).toBe('medium');
    });
    it('widgetDocumented schlägt preConsent (dokumentiert = low auch bei pre-consent)', () => {
      // Dokumentation einer Pre-Consent-Aktivierung ist akzeptabel, wenn
      // sie technisch notwendig ist (z. B. Sprachen-Detection-Skript).
      expect(
        computeFindingSeverity({
          category: 'ai_widget',
          widgetDocumented: true,
          preConsent: true,
        }),
      ).toBe('low');
    });
  });

  describe('uncategorized_cookie', () => {
    it('persistent + Third-Party → medium', () => {
      expect(
        computeFindingSeverity({
          category: 'uncategorized_cookie',
          cookieScope: 'persistent',
          cookieThirdParty: true,
        }),
      ).toBe('medium');
    });
    it('persistent + First-Party → low', () => {
      expect(
        computeFindingSeverity({
          category: 'uncategorized_cookie',
          cookieScope: 'persistent',
          cookieThirdParty: false,
        }),
      ).toBe('low');
    });
    it('session-Cookie → low (auch Third-Party)', () => {
      expect(
        computeFindingSeverity({
          category: 'uncategorized_cookie',
          cookieScope: 'session',
          cookieThirdParty: true,
        }),
      ).toBe('low');
    });
    it('ohne scope → low (Default)', () => {
      expect(
        computeFindingSeverity({ category: 'uncategorized_cookie' }),
      ).toBe('low');
    });
  });

  describe('Output-Domain', () => {
    it('liefert immer einen der vier erlaubten Werte', () => {
      const validValues: FindingSeverity[] = ['low', 'medium', 'high', 'critical'];
      const inputs: FindingInput[] = [
        { category: 'pre_consent_tracking' },
        { category: 'unknown_vendor' },
        { category: 'missing_required' },
        { category: 'ai_widget' },
        { category: 'uncategorized_cookie' },
      ];
      for (const input of inputs) {
        expect(validValues).toContain(computeFindingSeverity(input));
      }
    });
  });
});

describe('compareSeverity', () => {
  it('critical kommt vor high vor medium vor low', () => {
    const sorted = (['low', 'medium', 'critical', 'high'] as FindingSeverity[])
      .slice()
      .sort(compareSeverity);
    expect(sorted).toEqual(['critical', 'high', 'medium', 'low']);
  });
  it('gleiche Severity → 0', () => {
    expect(compareSeverity('high', 'high')).toBe(0);
  });
});

describe('sortFindingsBySeverity', () => {
  it('absteigend (critical zuerst), stable bei Gleichstand', () => {
    const input = [
      { id: 'a', severity: 'low' as const },
      { id: 'b', severity: 'critical' as const },
      { id: 'c', severity: 'medium' as const },
      { id: 'd', severity: 'critical' as const },
      { id: 'e', severity: 'high' as const },
    ];
    const result = sortFindingsBySeverity(input);
    expect(result.map((r) => r.id)).toEqual(['b', 'd', 'e', 'c', 'a']);
  });
  it('mutiert das Input-Array nicht', () => {
    const input = [{ severity: 'low' as const }, { severity: 'critical' as const }];
    const before = [...input];
    sortFindingsBySeverity(input);
    expect(input).toEqual(before);
  });
});
