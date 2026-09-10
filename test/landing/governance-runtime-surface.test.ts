import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('landing governance runtime surface', () => {
  it('keeps the public runtime surface free of fake live metrics', () => {
    const file = readFileSync(resolve(process.cwd(), 'src/components/landing/LandingGovernanceRuntimeSurface.tsx'), 'utf8');
    expect(file).toContain('BEISPIELANSICHT');
    expect(file).toContain('Echte Werte entstehen tenantbezogen');
    expect(file).not.toContain('87/100');
    expect(file).not.toContain('1.248');
  });

  it('preserves the intended governance flow', () => {
    const file = readFileSync(resolve(process.cwd(), 'src/components/landing/LandingGovernanceRuntimeSurface.tsx'), 'utf8');
    for (const step of ['DISCOVER', 'ASSESS', 'GOVERN', 'ENFORCE', 'EVIDENCE', 'AUDIT']) {
      expect(file).toContain(step);
    }
  });
});
