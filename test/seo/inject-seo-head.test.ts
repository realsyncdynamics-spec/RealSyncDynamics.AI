/**
 * Tests fuer scripts/inject-seo-head.mts — die deterministische SEO-<head>-
 * Injektion, die im GitHub-Pages-Deploy (deploy-pages.yml) die korrekten
 * Canonicals/Titel pro Route in dist/<route>/index.html schreibt.
 *
 * Hintergrund: Vor diesem Fix lieferte jede Route den SPA-Shell mit
 * <link rel="canonical" href=".../"> aus — alle Unterseiten kanonisierten
 * auf Root. Diese Tests pinnen die Kern-Invarianten: korrekte Brand-Suffixe,
 * Alias-Konsolidierung, Self-Canonical fuer DEFAULT_SEO-Routes und genau ein
 * Canonical-Tag nach Injektion.
 */
import { describe, it, expect } from 'vitest';
import {
  esc,
  withBrand,
  absUrl,
  resolveHead,
  injectHead,
} from '../../scripts/inject-seo-head.mts';
import { SEO_CONFIG, getSeoForPath } from '../../src/config/seo';

const SHELL = `<!doctype html><html><head>
  <title>RealSyncDynamics.AI — Runtime-native AI-Governance-Plattform</title>
  <meta name="description" content="default desc" />
  <meta property="og:title" content="og default" />
  <meta property="og:description" content="og desc default" />
  <meta property="og:url" content="https://realsyncdynamicsai.de/" />
  <meta name="twitter:title" content="tw default" />
  <meta name="twitter:description" content="tw desc default" />
  <link rel="canonical" href="https://realsyncdynamicsai.de/" />
</head><body></body></html>`;

describe('esc', () => {
  it('escaped Ampersand, Quotes und Winkelklammern', () => {
    expect(esc('DSGVO & "AI Act" <x>')).toBe('DSGVO &amp; &quot;AI Act&quot; &lt;x&gt;');
  });
});

describe('withBrand', () => {
  it('haengt Brand-Suffix nur an, wenn nicht bereits vorhanden', () => {
    expect(withBrand('Preise | RealSyncDynamics.AI')).toBe('Preise | RealSyncDynamics.AI');
    expect(withBrand('Foo | RealSyncDynamicsAI')).toBe('Foo | RealSyncDynamicsAI');
    expect(withBrand('Behörden-KI')).toBe('Behörden-KI — RealSyncDynamics.AI');
  });
});

describe('absUrl', () => {
  it('nutzt configuriertes Canonical, sonst self-canonical aus Route', () => {
    expect(absUrl('https://realsyncdynamicsai.de/pricing', '/pricing'))
      .toBe('https://realsyncdynamicsai.de/pricing');
    expect(absUrl(undefined, '/ai-act-klassifikator'))
      .toBe('https://realsyncdynamicsai.de/ai-act-klassifikator');
    expect(absUrl(undefined, '/')).toBe('https://realsyncdynamicsai.de/');
  });
});

describe('resolveHead', () => {
  it('Alias-Route kanonisiert auf Primary-URL', () => {
    const head = resolveHead('/behoerden', getSeoForPath('/behoerden'));
    expect(head.canonical).toBe('https://realsyncdynamicsai.de/oeffentliche-verwaltung');
  });

  it('DEFAULT_SEO-Route (ohne eigenen Eintrag) wird self-canonical statt Root', () => {
    const head = resolveHead('/ai-act-klassifikator', getSeoForPath('/ai-act-klassifikator'));
    expect(head.canonical).toBe('https://realsyncdynamicsai.de/ai-act-klassifikator');
  });
});

describe('injectHead', () => {
  it('ersetzt Canonical + og:url und haelt genau ein Canonical-Tag', () => {
    const head = resolveHead('/pricing', getSeoForPath('/pricing'));
    const out = injectHead(SHELL, head, '/pricing');
    expect((out.match(/<link rel="canonical"/g) ?? []).length).toBe(1);
    expect(out).toContain('<link rel="canonical" href="https://realsyncdynamicsai.de/pricing" />');
    expect(out).toContain('<meta property="og:url" content="https://realsyncdynamicsai.de/pricing" />');
    expect(out).not.toContain('href="https://realsyncdynamicsai.de/" />');
  });

  it('wirft, wenn ein erwartetes Tag im Shell fehlt (Template-Drift-Guard)', () => {
    const head = resolveHead('/pricing', getSeoForPath('/pricing'));
    expect(() => injectHead('<html><head></head></html>', head, '/pricing')).toThrow();
  });
});

describe('SEO_CONFIG Invarianten', () => {
  it('jede Route hat eine non-empty Description', () => {
    for (const [route, cfg] of Object.entries(SEO_CONFIG)) {
      expect(cfg.description.length, `${route} description`).toBeGreaterThan(0);
    }
  });

  it('jedes Alias-Canonical zeigt auf einen Pfad mit eigenem SEO_CONFIG-Eintrag', () => {
    for (const [route, cfg] of Object.entries(SEO_CONFIG)) {
      if (!cfg.canonical) continue;
      const path = cfg.canonical.replace('https://realsyncdynamicsai.de', '');
      // Self-canonical ist immer ok; Alias muss auf einen existierenden
      // Primary-Eintrag zeigen (kein Verweis ins Leere).
      if (path !== route) {
        expect(SEO_CONFIG[path], `${route} -> ${path}`).toBeDefined();
      }
    }
  });
});
