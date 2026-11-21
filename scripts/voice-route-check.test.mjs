import test from 'node:test';
import assert from 'node:assert/strict';
import { classifyVoiceApiResponse as classify } from './voice-route-check.mjs';

const PUBLIC = '/api/company-voice';
const LIVE = '/api/company-voice/live';
const json = (value) => JSON.stringify(value);
const api = (route, status, payload, method = 'GET') =>
  classify({ route, status, method, contentType: 'application/json; charset=utf-8', body: json(payload) });

test('200 HTML SPA fallback is never counted as a working public API', () => {
  assert.deepEqual(classify({ route: PUBLIC, status: 200, contentType: 'text/html', body: '<html></html>' }),
    { ok: false, state: 'SPA_HTML_FALLBACK' });
});

test('HTML fallback cannot pass by claiming an application/json header', () => {
  assert.equal(classify({ route: LIVE, status: 200, contentType: 'application/json', body: '<!doctype html>' }).state,
    'SPA_HTML_FALLBACK');
});

test('public company facts JSON is considered routable', () => {
  assert.deepEqual(api(PUBLIC, 200, { ok: true, facts: [], ai: 'disabled' }),
    { ok: true, state: 'PUBLIC_API_OK' });
});

test('public API does not pass without the expected facts shape', () => {
  assert.equal(api(PUBLIC, 200, { ok: true }).state, 'PUBLIC_API_UNEXPECTED');
});

test('public API 500 error is not treated as healthy', () => {
  assert.equal(api(PUBLIC, 500, { ok: false, error: { code: 'FAILED' } }).ok, false);
});

test('disabled live voice returns the expected 503 fail-closed JSON', () => {
  assert.deepEqual(api(LIVE, 503, { ok: false, error: { code: 'LIVE_VOICE_DISABLED' } }),
    { ok: true, state: 'LIVE_FAIL_CLOSED' });
});

test('enabled live voice without WebSocket upgrade returns 426 JSON', () => {
  assert.deepEqual(api(LIVE, 426, { ok: false, error: { code: 'UPGRADE_REQUIRED' } }),
    { ok: true, state: 'LIVE_UPGRADE_REQUIRED' });
});

test('unexpected 503 does not pass fail-closed verification', () => {
  assert.deepEqual(api(LIVE, 503, { ok: false, error: { code: 'LIMIT_UNAVAILABLE' } }),
    { ok: false, state: 'LIVE_UNEXPECTED' });
});

test('non-JSON and malformed JSON are rejected', () => {
  assert.equal(classify({ route: PUBLIC, status: 200, contentType: 'text/plain', body: 'hello' }).state, 'API_NOT_JSON');
  assert.equal(classify({ route: PUBLIC, status: 200, contentType: 'application/json', body: '{' }).state, 'INVALID_JSON');
});

test('HEAD is advisory only; HTML fallback is still detected', () => {
  assert.deepEqual(api(LIVE, 405, { ok: false }, 'HEAD'), { ok: null, state: 'HEAD_ADVISORY' });
  assert.equal(classify({ route: LIVE, method: 'HEAD', status: 200, contentType: 'text/html' }).state,
    'SPA_HTML_FALLBACK');
});

test('unrelated paths are not classified as voice APIs', () => {
  assert.equal(classify({ route: '/pricing', status: 200, contentType: 'text/html', body: '<html>' }), null);
});
