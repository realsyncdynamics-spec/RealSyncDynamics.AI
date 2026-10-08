import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  IMPLEMENTATION_ITEMS,
  IMPLEMENTATION_MEASURED_AT,
  LANDING_FORBIDDEN_LIVE_CLAIMS,
  LIVE_IMPLEMENTATION,
  PLATFORM_LIVE_ITEMS,
  ROADMAP_COMING_SOON_ITEMS,
  ROADMAP_ITEMS,
  ROADMAP_LIVE_ITEMS,
  ROADMAP_PREVIEW_ITEMS,
  getImplementation,
  isImplementationLive,
} from '../../src/product/implementation-status';
import {
  PUBLIC_ROADMAP_COPY,
  getPublicRoadmapCopy,
  getPublicRoadmapRoute,
} from '../../src/product/implementation-status-public';

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

  it('bumps measured date after Landing v4 re-measure', () => {
    expect(IMPLEMENTATION_MEASURED_AT).toBe('2026-10-04');
  });

  it('keeps yearly billing off live; free audit live', () => {
    expect(isImplementationLive('pricing-yearly')).toBe(false);
    expect(isImplementationLive('free-audit')).toBe(true);
  });

  it('exposes platform + roadmap slices for landing', () => {
    expect(PLATFORM_LIVE_ITEMS.length).toBeGreaterThan(3);
    expect(ROADMAP_ITEMS.every((i) => i.status !== 'live')).toBe(true);
    expect(LIVE_IMPLEMENTATION.every((i) => i.status === 'live')).toBe(true);
    expect(ROADMAP_LIVE_ITEMS.every((i) => i.status === 'live')).toBe(true);
    expect(ROADMAP_PREVIEW_ITEMS.every((i) => i.status === 'preview')).toBe(true);
    expect(ROADMAP_COMING_SOON_ITEMS.every((i) => i.status === 'coming-soon')).toBe(true);
  });

  it('hides redirect-only design landings from the public roadmap', () => {
    expect(getImplementation('design-landing-ledger')?.showOnRoadmap).toBe(false);
    expect(getImplementation('design-landing-tribunal')?.showOnRoadmap).toBe(false);
    expect(ROADMAP_PREVIEW_ITEMS.some((i) => i.id === 'design-landing-ledger')).toBe(false);
    expect(ROADMAP_PREVIEW_ITEMS.some((i) => i.id === 'design-landing-tribunal')).toBe(false);
    expect(getImplementation('design-landing-ledger')?.route).toBeUndefined();
    expect(getImplementation('design-landing-tribunal')?.route).toBeUndefined();
  });

  it('points public landing + earth hero at Landing v4 evidence', () => {
    const landing = getImplementation('public-landing')!;
    expect(landing.status).toBe('live');
    expect(landing.evidence.some((e) => e.includes('LandingV4'))).toBe(true);
    expect(landing.evidence.some((e) => e.includes('DesignGovernanceAiLanding'))).toBe(false);

    const earth = getImplementation('hero-earth-scenery')!;
    expect(earth.status).toBe('live');
    expect(earth.evidence.some((e) => e.includes('heroEarthScene'))).toBe(true);
    expect(earth.evidence.some((e) => e.includes('MainLanding'))).toBe(false);
    expect(earth.description.toLowerCase()).toContain('three.js');
  });

  it('does not claim Agent OS is mounted on live /app/dashboard', () => {
    for (const id of [
      'agent-os-command-center',
      'agent-os-mesh-compliance',
      'agent-os-product-evolution',
    ] as const) {
      const item = getImplementation(id)!;
      expect(item.status).toBe('preview');
      expect(item.route).toBeUndefined();
      expect(item.description).toMatch(/nicht.*\/app\/dashboard|nicht gemountet|nicht als Live/i);
    }
    const command = getImplementation('command-center')!;
    expect(command.evidence.some((e) => e.includes('CommandCenterDashboard'))).toBe(true);
    expect(command.evidence.some((e) => e.includes('AgentOsPanel'))).toBe(false);
  });

  it('narrows ai-act-classify to the public classifier; inventory persist stays preview', () => {
    const classify = getImplementation('ai-act-classify')!;
    expect(classify.status).toBe('live');
    expect(classify.route).toBe('/ai-act-klassifikator');
    expect(classify.description).toContain('/ai-act-klassifikator');
    expect(classify.description.toLowerCase()).not.toMatch(/als inventar führen/);
    expect(classify.evidence.some((e) => e.includes('AiActClassifier'))).toBe(true);
    expect(classify.evidence.some((e) => e.includes('ai-act-classify'))).toBe(true);
    expect(classify.evidence.some((e) => e.includes('platform-capabilities'))).toBe(false);

    const persist = getImplementation('ai-act-inventory-persist')!;
    expect(persist.status).toBe('preview');
    expect(isImplementationLive('ai-act-inventory-persist')).toBe(false);
    expect(persist.showOnRoadmap).not.toBe(false);
    expect(persist.description).toMatch(/kein(em)? Plan|kein Upgrade/i);
    expect(persist.description).toMatch(/Persist|Speichern/i);
    expect(ROADMAP_PREVIEW_ITEMS.some((i) => i.id === 'ai-act-inventory-persist')).toBe(true);
    expect(ROADMAP_LIVE_ITEMS.find((i) => i.id === 'ai-act-classify')?.route).toBe(
      '/ai-act-klassifikator',
    );
  });

  it('registers frontend-builder live and modernize wizard preview', () => {
    expect(isImplementationLive('public-frontend-builder')).toBe(true);
    expect(getImplementation('public-frontend-builder')?.route).toBe('/frontend-builder');
    expect(getImplementation('frontend-modernize-wizard')?.status).toBe('preview');
    expect(getImplementation('frontend-modernize-wizard')?.route).toBe('/app/siteos/modernize');
  });

  it('marks automations/n8n as preview — Skills unlinked, Runtime down', () => {
    const item = getImplementation('automation-n8n')!;
    expect(item.status).toBe('preview');
    expect(isImplementationLive('automation-n8n')).toBe(false);
    expect(item.route).toBe('/app/automations');
    expect(item.description.toLowerCase()).toMatch(/ohne workflow|nicht erreichbar|keine produktive/);
    expect(item.description).not.toMatch(/\b(Pilot|Demo|Call|Sales|Beratung|Termin)\b/i);
    expect(item.evidence.some((e) => e.includes('automation-trigger'))).toBe(true);
    expect(ROADMAP_PREVIEW_ITEMS.some((i) => i.id === 'automation-n8n')).toBe(true);
  });

  it('mentions /login on the welcome/auth entry', () => {
    expect(getImplementation('welcome')?.description).toContain('/login');
    expect(getImplementation('welcome')?.evidence.some((e) => e.includes('LoginPage'))).toBe(true);
  });

  it('ships docs + CI claim script', () => {
    expect(existsSync(resolve('docs/product/implementation-status.md'))).toBe(true);
    expect(existsSync(resolve('scripts/check-landing-claims.mjs'))).toBe(true);
    const docs = readFileSync(resolve('docs/product/implementation-status.md'), 'utf8');
    expect(docs).toContain('Landing v4');
    expect(docs).toContain('AI Compliance Operations OS for Europe');
    expect(docs).toContain('/ai-act-klassifikator');
    expect(docs).toContain('ai-act-inventory-persist');
    expect(docs).not.toMatch(/cyan buttons/);
  });

  it('Landing v4 roadmap renders from the registry via public copy', () => {
    const landing = readFileSync(resolve('src/pages/LandingV4.tsx'), 'utf8');
    const sections = readFileSync(
      resolve('src/components/landing/v4/LandingV4Sections.tsx'),
      'utf8',
    );
    const content = readFileSync(
      resolve('src/components/landing/v4/landing-v4-content.ts'),
      'utf8',
    );
    const roadmapLegacy = readFileSync(
      resolve('src/components/landing/LandingRoadmapSection.tsx'),
      'utf8',
    );
    expect(landing).toContain('V4Roadmap');
    expect(sections).toContain('ROADMAP_LIVE_ITEMS');
    expect(sections).toContain('ROADMAP_PREVIEW_ITEMS');
    expect(sections).toContain('ROADMAP_COMING_SOON_ITEMS');
    expect(sections).toContain('getPublicRoadmapCopy');
    expect(sections).not.toMatch(/\{item\.description\}/);
    expect(sections).not.toMatch(/\{item\.name\}/);
    expect(content).not.toMatch(/export const ROADMAP =/);
    expect(content).toContain('Registry-live: DSGVO');
    expect(content).not.toContain('Live: DSGVO, EU AI Act, ISO 27001 und NIS2');
    expect(roadmapLegacy).toContain('ROADMAP_PREVIEW_ITEMS');
  });

  it('covers every public roadmap item with customer-facing DE/EN copy', () => {
    const publicItems = [...ROADMAP_LIVE_ITEMS, ...ROADMAP_PREVIEW_ITEMS, ...ROADMAP_COMING_SOON_ITEMS];
    const banned = [
      'CommandCenterDashboard',
      'AgentOsPanel',
      '#1743',
      '#1331',
      'Messung',
      'Dominik',
      'Auto-Merge',
      'optimizer',
      'Kugel',
    ] as const;
    expect(publicItems.some((i) => i.id === 'governance-sphere-interactive')).toBe(false);
    expect(getImplementation('governance-sphere-interactive')?.showOnRoadmap).toBe(false);
    for (const item of publicItems) {
      expect(PUBLIC_ROADMAP_COPY[item.id], item.id).toBeTruthy();
      for (const lang of ['de', 'en'] as const) {
        const copy = getPublicRoadmapCopy(item, lang);
        expect(copy.name.length, `${item.id}.${lang}.name`).toBeGreaterThan(3);
        expect(copy.description.length, `${item.id}.${lang}.description`).toBeGreaterThan(12);
        for (const phrase of banned) {
          expect(copy.name.toLowerCase(), `${item.id} name has ${phrase}`).not.toContain(
            phrase.toLowerCase(),
          );
          expect(copy.description.toLowerCase(), `${item.id} desc has ${phrase}`).not.toContain(
            phrase.toLowerCase(),
          );
        }
        expect(copy.description).not.toMatch(/#\d{3,5}/);
        expect(copy.name).not.toMatch(/\b[A-Z][a-zA-Z]+(?:Dashboard|Panel|View|Shell|Wizard|Host)\b/);
        expect(copy.description).not.toMatch(
          /\b[A-Z][a-zA-Z]+(?:Dashboard|Panel|View|Shell|Wizard|Host)\b/,
        );
      }
    }
  });

  it('only exposes customer-safe routes on the public roadmap', () => {
    expect(getPublicRoadmapRoute(getImplementation('free-audit')!)).toBe('/audit');
    expect(getPublicRoadmapRoute(getImplementation('pricing-monthly')!)).toBe('/pricing');
    expect(getPublicRoadmapRoute(getImplementation('ai-gateway')!)).toBeUndefined();
    expect(getPublicRoadmapRoute(getImplementation('channel-bots')!)).toBeUndefined();
    expect(getPublicRoadmapRoute(getImplementation('frontend-modernize-wizard')!)).toBeUndefined();
  });

  it('forbids unqualified complete-runtime claims on Landing v4', () => {
    const landing = readFileSync(resolve('src/pages/LandingV4.tsx'), 'utf8');
    const sections = readFileSync(
      resolve('src/components/landing/v4/LandingV4Sections.tsx'),
      'utf8',
    );
    const content = readFileSync(
      resolve('src/components/landing/v4/landing-v4-content.ts'),
      'utf8',
    );
    for (const phrase of LANDING_FORBIDDEN_LIVE_CLAIMS) {
      expect(landing.includes(phrase), phrase).toBe(false);
      expect(sections.includes(phrase), phrase).toBe(false);
      expect(content.includes(phrase), phrase).toBe(false);
    }
  });

  it('locks Landing v4 homepage H1', () => {
    const sections = readFileSync(
      resolve('src/components/landing/v4/LandingV4Sections.tsx'),
      'utf8',
    );
    // H1/Lede laufen über i18n (HANDOFF_EXTRA), nicht mehr als Literale im Markup.
    expect(sections).toContain("t('v4HeroTitleA')");
    expect(sections).toContain("t('v4HeroTitleB')");
    expect(sections).toContain("t('v4HeroTitleEm')");
    const i18n = readFileSync(resolve('src/i18n/handoff.ts'), 'utf8');
    expect(i18n).toContain("v4HeroTitleEm: 'für Europa'");
    expect(i18n).toContain("v4HeroTitleEm: 'for Europe'");
    expect(i18n).toContain("v4HeroTitleA: 'AI Compliance'");
    expect(i18n).toContain("v4HeroTitleB: 'Operations OS'");
    expect(sections).toContain('Free Audit starten');
    expect(sections).toContain('Runtime ansehen');
    expect(sections).not.toContain('Live Dashboard ansehen');
    expect(sections).not.toContain('/demo-tour/dashboard');
    const landing = getImplementation('public-landing')!;
    expect(landing.description).toContain('/governance-runtime');
    expect(landing.description).not.toContain('/demo-tour/dashboard');
    const content = readFileSync(
      resolve('src/components/landing/v4/landing-v4-content.ts'),
      'utf8',
    );
    expect(content).toContain('/ai-act-klassifikator');
    expect(content).not.toMatch(/als Inventar führen/);
  });
});
