import { describe, expect, it } from 'vitest';
import { architecture, parseHtml } from '../../src/features/photoreal-builder/parse';

const SAMPLE = `<!doctype html><html lang="de"><head>
<title>Atelier Nord | Keramik</title>
<meta name="description" content="Unikate aus Thüringen. Keramik, Objekt, Ateliertermine."/>
<meta name="theme-color" content="#3f5c4d"/>
<meta property="og:image" content="https://atelier-nord.de/img/ofen.jpg"/>
</head><body>
<img src="/img/werkbank.jpg" alt="Werkbank"/>
<nav><a href="/">Home</a><a href="/keramik">Keramik</a><a href="/kontakt">Kontakt</a><a href="/impressum">Impressum</a></nav>
<h1>Atelier Nord</h1>
<h2>Keramik</h2>
<p>Wir brennen Unikate in kleinem Ofen. Jedes Stück ist nummeriert und bleibt in der Region.</p>
<h2>Ateliertermine</h2>
<p>Besuche nach Vereinbarung. Kein Shop-Tracking, Anfragen per Mail.</p>
<footer>Impressum · Datenschutz · hello@atelier-nord.de · 03679 123456 · 98724 Neuhaus</footer>
</body></html>`;

describe('rebuild parse', () => {
  it('extracts business facts without cloning nav chrome as services', () => {
    const m = parseHtml('https://atelier-nord.de', SAMPLE);
    expect(m.fetched).toBe(true);
    expect(m.company).toBe('Atelier Nord');
    expect(m.description).toMatch(/Unikate/);
    expect(m.services.some((s) => /Keramik/i.test(s.title))).toBe(true);
    expect(m.hasImpressum).toBe(true);
    expect(m.hasDatenschutz).toBe(true);
    expect(m.emails.includes('hello@atelier-nord.de')).toBe(true);
    expect(m.address).toBe('98724 Neuhaus');
    expect(m.photos.some((p) => p.includes('ofen.jpg'))).toBe(true);
    expect(m.photos.some((p) => p.includes('werkbank.jpg'))).toBe(true);
  });

  it('builds a new IA independent of the old menu order', () => {
    const m = parseHtml('https://atelier-nord.de', SAMPLE);
    expect(architecture(m).map((p) => p.id)).toEqual(['home', 'leistungen', 'ueber', 'kontakt', 'recht']);
  });
});
