/**
 * Prüft das archivierte Netlify-Bundler-HTML. Schreibt keine Datei ins Repo
 * und keine Produktionsdatei. Temporäre Script-Kopien liegen nur unter os.tmpdir.
 *
 * Grenze des Template-Scripts: erstes literales "</script>" nach dem öffnenden
 * Tag. "<\u002Fscript>" im JSON ist kein Abschluss. JSON.parse lässt
 * nachgestellten Weißraum zu; die beobachtete Neu-Serialisierung hängt keinen an.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const dir = path.dirname(fileURLToPath(import.meta.url));
const indexPath = path.join(dir, 'index.html');
const originalPath = path.join(dir, 'original-live.html');
const notFoundPath = path.join(dir, '404.html');

const TEMPLATE = '<script type="__bundler/template">';
const MANIFEST = '<script type="__bundler/manifest">';
const checks = [];

function check(name, ok, detail = '') {
  checks.push({ name, ok: Boolean(ok), detail });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`);
}

function bounds(raw, label) {
  const open = raw.indexOf(TEMPLATE);
  check(`${label} hat genau ein Template-Script`, raw.split(TEMPLATE).length - 1 === 1, `count=${raw.split(TEMPLATE).length - 1}`);
  if (open < 0) return null;
  const start = open + TEMPLATE.length + 1;
  const end = raw.indexOf('</script>', start);
  check(`${label} Template endet am ersten literalen </script>`, end > start);
  if (end < 0) return null;
  const tail = raw.slice(end, end + 25);
  check(`${label} schließt mit </script></body></html>`, tail === '</script>\n</body>\n</html>', JSON.stringify(tail));
  return { start, end, payload: raw.slice(start, end) };
}

function encode(html) {
  return `"${html
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r')
    .replace(/\t/g, '\\t')
    .replace(/<\//g, '<\\u002F')}"`;
}

function manifestBody(raw) {
  const start = raw.indexOf(MANIFEST);
  if (start < 0) return null;
  const end = raw.indexOf('</script>', start);
  return raw.slice(start, end);
}

function hrefs(html) {
  return [...html.matchAll(/href="([^"]*)"/g)].map((match) => match[1]);
}

function urls(html) {
  return [...html.matchAll(/https:\/\/[^"'\s)<]+/g)].map((match) => match[0]);
}

function syntaxCheck(label, html) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'rsd-live-fix-'));
  let ok = 0;
  let fail = 0;
  const errors = [];
  const re = /<script\b([^>]*)>([\s\S]*?)<\/script>/gi;
  let match;
  let index = 0;
  while ((match = re.exec(html))) {
    const attrs = match[1];
    const body = match[2];
    if (/\bsrc\s*=/.test(attrs) || attrs.includes('__bundler') || !body.trim()) continue;
    const file = path.join(tmp, `${label}-${index}.js`);
    fs.writeFileSync(file, body);
    const result = spawnSync(process.execPath, ['--check', file], { encoding: 'utf8' });
    if (result.status === 0) ok += 1;
    else {
      fail += 1;
      errors.push((result.stderr || '').split('\n')[0]);
    }
    index += 1;
  }
  fs.rmSync(tmp, { recursive: true, force: true });
  check(`${label} Inline-Scripts node --check`, fail === 0, `ok=${ok} fail=${fail}${errors.length ? ` ${errors.join(' | ')}` : ''}`);
}

const indexRaw = fs.readFileSync(indexPath, 'utf8');
const originalRaw = fs.readFileSync(originalPath, 'utf8');
const notFound = fs.readFileSync(notFoundPath, 'utf8');

check('index und original sind verschiedene Dateien', indexRaw !== originalRaw);
check('404 leitet nur auf dieselbe Origin um', notFound.includes('location.replace("/"+location.search+location.hash)') && !/https?:\/\//.test(notFound));

const indexBounds = bounds(indexRaw, 'index');
const originalBounds = bounds(originalRaw, 'original');

let indexHtml = '';
let originalHtml = '';
if (indexBounds && originalBounds) {
  let indexDecoded = false;
  let originalDecoded = false;
  try {
    indexHtml = JSON.parse(indexBounds.payload);
    indexDecoded = typeof indexHtml === 'string';
  } catch (error) {
    check('index Template ist JSON', false, error instanceof Error ? error.message : String(error));
  }
  try {
    originalHtml = JSON.parse(originalBounds.payload);
    originalDecoded = typeof originalHtml === 'string';
  } catch (error) {
    check('original Template ist JSON', false, error instanceof Error ? error.message : String(error));
  }
  check('index Template ist JSON', indexDecoded, indexDecoded ? `html=${indexHtml.length}` : '');
  check('original Template ist JSON', originalDecoded, originalDecoded ? `html=${originalHtml.length}` : '');

  if (indexDecoded) {
    check('index Payload entspricht der beobachteten Serialisierung', indexBounds.payload === encode(indexHtml));
  }
  if (originalDecoded) {
    const encoded = encode(originalHtml);
    const rest = originalBounds.payload.slice(encoded.length);
    check(
      'original Payload ist dieselbe Serialisierung plus Weißraum',
      originalBounds.payload.startsWith(encoded) && /^\s*$/.test(rest),
      JSON.stringify(rest),
    );
  }

  const indexManifest = manifestBody(indexRaw);
  const originalManifest = manifestBody(originalRaw);
  check('Manifest-Rohtext ist gleich', indexManifest !== null && indexManifest === originalManifest, `bytes=${indexManifest?.length ?? 0}`);
  check('Hülle vor dem Template-Payload ist gleich', indexRaw.slice(0, indexBounds.start) === originalRaw.slice(0, originalBounds.start));
  check('Hülle ab dem Template-Ende ist gleich', indexRaw.slice(indexBounds.end) === originalRaw.slice(originalBounds.end));
}

if (indexHtml && originalHtml) {
  const required = [
    '89 € <small>netto</small>',
    '105,91 € brutto',
    'Web · 500 Minuten inklusive',
    'Weitere Minute 0,18 € netto',
    '199 € <small>netto</small>',
    '236,81 € brutto',
    '1.500 Minuten inklusive',
    'Weitere Minute 0,15 € netto',
    '349 € <small>netto</small>',
    '415,31 € brutto',
    '1.200 Minuten inklusive',
    'DEMO · Freigegeben – keine Aktion ausgeführt.',
    'DEMO · Zufallswert, nicht gespeichert',
    'const app="https://realsyncdynamics-ai.pages.dev"',
    "const APP = 'https://realsyncdynamics-ai.pages.dev'",
    'href="#impressum"',
    'href="#r-impressum"',
    'href="#datenschutz"',
    'href="#agb"',
    'href="#widerruf"',
    'href="#avv"',
    'href="#subproc"',
  ];
  for (const text of required) {
    check(`index enthält ${JSON.stringify(text)}`, indexHtml.includes(text));
  }
  check('alte Zusage „Kein Anruf geht verloren“ fehlt', !indexHtml.includes('Kein Anruf geht verloren'));
  check('alter Urteilssatz ohne Demo-Kennzeichnung fehlt', !indexHtml.includes('Freigegeben – Aktion ausgeführt.'));
  check('href-Attribute sind gegenüber original unverändert', hrefs(indexHtml).join('\n') === hrefs(originalHtml).join('\n'));

  const addedUrls = [...new Set(urls(indexHtml))].filter((url) => !urls(originalHtml).includes(url));
  check(
    'neue https-Ziele nur pages.dev',
    addedUrls.every((url) => url.startsWith('https://realsyncdynamics-ai.pages.dev')),
    addedUrls.join(' ') || 'keine',
  );

  check(
    'Rest: Reset setzt den Button wieder auf Veröffentlichen',
    !indexHtml.includes("q('#ls-pub').textContent = 'Veröffentlichen'"),
    'Kandidat enthält die Zuweisung noch',
  );
  check(
    'Rest: QA-Text spricht weiter vom Veröffentlichen',
    !indexHtml.includes('Hinweise vor dem Veröffentlichen'),
  );
  check(
    'Rest: Hero sagt weiter „Ihr Telefon erreichbar“',
    !indexHtml.includes('Ihr Telefon erreichbar'),
  );

  syntaxCheck('index-template', indexHtml);
  syntaxCheck('index-hülle', indexRaw.slice(0, indexRaw.indexOf(TEMPLATE)));
}

const failed = checks.filter((item) => !item.ok);
console.log(JSON.stringify({
  pass: checks.filter((item) => item.ok).length,
  fail: failed.length,
  failed: failed.map((item) => item.name),
}, null, 2));
process.exit(failed.length === 0 ? 0 : 1);
