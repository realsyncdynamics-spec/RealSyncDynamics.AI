import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  GOVERNANCE_SPHERE_NODES,
  SPHERE_DEMO_LABEL,
  SPHERE_DEMO_NOTE,
} from '../../src/components/governance-frontend/governance-sphere-nodes';
import {
  detectEarthQuality,
  getEarthTextureSet,
} from '../../src/components/visual/earthTextures';

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
    expect(host).toContain('DEMO DATA');
  });

  it('renders photoreal Earth (day texture), not wireframe-only mesh', () => {
    const scene = readFileSync(
      resolve(__dirname, '../../src/components/governance-frontend/GovernanceSphereScene.tsx'),
      'utf8',
    );
    const mesh = readFileSync(
      resolve(__dirname, '../../src/components/visual/PhotorealEarthMesh.tsx'),
      'utf8',
    );
    const textures = readFileSync(
      resolve(__dirname, '../../src/components/visual/earthTextures.ts'),
      'utf8',
    );
    const fallback = readFileSync(
      resolve(__dirname, '../../src/components/governance-frontend/GovernanceSphereFallback.tsx'),
      'utf8',
    );
    expect(scene).toContain('PhotorealEarthMesh');
    expect(scene).not.toMatch(/\bwireframe\b/);
    expect(scene).not.toContain('icosahedronGeometry');
    expect(mesh).toContain('/textures/earth-day.jpg');
    expect(mesh).toContain('meshBasicMaterial');
    expect(textures).toContain('earth-day-8k.jpg');
    expect(mesh).toMatch(/uNight|night/i);
    expect(mesh).toMatch(/uClouds|clouds/i);
    expect(fallback).toContain('/europe-globe');
  });

  it('ships adaptive day/night/cloud/specular texture assets', () => {
    const root = resolve(__dirname, '../../public/textures');
    for (const file of [
      'earth-day.jpg',
      'earth-day-4k.jpg',
      'earth-day-8k.jpg',
      'earth-night.jpg',
      'earth-clouds.jpg',
      'earth-specular.jpg',
      'README.md',
    ]) {
      expect(existsSync(resolve(root, file)), file).toBe(true);
    }
  });

  it('maps quality tiers to progressive texture paths', () => {
    expect(detectEarthQuality({ reducedMotion: true })).toBe('low');
    expect(getEarthTextureSet('low').day).toBe('/textures/earth-day.jpg');
    expect(getEarthTextureSet('medium').day).toBe('/textures/earth-day-4k.jpg');
    expect(getEarthTextureSet('high').day).toBe('/textures/earth-day-8k.jpg');
    expect(getEarthTextureSet('high').cloudsEnabled).toBe(true);
    expect(getEarthTextureSet('low').nightEnabled).toBe(false);
  });

  it('ships geography + space backdrop (borders, capitals, planets, sunrise)', () => {
    const scene = readFileSync(
      resolve(__dirname, '../../src/components/governance-frontend/GovernanceSphereScene.tsx'),
      'utf8',
    );
    const geo = readFileSync(
      resolve(__dirname, '../../src/components/governance-frontend/SphereGeography.tsx'),
      'utf8',
    );
    const space = readFileSync(
      resolve(__dirname, '../../src/components/governance-frontend/SphereSpaceBackground.tsx'),
      'utf8',
    );
    const capitals = readFileSync(
      resolve(__dirname, '../../src/components/governance-frontend/geo/capitals.ts'),
      'utf8',
    );
    expect(scene).toContain('SphereGeography');
    expect(scene).toContain('SphereSpaceBackground');
    expect(scene).toMatch(/Bloom|EffectComposer/);
    expect(geo).toContain('earth-borders-110m.json');
    expect(geo).toContain('Hauptstadt');
    expect(space).toContain('mars');
    expect(space).toContain('jupiter');
    expect(space).toContain('saturn');
    expect(space).toContain('neptune');
    expect(space).toContain('pluto');
    expect(space).toContain('uranus');
    expect(space).toMatch(/RisingSun|SUN_POS|sunrise/i);
    expect(capitals).toContain('Berlin');
    expect(capitals).toContain('Brüssel');
    expect(existsSync(resolve(__dirname, '../../public/textures/earth-borders-110m.json'))).toBe(
      true,
    );
  });
});
