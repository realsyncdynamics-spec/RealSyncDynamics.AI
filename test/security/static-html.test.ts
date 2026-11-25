import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PRINT_MARKER, isDangerousUrl, toStaticHtmlDocument } from '../../src/lib/static-html';
import { previewCsp } from '../../src/lib/preview-sandbox';

/**
 * Negativ-Tests für generierte Dokumente (P0, PR #2433).
 *
 * Jeder Fall beschreibt einen Weg, auf dem eingeschleustes HTML in einem
 * `blob:`-Tab mit der Herkunft der Anwendung Skript ausführen oder den Nutzer
 * wegleiten könnte. Erwartet wird jeweils: nicht mehr im Ergebnis.
 */

function parse(html: string): Document {
  return new DOMParser().parseFromString(toStaticHtmlDocument(html), 'text/html');
}

describe('toStaticHtmlDocument entfernt aktive Inhalte', () => {
  it('entfernt <script> im Kopf und im Körper', () => {
    const out = toStaticHtmlDocument(
      '<html><head><script>alert(1)</script></head><body><p>DSE</p><script src="https://x.example/a.js"></script></body></html>',
    );
    expect(out).not.toMatch(/<script/i);
    expect(out).toContain('<p>DSE</p>');
  });

  it('entfernt ein Skript, das vor <head> steht', () => {
    const out = toStaticHtmlDocument('<script>steal()</script><html><head></head><body>x</body></html>');
    expect(out).not.toMatch(/steal\(\)/);
  });

  it('entfernt Skripte in SVG', () => {
    const out = toStaticHtmlDocument('<svg><script>alert(1)</script><circle r="1"/></svg>');
    expect(out).not.toMatch(/<script/i);
  });

  it('entfernt alle on*-Ereignisattribute', () => {
    const doc = parse('<img src="x.png" onerror="alert(1)"><body onload="alert(2)"><a onclick="x()">a</a></body>');
    expect(doc.querySelectorAll('[onerror],[onload],[onclick]').length).toBe(0);
  });

  it('entfernt javascript:- und vbscript:-Adressen, auch mit Steuerzeichen', () => {
    const doc = parse(
      '<a id="a" href="javascript:alert(1)">1</a><a id="b" href=" java\tscript:alert(1)">2</a><a id="c" href="VBScript:x">3</a>',
    );
    for (const id of ['a', 'b', 'c']) expect(doc.getElementById(id)?.hasAttribute('href')).toBe(false);
  });

  it('entfernt data:text/html, lässt aber Rasterbilder in src', () => {
    const doc = parse(
      '<a id="l" href="data:text/html,<script>alert(1)</script>">x</a><img id="i" src="data:image/png;base64,AAAA">',
    );
    expect(doc.getElementById('l')?.hasAttribute('href')).toBe(false);
    expect(doc.getElementById('i')?.getAttribute('src')).toBe('data:image/png;base64,AAAA');
  });

  it('entfernt eingebettete Rahmen, Objekte und srcdoc', () => {
    const out = toStaticHtmlDocument(
      '<iframe srcdoc="<script>alert(1)</script>"></iframe><object data="x"></object><embed src="x"><frameset></frameset>',
    );
    expect(out).not.toMatch(/<(iframe|object|embed|frameset)/i);
    expect(out).not.toMatch(/srcdoc/i);
  });

  it('entfernt Meta-Weiterleitungen und fremde CSP, damit nur unsere gilt', () => {
    const doc = parse(
      '<head><meta http-equiv="refresh" content="0;url=https://phish.example"><meta http-equiv="Content-Security-Policy" content="script-src *"></head>',
    );
    const metas = Array.from(doc.querySelectorAll('meta[http-equiv]'));
    expect(metas).toHaveLength(1);
    expect(metas[0].getAttribute('content')).toBe(previewCsp('static'));
  });

  it('entfernt <base> und <link>, damit nichts umgeleitet oder nachgeladen wird', () => {
    const out = toStaticHtmlDocument('<head><base href="https://evil.example/"><link rel="stylesheet" href="https://x/a.css"></head>');
    expect(out).not.toMatch(/<(base|link)\b/i);
  });
});

