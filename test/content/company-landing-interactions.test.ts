// @vitest-environment node
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const read = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8');
const html = read('public/unternehmen/index.html');
const js = read('public/unternehmen/unternehmen.js');
const builder = read('src/pages/frontend-builder/FrontendBuilderLanding.tsx');

describe('Unternehmensseite – keine unverbundenen Einstiege', () => {
  it('hat keine pauschalen EU-Hosting-Aussagen mehr', () => {
    for (const claim of ['Hosting in Europa', 'Betrieb und Daten in Europa', 'DATEN IN DER EU', '<span>Daten in Europa</span>']) {
      expect(html).not.toContain(claim);
    }
    expect(html).toContain('Datenverarbeitung und eingesetzte KI-Anbieter richten sich nach dem jeweiligen Dienst');
  });

  it('verknüpft alle internen Anker mit einem Abschnitt, einem Modal oder einer dokumentierten Route', () => {
    const ids = new Set([...html.matchAll(/\\bid="([^"]+)"/g)].map((m) => m[1]));
    const routes = new Set(['governance-os', 'audit', 'builder', 'login', 'r-impressum', 'datenschutz', 'agb', 'widerruf', 'avv', 'subproc']);
    for (const match of html.matchAll(/<a\\b[^>]*href="#([^"]+)"[^>]*>/g)) {
      const key = match[1]!;
      const element = match[0];
      expect(ids.has(key) || routes.has(key) || element.includes('data-open=')).toBe(true);
    }
  });

  it('leitet die ausgewählte Vorlage zum echten Anfrageprozess weiter', () => {
    expect(html).toContain('id="tpl-go" href="/frontend-builder#builder"');
    expect(js).toContain("go.href = '/frontend-builder'");
    expect(js).toContain("encodeURIComponent(key)");
    expect(builder).toContain("new URLSearchParams(window.location.search).get('vorlage')");
    for (const key of ['gastro', 'handwerk', 'praxis']) {
      expect(html).toContain('data-tpl="' + key + '"');
      expect(js).toContain("'" + key + "'");
      expect(builder).toContain(key + ':');
    }
    expect(builder).toContain('message:');
  });

  it('kennzeichnet nicht vorhandene Vorschauen ehrlich und hat keinen leeren Click-Handler', () => {
    expect(html).not.toContain('Vorschau folgt');
    expect(html).toContain('Beispielvorlage · Demo');
    expect(js).not.toContain("addEventListener('click', () => {})");
  });
});
