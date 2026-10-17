import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const read = (path: string): string => readFileSync(resolve(process.cwd(), path), 'utf8');

describe('Classical v4 public design surfaces', () => {
  it('reuses the central v4 brand tokens without modifying the locked homepage', () => {
    const css = read('src/styles/brand-classical-public.css');
    expect(css).toContain('var(--brand-paper)');
    expect(css).toContain('var(--brand-ink)');
    expect(css).toContain('var(--brand-gold-ink)');
    expect(css).toContain('var(--brand-serif)');
    expect(css).toContain('var(--brand-body)');
    expect(css).not.toMatch(/(?:^|\n)\s*\.gv4\s*[{,]/);
  });

  it('applies the new typography to shared product and SEO shells', () => {
    const product = read('src/components/PageShell.tsx');
    const seo = read('src/pages/seo/SeoPageShell.tsx');
    for (const shell of [product, seo]) {
      expect(shell).toContain('brand-classical-public.css');
      expect(shell).toContain('rs-classical-page');
      expect(shell).toContain('rs-classical-title');
      expect(shell).toContain('rs-classical-eyebrow');
    }
    expect(seo).toContain('rs-classical-prose');
  });

  it('gives the SEO CTA and FAQ their own contrast-safe skins', () => {
    const css = read('src/styles/brand-classical-public.css');
    const cta = read('src/components/sections/AuditCTA.tsx');
    const faq = read('src/components/sections/ComplianceFAQ.tsx');
    expect(cta).toContain('rs-classical-cta-section');
    expect(faq).toContain('rs-classical-faq');
    expect(css).toContain('.rs-classical-seo .rs-classical-cta-section');
    expect(css).toContain('.rs-classical-seo .rs-classical-faq details');
  });
});
