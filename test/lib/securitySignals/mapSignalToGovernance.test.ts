import { describe, it, expect } from 'vitest';
import { normalizeSecuritySignal } from '../../../src/lib/securitySignals/normalizeSecuritySignal';
import { mapSignalToGovernance } from '../../../src/lib/securitySignals/mapSignalToGovernance';

function signal(partial: Record<string, unknown>, provider = 'generic') {
  return normalizeSecuritySignal(partial, provider);
}

describe('mapSignalToGovernance — severity rules', () => {
  it('critical web finding maps to GDPR Art.32, NIS2, ISO27001 and a high-priority risk review', () => {
    const m = mapSignalToGovernance(signal({
      id: 'c1', severity: 'critical', title: 'Exposed admin', asset: 'https://example.com/admin',
    }, 'blacklens'));

    expect(m.riskLevel).toBe('critical');
    const refs = m.controls.map((c) => `${c.framework}:${c.controlRef}`);
    expect(refs).toContain('GDPR:Art. 32');
    expect(refs).toContain('NIS2:Security Measures');
    expect(refs.some((r) => r.startsWith('ISO_27001:'))).toBe(true);

    const taskTypes = m.recommendedTasks.map((t) => t.type);
    expect(taskTypes).toContain('risk_review');
    expect(m.recommendedTasks.find((t) => t.type === 'risk_review')?.priority).toBe('high');
    expect(m.evidenceItems.length).toBeGreaterThan(0);
  });

  it('high severity is treated as high-risk', () => {
    const m = mapSignalToGovernance(signal({ id: 'h1', severity: 'high', title: 'Weak cipher', asset: 'srv-01' }, 'generic'));
    expect(m.riskLevel).toBe('high');
    expect(m.frameworks).toContain('GDPR');
  });
});

describe('mapSignalToGovernance — asset/web rules', () => {
  it('adds attack-surface controls for web/domain assets', () => {
    const m = mapSignalToGovernance(signal({
      id: 'w1', severity: 'medium', title: 'Open port', asset: 'https://api.example.com',
    }, 'generic'));
    const refs = m.controls.map((c) => `${c.framework}:${c.controlRef}`);
    expect(refs).toContain('NIS2:Attack Surface Management');
    expect(m.recommendedTasks.some((t) => t.type === 'attack_surface_review')).toBe(true);
  });
});

describe('mapSignalToGovernance — PII rules', () => {
  it('flags DSGVO breach review and DPO review when personal data is present', () => {
    const m = mapSignalToGovernance(signal({
      id: 'p1', severity: 'high', title: 'Data leak', asset: 'db-01',
      description: 'customer_data and personal_data exposed including email',
    }, 'generic'));
    const refs = m.controls.map((c) => `${c.framework}:${c.controlRef}`);
    expect(refs).toContain('GDPR:Art. 33/34');
    expect(m.recommendedTasks.some((t) => t.type === 'dpo_review')).toBe(true);
  });

  it('detects PII hints inside the raw payload, not just description', () => {
    const m = mapSignalToGovernance(signal({
      id: 'p2', severity: 'low', title: 'Finding', asset: 'host', exposed_fields: ['iban', 'passport'],
    }, 'generic'));
    expect(m.frameworks).toContain('GDPR');
  });
});

describe('mapSignalToGovernance — fallback', () => {
  it('low-severity, non-web, non-PII signal still produces a triage control + task', () => {
    const m = mapSignalToGovernance(signal({ id: 'i1', severity: 'info', title: 'Heads up' }, 'generic'));
    expect(m.riskLevel).toBe('info');
    expect(m.controls.length).toBeGreaterThan(0);
    expect(m.recommendedTasks.some((t) => t.type === 'triage')).toBe(true);
  });

  it('does not duplicate identical controls', () => {
    const m = mapSignalToGovernance(signal({
      id: 'd1', severity: 'critical', title: 'x', asset: 'https://example.com',
      description: 'web api host personal_data email',
    }, 'generic'));
    const keys = m.controls.map((c) => `${c.framework}:${c.controlRef}`);
    expect(new Set(keys).size).toBe(keys.length);
  });
});
