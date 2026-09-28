/** Gate 1 — „Hochrisiko“ hat im Dashboard genau eine Definition. */
import { describe, expect, it } from 'vitest';
import {
  HIGH_RISK_SYSTEMS_ROUTE,
  isHighRiskAiSystem,
} from '../../../../src/features/governance/handoff/enforcementModel';

const asset = (asset_type: string, ai_act_class: string) =>
  ({ asset_type, ai_act_class }) as Parameters<typeof isHighRiskAiSystem>[0];

describe('isHighRiskAiSystem', () => {
  it('KI-System mit EU-AI-Act-Klasse hoch oder verboten', () => {
    expect(isHighRiskAiSystem(asset('ai_system', 'high'))).toBe(true);
    expect(isHighRiskAiSystem(asset('ai_system', 'prohibited'))).toBe(true);
  });

  it('unklassifiziert ist nicht „kein Hochrisiko“, sondern wird getrennt gezählt', () => {
    expect(isHighRiskAiSystem(asset('ai_system', 'unknown'))).toBe(false);
    expect(isHighRiskAiSystem(asset('ai_system', 'limited'))).toBe(false);
  });

  it('nur KI-Systeme — eine Website mit Klasse „high“ zählt nicht', () => {
    expect(isHighRiskAiSystem(asset('website', 'high'))).toBe(false);
  });

  it('Drill-down filtert das Inventar', () => {
    expect(HIGH_RISK_SYSTEMS_ROUTE).toBe('/app/ai-systems?risk=high');
  });
});
