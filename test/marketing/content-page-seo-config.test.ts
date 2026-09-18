import { describe, expect, it } from 'vitest';

import { SEO_CONFIG } from '../../src/config/seo';

describe('Public content hubs have route-specific SEO config', () => {
  it.each([
    '/ai-act-governance',
    '/agent-governance',
    '/governance-graph',
    '/evidence-vault',
    '/policy-engine',
    '/deployment-governance',
  ])('%s has a dedicated canonical SEO entry', (path) => {
    const entry = SEO_CONFIG[path];
    expect(entry, `${path} fehlt in SEO_CONFIG`).toBeDefined();
    expect(entry?.canonical).toContain(path);
    expect(entry?.title).not.toBe('RealSyncDynamics.AI — Das Governance OS für DSGVO & EU AI Act');
    expect(entry?.description).not.toBe(
      'Das Governance OS für DSGVO und EU AI Act: AI-Systeme, Websites, Agents und Datenflüsse erfassen, Risiken bewerten, Governance durchsetzen und Nachweise führen.',
    );
  });
});
