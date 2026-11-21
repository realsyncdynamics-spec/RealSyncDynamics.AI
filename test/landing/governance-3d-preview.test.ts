import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();
const read = (path: string) => readFileSync(resolve(root, path), 'utf8');

describe('Governance 3D preview integration contracts', () => {
  it('has a lazy preview route and leaves LandingV3 as root', () => {
    const app = read('src/App.tsx');
    expect(app).toContain("import('./pages/Governance3DPreviewPage')");
    expect(app).toContain('path="/design/governance-3d"');
    expect(app).toMatch(/path="\/" element=\{<LandingV3 \/>\}/);
  });

  it('points CTAs to real existing public entry routes', () => {
    const preview = read('src/pages/Governance3DPreviewPage.tsx');
    expect(preview).toContain('auditHref="/audit"');
    expect(preview).toContain('platformHref="/governance-runtime"');
  });

  it('does not expose a tenant API or simulated result in the animation', () => {
    const hero = read('src/components/landing/governance-3d/Governance3DHero.tsx');
    expect(hero).toContain('ScrollTrigger.create');
    expect(hero).toContain("prefers-reduced-motion: reduce");
    expect(hero).not.toMatch(/supabase\s*\.\s*from\s*\(/);
    expect(hero).not.toContain('fetch(');
    expect(hero).not.toContain('<Environment');
  });
});