describe('Mutation-XSS: auch nach erneutem Parsen nichts Aktives', () => {
  const MXSS = [
    '<math><mtext><table><mglyph><style><img src=x onerror="alert(1)">',
    '<noscript><p title="</noscript><img src=x onerror=alert(1)>">',
    '<svg></p><style><a id="</style><img src=1 onerror=alert(1)>">',
    '<form><math><mtext></form><form><mglyph><style></math><img src onerror=alert(1)>',
    '<svg><a><animate attributeName=href values=javascript:alert(1) /><text y=20>c</text></a></svg>',
  ];

  for (const payload of MXSS) {
    it(`bleibt sauber: ${payload.slice(0, 40)}`, () => {
      const doc = parse(payload);
      const active = Array.from(doc.querySelectorAll('*')).flatMap((el) =>
        Array.from(el.attributes)
          .filter((a) => /^on/i.test(a.name) || /javascript:/i.test(a.value))
          .map((a) => `${el.tagName}.${a.name}`),
      );
      expect(active).toEqual([]);
      expect(doc.querySelectorAll('script,math,noscript,animate').length).toBe(0);
    });
  }

  it('ist ein Fixpunkt: zweimal bereinigt ergibt dasselbe', () => {
    const once = toStaticHtmlDocument('<p>a</p><svg><circle r="1"/></svg>');
    const reparsedBody = new DOMParser().parseFromString(once, 'text/html').body.innerHTML;
    expect(new DOMParser().parseFromString(toStaticHtmlDocument(once), 'text/html').body.innerHTML).toBe(reparsedBody);
  });
});

describe('CSP steht als erstes Kopf-Element', () => {
  it('setzt die statische CSP mit script-src none an den Anfang', () => {
    const doc = parse('<html><head><title>T</title><style>p{}</style></head><body>x</body></html>');
    const first = doc.head.firstElementChild;
    expect(first?.tagName).toBe('META');
    expect(first?.getAttribute('http-equiv')).toBe('Content-Security-Policy');
    expect(first?.getAttribute('content')).toContain("script-src 'none'");
    expect(first?.getAttribute('content')).toContain("default-src 'none'");
  });

  it('schützt auch ein Fragment ohne html- und head-Element', () => {
    const doc = parse('<h1>Nur Text</h1>');
    expect(doc.head.firstElementChild?.getAttribute('http-equiv')).toBe('Content-Security-Policy');
    expect(doc.body.innerHTML).toContain('<h1>Nur Text</h1>');
  });

  it('erhält Gestaltung und Inhalt eines normalen Dokuments', () => {
    const out = toStaticHtmlDocument(
      '<!doctype html><html lang="de"><head><style>h1{color:#000}</style></head><body><h1>Datenschutzerklärung</h1><a href="https://example.com/impressum">Impressum</a></body></html>',
    );
    expect(out.startsWith('<!doctype html>')).toBe(true);
    expect(out).toContain('<style>h1{color:#000}</style>');
    expect(out).toContain('href="https://example.com/impressum"');
    expect(out).toContain('lang="de"');
  });
});

describe('Druck-Buttons der Berichte', () => {
  it('ersetzt onclick="window.print()" durch ein Kennzeichen ohne Code', () => {
    const doc = parse('<button id="p" onclick="window.print()">Drucken</button>');
    const btn = doc.getElementById('p');
    expect(btn?.hasAttribute('onclick')).toBe(false);
    expect(btn?.hasAttribute(PRINT_MARKER)).toBe(true);
  });

  it('kennzeichnet keine anderen Handler, die nur ähnlich aussehen', () => {
    const doc = parse('<button id="p" onclick="window.print();fetch(\'//x\')">x</button>');
    expect(doc.getElementById('p')?.hasAttribute(PRINT_MARKER)).toBe(false);
    expect(doc.getElementById('p')?.hasAttribute('onclick')).toBe(false);
  });
});

describe('isDangerousUrl', () => {
  it('lässt normale Adressen zu', () => {
    expect(isDangerousUrl('https://example.com', 'href')).toBe(false);
    expect(isDangerousUrl('mailto:info@example.com', 'href')).toBe(false);
    expect(isDangerousUrl('#abschnitt', 'href')).toBe(false);
  });

  it('erlaubt data:-Bilder nur in src, nicht in href', () => {
    expect(isDangerousUrl('data:image/png;base64,AA', 'src')).toBe(false);
    expect(isDangerousUrl('data:image/png;base64,AA', 'href')).toBe(true);
    expect(isDangerousUrl('data:image/svg+xml;base64,AA', 'src')).toBe(true);
  });
});

describe('Kein ungeschütztes text/html-Blob im Repository', () => {
  const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'src');
  const ALLOWED = new Set(['lib/static-html.ts']);

  function walk(dir: string): string[] {
    return readdirSync(dir).flatMap((name) => {
      const full = join(dir, name);
      if (statSync(full).isDirectory()) return walk(full);
      return /\.(ts|tsx)$/.test(name) ? [full] : [];
    });
  }

  it('erzeugt HTML-Blobs nur über src/lib/static-html.ts', () => {
    const offenders = walk(ROOT)
      .filter((file) => !ALLOWED.has(relative(ROOT, file).split('\\').join('/')))
      .filter((file) => /new Blob\([^)]*type:\s*['"]text\/html/.test(readFileSync(file, 'utf-8')));
    expect(offenders.map((f) => relative(ROOT, f))).toEqual([]);
  });
});
