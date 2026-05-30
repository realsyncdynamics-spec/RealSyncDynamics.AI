import { describe, it, expect } from 'vitest';
import {
  SEVERITY_LABEL,
  SEVERITY_ORDER,
  type Severity,
} from '../src/features/governance/aiActRiskInventoryApi';

/**
 * AI-Act-Risiko-Inventar — API-Shape Smoke-Tests.
 *
 * Validiert die exportierten Severity-Konstanten gegen die EU-AI-Act-Pyramide
 * (Verordnung 2024/1689). Pyramide hat 4 Klassen, Reihenfolge prohibited →
 * minimal entspricht absteigender Strenge.
 */

describe('AI-Act-Risiko-Inventar Severity-Konstanten', () => {
  const ALL: Severity[] = ['prohibited', 'high', 'limited', 'minimal'];

  it('definiert genau die 4 EU-AI-Act-Pyramidenklassen', () => {
    expect(Object.keys(SEVERITY_LABEL).sort()).toEqual([...ALL].sort());
    expect(Object.keys(SEVERITY_ORDER).sort()).toEqual([...ALL].sort());
  });

  it('SEVERITY_ORDER spiegelt die Strenge von prohibited (=0) bis minimal (=3)', () => {
    expect(SEVERITY_ORDER.prohibited).toBeLessThan(SEVERITY_ORDER.high);
    expect(SEVERITY_ORDER.high).toBeLessThan(SEVERITY_ORDER.limited);
    expect(SEVERITY_ORDER.limited).toBeLessThan(SEVERITY_ORDER.minimal);
  });

  it('Labels referenzieren die jeweils zentralen AI-Act-Normen', () => {
    expect(SEVERITY_LABEL.prohibited).toMatch(/Art\.\s*5/);
    expect(SEVERITY_LABEL.high).toMatch(/Annex\s*III/);
    expect(SEVERITY_LABEL.limited).toMatch(/Art\.\s*50/);
    expect(SEVERITY_LABEL.minimal).toMatch(/Minimal/i);
  });

  it('Labels sind alle in deutscher Sprache (Konventions-Check)', () => {
    // Wir prüfen nicht jeden String, sondern dass die zentralen deutschen
    // Begriffe konsistent verwendet werden.
    expect(SEVERITY_LABEL.prohibited).toMatch(/Verboten/);
    expect(SEVERITY_LABEL.high).toMatch(/Risiko/);
    expect(SEVERITY_LABEL.limited).toMatch(/Risiko/);
    expect(SEVERITY_LABEL.minimal).toMatch(/Risiko/);
  });
});
