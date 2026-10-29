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

  it('bumps measured date after Landing v6 re-measure', () => {
    expect(IMPLEMENTATION_MEASURED_AT).toBe('2026-10-18');
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

  it('points public landing at Landing v6; earth hero only on /design/landing-v4', () => {
    const landing = getImplementation('public-landing')!;
    expect(landing.status).toBe('live');
    expect(landing.route).toBe('/');
    expect(landing.evidence.some((e) => e.includes('LandingV6View'))).toBe(true);
    expect(landing.evidence.some((e) => e.includes('useLandingV6'))).toBe(true);
    expect(landing.evidence.some((e) => e.includes('LandingV4'))).toBe(false);
    expect(landing.evidence.some((e) => e.includes('heroEarthScene'))).toBe(false);
    expect(landing.description).not.toContain('AI Compliance Operations OS for Europe');
    expect(landing.description).not.toMatch(/three\.js/i);
    for (const e of landing.evidence) {
      const path = e.split('#')[0];
      if (path.startsWith('src/') || path.startsWith('test/') || path.startsWith('public/')) {
        expect(existsSync(resolve(path)), e).toBe(true);
      }
    }

    const earth = getImplementation('hero-earth-scenery')!;
    expect(earth.status).toBe('preview');
    expect(earth.route).toBe('/design/landing-v4');
    expect(earth.showOnRoadmap).toBe(false);
    expect(earth.evidence.some((e) => e.includes('heroEarthScene'))).toBe(true);
    expect(earth.description.toLowerCase()).toContain('three.js');
    expect(earth.description).toContain('Nicht mehr auf `/`');
  });

  it('keeps H1 and CTAs of the registry in sync with Landing v6', () => {
    const view = readFileSync(resolve('src/components/landing/v6/LandingV6View.tsx'), 'utf8');
    const hook = readFileSync(resolve('src/components/landing/v6/useLandingV6.ts'), 'utf8');
    const landing = getImplementation('public-landing')!;
    expect(view).toContain('>Das Governance OS für </span>');
    expect(view).toContain('>DSGVO & EU AI Act.</span>');
    expect(landing.description).toContain('Das Governance OS für DSGVO & EU AI Act.');
    expect(landing.description).toContain('/audit?source=landing-v6');
    expect(landing.description).toContain('/contact-sales?tier=enterprise');
    expect(hook).toContain('audit: `/audit?source=${SOURCE}`');
    expect(hook).toContain('const ENTERPRISE_HREF = `/contact-sales?tier=enterprise&source=${SOURCE}`;');
    expect(hook).toContain('enterprise: ENTERPRISE_HREF,');

    const cta = getImplementation('free-audit')!.ctaLabel!;
    expect(cta).toBe('Kostenlosen Governance Scan starten');
    expect(view).toContain(`>${cta}<`);

    for (const id of ['pricing-monthly', 'enterprise-inquiry'] as const) {
      const item = getImplementation(id)!;
      expect(item.evidence.some((e) => e.includes('landing/v6/')), id).toBe(true);
      expect(item.evidence.some((e) => e.includes('landing/v4/')), id).toBe(false);
    }
  });

  it('registers enterprise-sso as coming-soon (ADR 0007) and updates stripe-checkout-e2e migration evidence', () => {
    const sso = getImplementation('enterprise-sso')!;
    expect(sso).toBeDefined();
    expect(sso.status).toBe('coming-soon');
    expect(isImplementationLive('enterprise-sso')).toBe(false);
    expect(sso.description).toContain('ADR 0007');
    expect(sso.description).toContain('0 aktive Provider');
    expect(sso.description).toContain('signInWithSSO');
    expect(sso.description).toContain('sso-provision');
    expect(sso.description).toContain('tenant_sso_domains');
    expect(ROADMAP_COMING_SOON_ITEMS.some((i) => i.id === 'enterprise-sso')).toBe(true);
    expect(PUBLIC_ROADMAP_COPY['enterprise-sso'].de.description).toMatch(/Geplant:/);
    expect(PUBLIC_ROADMAP_COPY['enterprise-sso'].en.description).toMatch(/Planned:/);

    const stripeE2e = getImplementation('stripe-checkout-e2e')!;
    expect(stripeE2e.evidence).toContain(
      'supabase/migrations/20261020130000_stripe_live_net_exclusive_price_ids.sql',
    );
    expect(stripeE2e.evidence).not.toContain(
      'supabase/migrations/20260913000000_stripe_live_catalog_tax_inclusive_price_ids.sql',
    );
  });

  it('splits voice/telephony off channel-bots as coming soon', () => {
    const bots = getImplementation('channel-bots')!;
    expect(bots.name).not.toMatch(/Telefon/i);
    expect(PUBLIC_ROADMAP_COPY['channel-bots'].de.name).not.toMatch(/Telefon/i);
    expect(PUBLIC_ROADMAP_COPY['channel-bots'].en.name).not.toMatch(/phone/i);

    const voice = getImplementation('voice-telephony')!;
    expect(voice.status).toBe('coming-soon');
    expect(isImplementationLive('voice-telephony')).toBe(false);
    expect(voice.evidence).toEqual(
      expect.arrayContaining([
        'src/features/governance/voice/VoiceSessionsView.tsx',
        'src/pages/Features.tsx',
        'src/pages/Faq.tsx',
        'PR #1921',
      ]),
    );
    expect(voice.description).toMatch(/apps\/agent-runtime/);
    expect(voice.description).toMatch(/Nicht live/);
    expect(ROADMAP_COMING_SOON_ITEMS.some((i) => i.id === 'voice-telephony')).toBe(true);
    expect(getPublicRoadmapRoute(voice)).toBeUndefined();
  });

  it('registers the open beta: beta-enroll live, WP-4 still open', () => {
    const beta = getImplementation('beta-phase')!;
    expect(beta.status).toBe('preview');
    expect(beta.description).toContain('beta-enroll');
    expect(beta.description).toContain('31.01.2027');
    expect(beta.description).toMatch(/WP-4/);
    expect(beta.description).toMatch(/noch nicht vollständig/);
    expect(beta.description).toContain('BetaFeedback');
    expect(beta.description).toContain('/admin/beta-feedback');
    expect(beta.description).not.toContain('bisher Link auf /kontakt?topic=beta-feedback');
    expect(beta.evidence).toContain('PR #1874');
    expect(beta.evidence).toContain('PR #1989');
    expect(beta.evidence).toContain('PR #1990');
    // Owner-Entscheidung 21.10.2026: Beta-Angebot bleibt öffentlich, Listenpreise unverändert.
    const monthly = getImplementation('pricing-monthly')!;
    expect(monthly.description).toContain('BETA.publicOffer = true');
    expect(monthly.description).toContain('€79 / €249 / €699');
    expect(existsSync(resolve('supabase/functions/beta-enroll/index.ts'))).toBe(true);
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

  it('registers KI-Register live and Kodee preview with SSH from Agency', () => {
    const reg = getImplementation('ai-system-registry')!;
    expect(reg.status).toBe('live');
    expect(reg.route).toBe('/app/ai-systems');
    expect(reg.description).toContain('classify_asset');
    expect(reg.evidence.some((e) => e.includes('governance-resources/index.ts#classify_asset'))).toBe(true);
    expect(getImplementation('ai-act-inventory-persist')?.description).toContain('/app/risk-inventory');

    const kodee = getImplementation('kodee')!;
    expect(kodee.status).toBe('preview');
    expect(kodee.route).toBe('/kodee');
    expect(kodee.description).toContain('ai.tool.vps_status');
    expect(kodee.description).not.toMatch(/ab Enterprise/);
    expect(kodee.evidence).toContain('supabase/functions/kodee/index.ts');
    expect(ROADMAP_PREVIEW_ITEMS.some((i) => i.id === 'kodee')).toBe(true);
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
    expect(docs).toContain('Landing v6');
    expect(docs).toContain('Das Governance OS für DSGVO & EU AI Act.');
    expect(docs).not.toContain('AI Compliance Operations OS for Europe');
    expect(docs).toContain('2026-10-18');
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
        // The registry entry itself must exist, so the DE fallback cannot mask a missing EN text.
        expect(PUBLIC_ROADMAP_COPY[item.id]?.[lang], `${item.id}.${lang} registry entry`).toBeTruthy();
        const copy = getPublicRoadmapCopy(item, lang);
        expect(copy, `${item.id}.${lang} public copy`).toBeDefined();
        if (!copy) continue;
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

  it('skips (does not throw for) items without public roadmap copy', () => {
    const base = getImplementation('free-audit')!;
    const orphan = { ...base, id: 'test-no-public-copy', status: 'coming-soon' as const };
    expect(PUBLIC_ROADMAP_COPY[orphan.id]).toBeUndefined();
    for (const lang of ['de', 'en'] as const) {
      expect(() => getPublicRoadmapCopy(orphan, lang)).not.toThrow();
      expect(getPublicRoadmapCopy(orphan, lang)).toBeUndefined();
    }
    // Never falls back to internal registry name/description.
    expect(getPublicRoadmapCopy(base, 'de')?.description).not.toBe(base.description);
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
    expect(i18n).toContain("v4HeroTitleEm: 'und nachweisen.'");
    expect(i18n).toContain("v4HeroTitleEm: 'with clear evidence.'");
    expect(i18n).toContain("v4HeroTitleA: 'Risiken auf Ihrer Website'");
    expect(i18n).toContain("v4HeroTitleB: 'und bei KI erkennen'");
    expect(sections).toContain('Free Audit starten');
    expect(sections).toContain("t('v4HeroSecondaryCta')");
    expect(sections).not.toContain('Live Dashboard ansehen');
    expect(sections).not.toContain('/demo-tour/dashboard');
    const landing = getImplementation('public-landing')!;
    expect(landing.description).toContain('/audit');
    expect(landing.description).not.toContain('/demo-tour/dashboard');
    const content = readFileSync(
      resolve('src/components/landing/v4/landing-v4-content.ts'),
      'utf8',
    );
    expect(content).toContain('/ai-act-klassifikator');
    expect(content).not.toMatch(/als Inventar führen/);
  });
});
