/**
 * Regression: /unternehmen/ is a static public page. It must not ship a
 * competing onboarding wizard when the canonical Voice setup is a separate
 * six-step page on voice.realsyncdynamicsai.de.
 *
 * This tests the actual public/unternehmen files (not the React SPA variant).
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import vm from 'node:vm';
import { describe, it, expect } from 'vitest';

const root = resolve(__dirname, '../..');
const html = readFileSync(resolve(root, 'public/unternehmen/index.html'), 'utf8');
const js = readFileSync(resolve(root, 'public/unternehmen/unternehmen.js'), 'utf8');

describe('Static company Voice setup uses the canonical six-step onboarding', () => {
  it('offers exactly six explanatory steps and an external, safe CTA', () => {
    expect((html.match(/<li><b>0[1-6]<\/b><span>/g) ?? [])).toHaveLength(6);
    expect(html).toContain('aria-label="Sechs Schritte der Voice-Agent-Einrichtung"');
    expect(html).toContain('href="https://voice.realsyncdynamicsai.de/onboarding.html"');
    expect(html).toContain('rel="noopener noreferrer"');
    expect(html).toContain('target="_blank"');
  });

  it('does not silently ship the obsolete four-step wizard', () => {
    expect(html).not.toContain('Ihr Agent in vier Schritten');
    expect(html).not.toContain('id="onb"');
    expect(js).not.toContain("const onb = document.getElementById('onb')");
    expect(js).not.toContain("getElementById('s-branche')");
    expect(html).toContain('Telefonie, Anrufannahme und Checkout werden dadurch nicht aktiviert');
  });

  it('retains its existing audio example and has responsive navigation', () => {
    expect(js).toContain("getElementById('v-run')");
    expect(html).toContain('.voice-entry-steps');
    expect(html).toContain('@media (max-width:560px)');
  });

  it('links every footer legal item to an existing route instead of dead fragments', () => {
    const urls = [
      '/impressum', '/datenschutz', '/agb', '/widerruf',
      '/legal/avv', '/legal/sub-processors',
    ];
    for (const href of urls) expect(html).toContain(`href="${href}"`);
    for (const dead of ['r-impressum', 'datenschutz', 'agb', 'widerruf', 'avv', 'subproc']) {
      expect(html).not.toContain(`href="#${dead}"`);
    }
  });

  it('compiles its existing browser JavaScript', () => {
    expect(() => new vm.Script(js, { filename: 'unternehmen.js' })).not.toThrow();
  });
});
