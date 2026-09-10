import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  GOVERNANCE_SPHERE_NODES,
  SPHERE_DEMO_LABEL,
  SPHERE_DEMO_NOTE,
} from '../../src/components/governance-frontend/governance-sphere-nodes';

describe('Governance Sphere — demo contract', () => {
  it('labels simulated state explicitly', () => {
    expect(SPHERE_DEMO_LABEL.toUpperCase()).toMatch(/DEMO|SIMULATED/);
    expect(SPHERE_DEMO_NOTE.toLowerCase()).toMatch(/simulat|demo|scan/);
  });

  it('only uses operational/attention states — no fake live counts as production', () => {
    for (const node of GOVERNANCE_SPHERE_NODES) {
      expect(['operational', 'attention']).toContain(node.state);
      expect(node.detail?.toLowerCase() ?? '').toMatch(/demo/);
    }
  });

  it('covers Detect · Govern · Prove · Automate', () => {
    const phases = new Set(GOVERNANCE_SPHERE_NODES.map((n) => n.phase));
    expect(phases).toEqual(new Set(['Detect', 'Govern', 'Prove', 'Automate']));
  });

  it('is lazy-hosted from MainLanding with reduced-motion fallback path', () => {
    const host = readFileSync(
      resolve(__dirname, '../../src/components/governance-frontend/GovernanceSphereHost.tsx'),
      'utf8',
    );
    expect(host).toContain('lazy(');
    expect(host).toContain('prefers-reduced-motion');
    expect(host).toContain('GovernanceSphereFallback');
    expect(host).toContain('SPHERE_DEMO_LABEL');
  });

  it('picks 3D nodes via canvas raycast (not R3F DragSurface events)', () => {
    const scene = readFileSync(
      resolve(__dirname, '../../src/components/governance-frontend/GovernanceSphereScene.tsx'),
      'utf8',
    );
    expect(scene).toContain('PointerBridge');
    expect(scene).toContain('intersectObjects');
    expect(scene).toContain('governanceNode');
    expect(scene).not.toContain('function DragSurface');
  });
});
