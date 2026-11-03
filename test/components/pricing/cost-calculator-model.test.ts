import { describe, expect, it } from 'vitest';
import {
  AUTOMATION_SHARE_DEFAULT,
  AUTOMATION_SHARE_MAX,
  clampAutomationShare,
  comparePlan,
  computeManualEffort,
  formatDe,
} from '../../../src/components/pricing/costCalculatorModel';
import { CALCULABLE_PRICING_TIERS } from '../../../src/config/pricing';

describe('Kostenkalkulator — Rechenmodell', () => {
  it('berechnet den manuellen Aufwand aus Websites, Prüfhäufigkeit und Stundensatz', () => {
    const effort = computeManualEffort({ websites: 10, reviewFrequency: 'quarterly', hourlyRate: 85 });
    expect(effort.hoursPerYear).toBe(120);
    expect(effort.costPerYear).toBe(10_200);
    expect(effort.costPerMonth).toBe(850);
  });

  it('übersteigt die Ersparnis nie die eingegebenen Kosten — für alle Pläne und Anteile', () => {
    const inputs = [
      { websites: 1, reviewFrequency: 'annual' as const, hourlyRate: 40 },
      { websites: 10, reviewFrequency: 'quarterly' as const, hourlyRate: 85 },
      { websites: 100, reviewFrequency: 'monthly' as const, hourlyRate: 300 },
    ];
    const plans = CALCULABLE_PRICING_TIERS.filter(
      (tier) => tier.id !== 'free' && !tier.id.includes('yearly'),
    );
    expect(plans.length).toBeGreaterThan(0);
    for (const input of inputs) {
      const { costPerYear } = computeManualEffort(input);
      for (const share of [0, 0.1, AUTOMATION_SHARE_DEFAULT, AUTOMATION_SHARE_MAX, 1, 5]) {
        for (const tier of plans) {
          const result = comparePlan(costPerYear, share, tier.priceEur || 0);
          expect(result.avoidedCostPerYear).toBeLessThanOrEqual(costPerYear);
          expect(result.netSavingsPerYear).toBeLessThanOrEqual(costPerYear);
          expect(result.netSavingsPercent).toBeLessThanOrEqual(100);
        }
      }
    }
  });

  it('rechnet die Nettoersparnis nachvollziehbar: entfallene Kosten minus Planpreis', () => {
    const result = comparePlan(10_200, 0.3, 79);
    expect(result.avoidedCostPerYear).toBeCloseTo(3_060);
    expect(result.planCostPerYear).toBe(948);
    expect(result.netSavingsPerYear).toBeCloseTo(2_112);
    expect(result.netSavingsPercent).toBe(21);
  });

  it('weist Mehrkosten aus, wenn der Planpreis die entfallenen Kosten übersteigt', () => {
    const result = comparePlan(360, 0.3, 249);
    expect(result.netSavingsPerYear).toBeLessThan(0);
  });

  it('begrenzt den Automatisierungsanteil auf 0 bis 80 Prozent', () => {
    expect(clampAutomationShare(-1)).toBe(0);
    expect(clampAutomationShare(2)).toBe(AUTOMATION_SHARE_MAX);
    expect(clampAutomationShare(Number.NaN)).toBe(AUTOMATION_SHARE_DEFAULT);
  });

  it('formatiert Beträge im deutschen Zahlenformat', () => {
    expect(formatDe(10_200)).toBe('10.200');
  });
});
