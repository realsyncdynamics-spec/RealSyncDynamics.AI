import { detectDesignInputMode } from './design/designState';
import type { OsCapability } from './types';

export type IntentSignals = {
  website: boolean;
  design: boolean;
  building: boolean;
  seo: boolean;
  governance: boolean;
  deploy: boolean;
};

export function classifyIntent(text: string): IntentSignals {
  const t = text.toLowerCase();
  const building =
    t.includes('baue') ||
    t.includes('build') ||
    t.includes('erstelle') ||
    t.includes('create') ||
    t.includes('generate') ||
    t.includes('nachbauen');
  const websiteMention =
    t.includes('website') ||
    t.includes('landingpage') ||
    t.includes('landing page') ||
    t.includes('frontend') ||
    t.includes('saas');
  const design =
    t.includes('landingpage') ||
    t.includes('landing page') ||
    t.includes('design') ||
    t.includes('hero') ||
    t.includes('wireframe') ||
    t.includes('mockup') ||
    (websiteMention && building) ||
    (detectDesignInputMode(text) !== 'prompt' && building);

  return {
    website: websiteMention,
    design,
    building,
    seo:
      t.includes('seo') ||
      t.includes('google') ||
      t.includes('sichtbarkeit') ||
      t.includes('visibility'),
    governance:
      t.includes('dsgvo') ||
      t.includes('gdpr') ||
      t.includes('ai act') ||
      t.includes('compliance') ||
      t.includes('governance'),
    deploy:
      t.includes('deploy') ||
      t.includes('veröff') ||
      t.includes('publish'),
  };
}

export function detectCapabilities(text: string): OsCapability[] {
  const signals = classifyIntent(text);
  const out: OsCapability[] = [];
  if (signals.website || signals.design) out.push('Website');
  if (signals.design) out.push('Design');
  if (signals.building || text.toLowerCase().includes('frontend')) out.push('Code');
  if (signals.seo) out.push('SEO');
  if (signals.governance) out.push('Governance');
  if (signals.deploy) out.push('Deployment');
  return [...new Set(out)];
}
