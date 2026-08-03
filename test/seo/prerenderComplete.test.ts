import { describe, it, expect } from 'vitest';
import { looksComplete } from '../../scripts/prerender.mjs';

/**
 * `looksComplete` entscheidet, ob eine prerenderte Seite als fertig gilt.
 *
 * Hintergrund (2026-08-03): `networkidle` ist im Prerender bewusst tolerant —
 * läuft es ab, wurde vorher stillschweigend gespeichert, was gerade im DOM
 * stand. Auf dem Cloudflare-Pages-Preview kam /claude-code-optimizer so mit
 * 18 kB und ohne <h1> an, während lokal 42 kB mit <h1> entstanden. Seitdem
 * prüft der Prerender das Ergebnis und wiederholt einmal mit längerem
 * Timeout.
 *
 * Dieses Kriterium darf nicht unbemerkt aufweichen: würde `looksComplete`
 * pauschal true liefern, wäre der Retry wirkungslos und halb gerenderte
 * Seiten gingen wieder still raus.
 */
describe('looksComplete', () => {
  it('erkennt den halb gerenderten Zustand: DOM da, aber noch kein h1', () => {
    const partial = `<!doctype html><html><head><title>Claude Code Optimizer</title></head>
<body><div id="root"><nav class="landing-nav"><a href="/">Start</a></nav>
<div class="skeleton" /></div></body></html>`;

    expect(looksComplete(partial)).toBe(false);
  });

  it('erkennt den leeren SPA-Shell', () => {
    expect(looksComplete('<!doctype html><html><body><div id="root"></div></body></html>')).toBe(false);
  });

  it('akzeptiert eine fertig gerenderte Seite', () => {
    const done = '<html><body><div id="root"><h1 class="text-4xl">Claude Code Optimizer</h1><p>…</p></div></body></html>';

    expect(looksComplete(done)).toBe(true);
  });

  it('akzeptiert <h1> ohne Attribute', () => {
    expect(looksComplete('<body><h1>Titel</h1></body>')).toBe(true);
  });

  it('lässt sich nicht von einem ähnlich beginnenden Tag täuschen', () => {
    // <h1abc> gibt es nicht, aber eine zu lockere Regex (/<h1/) würde hier
    // fälschlich anschlagen — und auch bei Attributen wie <div h1-ish>.
    expect(looksComplete('<body><h1x>kein Heading</h1x></body>')).toBe(false);
  });
});
