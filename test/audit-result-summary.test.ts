import { describe, it, expect } from 'vitest';
import { plainLanguageSummary, type AuditResultFinding } from '../src/features/audit/AuditResultView';

/**
 * Plain-Language-Summary contract — der Satz, der direkt unter dem
 * Audit-Header steht und dem GF/Inhaber binnen 10s sagt was Sache ist.
 *
 * Vier Faelle, jeweils mit exakter erwarteter Phrasen-Form.
 */

function c(critical = 0, high = 0, medium = 0, low = 0): Record<AuditResultFinding['severity'], number> {
  return { critical, high, medium, low, info: 0, pass: 0 };
}

describe('plainLanguageSummary', () => {
  it('0 findings → saubere Site', () => {
    expect(plainLanguageSummary(c(0, 0, 0, 0))).toMatch(/Saubere Site/);
  });

  it('only medium/low → "keine kritischen Verstoesse" + Zaehler', () => {
    const out = plainLanguageSummary(c(0, 0, 1, 1));
    expect(out).toMatch(/keine kritischen DSGVO-Verstoesse/);
    expect(out).toMatch(/2 technische Sicherheitsverbesserungen/);
  });

  it('singular: 1 medium → "Sicherheitsverbesserung wird"', () => {
    const out = plainLanguageSummary(c(0, 0, 1, 0));
    expect(out).toMatch(/1 technische Sicherheitsverbesserung wird/);
  });

  it('any critical → "sofortiger Handlungsbedarf" + Zaehler', () => {
    const out = plainLanguageSummary(c(2, 1, 1, 0));
    expect(out).toMatch(/2 kritische DSGVO-Verstoesse/);
    expect(out).toMatch(/sofortiger Handlungsbedarf/);
    expect(out).toMatch(/2 weitere Befunde/);
  });

  it('only high → "kurzfristig beheben"', () => {
    const out = plainLanguageSummary(c(0, 3, 0, 0));
    expect(out).toMatch(/3 hohe Befunde/);
    expect(out).toMatch(/kurzfristig beheben/);
  });
});
