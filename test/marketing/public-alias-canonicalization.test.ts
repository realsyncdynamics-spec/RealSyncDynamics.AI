import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { SEO_CONFIG } from '../../src/config/seo';

const ROOT = resolve(__dirname, '../..');
const app = readFileSync(resolve(ROOT, 'src/App.tsx'), 'utf8');
const redirects = readFileSync(resolve(ROOT, 'public/_redirects'), 'utf8');
const sitemap = readFileSync(resolve(ROOT, 'public/sitemap.xml'), 'utf8');

describe('Public route aliases stay canonicalized', () => {
  it.each([
    ['/resources', '/ressourcen'],
    ['/digital-sovereignty', '/digitale-souveraenitaet'],
    ['/governance-complexity-score', '/governance-score'],
  ])('%s redirects in App.tsx to %s', (alias, canonical) => {
    expect(app).toMatch(
      new RegExp(`path="${alias.replace('/', '\\/')}"\\s+element=\\{<Navigate to="${canonical.replace('/', '\\/')}" replace \\/>\\}`),
    );
  });

  it.each([
    ['/resources', '/ressourcen'],
    ['/digital-sovereignty', '/digitale-souveraenitaet'],
    ['/governance-complexity-score', '/governance-score'],
  ])('%s has an edge 301 to %s', (alias, canonical) => {
    expect(redirects).toMatch(new RegExp(`^${alias}\\s+${canonical}\\s+301$`, 'm'));
    expect(redirects.indexOf(alias)).toBeLessThan(redirects.indexOf('/*  /index.html'));
  });

  it('keeps only the canonical Ressourcen hub in sitemap and SEO config', () => {
    expect(sitemap).toContain('https://realsyncdynamicsai.de/ressourcen');
    expect(sitemap).not.toContain('https://realsyncdynamicsai.de/resources');
    expect(SEO_CONFIG['/resources']).toBeUndefined();
    expect(SEO_CONFIG['/ressourcen']?.canonical).toContain('/ressourcen');
  });
});
