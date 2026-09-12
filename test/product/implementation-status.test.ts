import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  IMPLEMENTATION_ITEMS,
  LANDING_FORBIDDEN_LIVE_CLAIMS,
  LIVE_IMPLEMENTATION,
  PLATFORM_LIVE_ITEMS,
  ROADMAP_ITEMS,
  isImplementationLive,
} from '../../src/product/implementation-status';

describe('implementation-status registry', () => {
  it('has unique ids and valid statuses', () => {
    const ids = IMPLEMENTATION_ITEMS.map((i) => i.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const item of IMPLEMENTATION_ITEMS) {
      expect(['live', 'preview', 'coming-soon']).toContain(item.status);
      expect(item.evidence.length).toBeGreaterThan(0);
      expect(item.description.length).toBeGreaterThan(12);
    }
  });

  it('keeps yearly billing off live; Earth backdrop live on /; sphere not on /', () => {
    expect(isImplementationLive('pricing-yearly')).toBe(false);
    expect(isImplementationLive('governance-sphere-interactive')).toBe(false);
    expect(isImplementationLive('hero-earth-scenery')).toBe(true);
    expect(isImplementationLive('free-audit')).toBe(true);
  });

  it('exposes platform + roadmap slices for landing', () => {
    expect(PLATFORM_LIVE_ITEMS.length).toBeGreaterThan(3);
    expect(ROADMAP_ITEMS.every((i) => i.status !== 'live')).toBe(true);
    expect(LIVE_IMPLEMENTATION.every((i) => i.status === 'live')).toBe(true);
  });

  it('ships docs + CI claim script', () => {
    expect(existsSync(resolve('docs/product/implementation-status.md'))).toBe(true);
    expect(existsSync(resolve('scripts/check-landing-claims.mjs'))).toBe(true);
  });

  it('MainLanding + roadmap render from the registry', () => {
    const landing = readFileSync(resolve('src/pages/MainLanding.tsx'), 'utf8');
    const spine = readFileSync(resolve('src/components/landing/LandingOsSpine.tsx'), 'utf8');
    const roadmap = readFileSync(
      resolve('src/components/landing/LandingRoadmapSection.tsx'),
      'utf8',
    );
    expect(landing + spine).toContain('PLATFORM_LIVE_ITEMS');
    expect(landing).toContain('LandingRoadmapSection');
    expect(landing).not.toContain('Vollständige KI-Governance');
    expect(roadmap).toContain('PREVIEW_IMPLEMENTATION');
    expect(roadmap).toContain('COMING_SOON_IMPLEMENTATION');
  });

  it('forbids unqualified complete-runtime claims on landing', () => {
    const landing = readFileSync(resolve('src/pages/MainLanding.tsx'), 'utf8');
    for (const phrase of LANDING_FORBIDDEN_LIVE_CLAIMS) {
      expect(landing.includes(phrase), phrase).toBe(false);
    }
  });

  it('hero headline is Europe-OS lock (AI Compliance Operations OS for Europe)', () => {
    const hero = readFileSync(
      resolve('src/components/governance-frontend/hero-content.ts'),
      'utf8',
    );
    expect(hero).toContain('AI Compliance');
    expect(hero).toContain('Operations OS');
    expect(hero).toContain('Europe');
    expect(hero).toContain("HERO_HEADLINE_TEST_SUBSTRING = 'AI Compliance'");
    expect(hero).toContain('Free Audit starten');
    expect(hero).toContain('Live Dashboard ansehen');
    expect(hero).toContain('DISCOVER → CLASSIFY → ENFORCE → PROVE');
    expect(hero).toContain('Runtime governance for regulated AI systems');
    expect(hero).toContain('AI GOVERNANCE · RUNNING IN REAL TIME');
    expect(hero).toContain('EU-CENTRAL');
    expect(hero).toContain('EVIDENCE-CHAIN');
    expect(hero).toContain('AI-ACT-KLASSIFIKATION');
    expect(hero).toContain('PROVENANCE');
    expect(hero).toContain('C2PA');
    expect(hero).not.toContain('99.9');
    expect(hero).not.toContain('UPTIME');
    expect(hero).not.toContain('Running in Real');
    expect(hero).toContain("text: 'Europe'");
    expect(hero).toContain('accent: true');
    expect(hero).toMatch(/AI Compliance/);
    expect(hero).toMatch(/Operations OS for/);
  });
});
