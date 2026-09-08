import type { OsCapability } from './types';

export type IntentSignals = {
  website: boolean;
  seo: boolean;
  governance: boolean;
  deploy: boolean;
};

export function classifyIntent(text: string): IntentSignals {
  const t = text.toLowerCase();
  return {
    website:
      t.includes('website') ||
      t.includes('landingpage') ||
      t.includes('landing page') ||
      t.includes('frontend') ||
      t.includes('saas'),
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
  if (signals.website) {
    out.push('Website', 'Design', 'Code');
  }
  if (signals.seo) out.push('SEO');
  if (signals.governance) out.push('Governance');
  if (signals.deploy) out.push('Deployment');
  return [...new Set(out)];
}
