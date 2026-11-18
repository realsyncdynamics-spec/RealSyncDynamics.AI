import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('Governance AI Earth daylight balance', () => {
  it('keeps the hero Earth predominantly daylit and limits night emission', () => {
    const source = readFileSync(
      resolve(__dirname, '../../src/components/landing/GovernanceAiBackdrop.tsx'),
      'utf8',
    );

    expect(source).toContain('position={[8, 4.2, 6.5]}');
    expect(source).toContain('intensity={3.0}');
    expect(source).toContain('<hemisphereLight');
    expect(source).toContain('emissiveIntensity={0.72}');
    expect(source).toContain('7.5 + Math.cos(orbit) * 1.2');
    expect(source).toContain('6.5 + Math.sin(orbit) * 1.0');
    expect(source).not.toContain('Europa bleibt bei Nacht');
    expect(source).not.toContain('emissiveIntensity={1.9}');
  });
});
