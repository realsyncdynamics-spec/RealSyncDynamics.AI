/**
 * /ai-business-os — Produktseite für branchenspezifische AI Business Dashboards.
 *
 * Gesichert wird: Die Seite ist geroutet, hat eigene Meta-Daten, steht in der
 * Sitemap, und jede Branchen-Vorschau nennt eine menschliche Kontrollgrenze.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { DEFAULT_SEO, getSeoForPath } from '../../src/config/seo';
import { COCKPITS } from '../../src/components/business-os/cockpits';

const root = resolve(__dirname, '../..');
const app = readFileSync(resolve(root, 'src/App.tsx'), 'utf8');
const sitemap = readFileSync(resolve(root, 'public/sitemap.xml'), 'utf8');

describe('/ai-business-os', () => {
  it('ist geroutet und steht in der Sitemap', () => {
    expect(app).toContain('path="/ai-business-os"');
    expect(sitemap).toContain('<loc>https://realsyncdynamicsai.de/ai-business-os</loc>');
  });

  it('hat eigene Meta-Daten', () => {
    const seo = getSeoForPath('/ai-business-os');
    expect(seo.title).not.toBe(DEFAULT_SEO.title);
    expect(seo.description).not.toBe(DEFAULT_SEO.description);
  });

  it('zeigt fünf Branchen mit eindeutigen IDs', () => {
    expect(COCKPITS).toHaveLength(5);
    expect(new Set(COCKPITS.map((c) => c.id)).size).toBe(COCKPITS.length);
  });

  it('nennt je Branche eine Kontrollgrenze und mindestens einen Agenten mit Freigabe', () => {
    for (const c of COCKPITS) {
      expect(c.guardrail.trim(), c.id).not.toBe('');
      expect(
        c.agents.some((a) => a.status === 'approval'),
        `${c.id} ohne Agent, der auf Freigabe wartet`,
      ).toBe(true);
    }
  });
});
