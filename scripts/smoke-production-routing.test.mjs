import assert from 'node:assert/strict';
import { test } from 'node:test';
import { pageContentIssue, probe } from './smoke-production-routing.mjs';

const apex = 'https://realsyncdynamicsai.de';
const pages = 'https://realsyncdynamics-ai.pages.dev';
const spa = '<!doctype html><html><body><div id="root"></div></body></html>';

test('lehnt die beobachtete Startseiten-Auslieferung ohne SPA-Root ab', () => {
  const oldLanding = '<html><body><script>window.__bundler = {};</script></body></html>';
  assert.match(pageContentIssue(apex, `${apex}/pricing/`, oldLanding), /SPA-Root/);
});

test('lehnt einen Apex-Redirect auf die Pages-SPA ab', () => {
  assert.match(pageContentIssue(apex, `${pages}/pricing`, spa), /fremder Ziel-Origin/);
});

test('akzeptiert Slash-Normalisierung und Query auf demselben Origin', () => {
  assert.equal(pageContentIssue(apex, `${apex}/audit?source=landing-v3`, spa), '');
});

test('akzeptiert die erforderliche Pages-SPA und einfache Anführungszeichen', () => {
  assert.equal(pageContentIssue(pages, `${pages}/`, "<div id = 'root'></div>"), '');
});

test('verwechselt data-id nicht mit dem SPA-Root', () => {
  assert.match(pageContentIssue(apex, `${apex}/`, '<div data-id="root"></div>'), /SPA-Root/);
});

test('wertet die Redirect-Kette im normalen Probe-Einstieg aus', async (context) => {
  const responses = [
    new Response(null, { status: 302, headers: { location: `${pages}/login` } }),
    new Response(spa, { headers: { 'content-type': 'text/html' } }),
  ];
  Object.defineProperty(responses[1], 'url', { value: `${pages}/login` });
  context.mock.method(globalThis, 'fetch', async () => responses.shift());
  const result = await probe(apex, '/login');
  assert.equal(result.status, 200);
  assert.equal(result.finalUrl, `${pages}/login`);
  assert.equal(result.ok, false);
  assert.match(result.note, /fremder Ziel-Origin/);
});

test('akzeptiert echte SPA-Antworten im normalen Probe-Einstieg', async (context) => {
  context.mock.method(globalThis, 'fetch', async () => new Response(spa, {
    headers: { 'content-type': 'text/html; charset=utf-8' },
  }));
  const result = await probe(pages, '/pricing');
  assert.equal(result.ok, true);
  assert.equal(result.note, '');
});

test('behält HTTP-Fehler als fehlgeschlagene Probe bei', async (context) => {
  context.mock.method(globalThis, 'fetch', async () => new Response('Error', {
    status: 502, headers: { 'content-type': 'text/html' },
  }));
  const result = await probe(pages, '/');
  assert.equal(result.ok, false);
  assert.match(result.note, /Edge-\/Server-Fehler/);
});

test('lehnt HTML-Inhalt mit falschem MIME-Typ ab', async (context) => {
  context.mock.method(globalThis, 'fetch', async () => new Response(spa, {
    headers: { 'content-type': 'application/json' },
  }));
  const result = await probe(pages, '/');
  assert.equal(result.ok, false);
  assert.match(result.note, /kein HTML/);
});
