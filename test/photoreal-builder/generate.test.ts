import { describe, expect, it } from 'vitest';
import { DESIGN_VARIANTS } from '../../src/features/photoreal-builder/design-variants';
import { generateRebuildHtml, qualityGate } from '../../src/features/photoreal-builder/generate';
import { parseHtml } from '../../src/features/photoreal-builder/parse';

const SAMPLE = `<!doctype html><html lang="de"><head>
<title>Atelier Nord | Keramik</title>
<meta name="description" content="Unikate aus Thüringen. Keramik, Objekt, Ateliertermine."/>
</head><body>
<h1>Atelier Nord</h1>
<h2>Keramik</h2>
<p>Wir brennen Unikate in kleinem Ofen. Jedes Stück ist nummeriert und bleibt in der Region.</p>
<footer>Impressum · Datenschutz · hello@atelier-nord.de</footer>
</body></html>`;

describe('photoreal generate', () => {
  it('rebuilds a photoreal page from parsed facts without cloning the old chrome', () => {
    const model = parseHtml('https://atelier-nord.de', SAMPLE);
    const html = generateRebuildHtml(model, DESIGN_VARIANTS[0], { hero: '/landings/hero-minimal.jpg' });
    expect(html).toContain('Atelier Nord');
    expect(html).toContain('Keramik');
    expect(html).not.toMatch(/lorem ipsum/i);
    expect(html).toContain('/landings/hero-minimal.jpg');
    expect(html).toContain('data-page="home"');
    expect(html).toContain('data-page="kontakt"');
    expect(qualityGate(model).some((c) => c.id === 'impressum' && c.ok)).toBe(true);
  });
});
