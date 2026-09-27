import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('Governance AI starfield — GPU motion', () => {
  it('animates star depth in the vertex shader without per-frame buffer uploads', () => {
    const source = readFileSync(
      resolve(__dirname, '../../src/components/landing/GovernanceAiBackdrop.tsx'),
      'utf8',
    );

    expect(source).toContain('animatedPosition.z = 8.0 - mod(depthOffset + uTime * 2.0, 200.0)');
    expect(source).toContain('positions[i * 3 + 2] = 8 - rand() * 200');
    expect(source).not.toContain('geometry.attributes.position.needsUpdate = true');
    expect(source).not.toContain('array[i] += delta * 2');
  });
});
