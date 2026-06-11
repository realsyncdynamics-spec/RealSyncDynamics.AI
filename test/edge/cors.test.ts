/**
 * Unit-Tests für den geteilten CORS-Helper.
 * Wir testen die pure Origin-Allowlist-Logik (matchOrigin) und die
 * öffentliche `withCors`-Factory ohne tatsächliche Edge-Function.
 */
import { describe, it, expect } from 'vitest';
import {
  corsHeaders,
  withCors,
  __test,
} from '../../supabase/functions/_shared/cors';

const { matchOrigin, DEFAULT_ORIGIN } = __test;

describe('matchOrigin', () => {
  it('lässt erlaubten Origin durch', () => {
    expect(matchOrigin('https://realsyncdynamicsai.de')).toBe(
      'https://realsyncdynamicsai.de',
    );
    expect(matchOrigin('https://www.realsyncdynamicsai.de')).toBe(
      'https://www.realsyncdynamicsai.de',
    );
  });
  it('lässt localhost in Dev durch', () => {
    expect(matchOrigin('http://localhost:3000')).toBe('http://localhost:3000');
    expect(matchOrigin('http://127.0.0.1:5173')).toBe('http://127.0.0.1:5173');
  });
  it('fallback auf Default bei fremdem Origin', () => {
    expect(matchOrigin('https://evil.example')).toBe(DEFAULT_ORIGIN);
    expect(matchOrigin('https://realsyncdynamicsai.de.attacker.com')).toBe(
      DEFAULT_ORIGIN,
    );
  });
  it('fallback auf Default bei fehlendem Origin (Server-zu-Server)', () => {
    expect(matchOrigin('')).toBe(DEFAULT_ORIGIN);
  });
  it('berücksichtigt extra-Origins für Preview-Branches', () => {
    expect(
      matchOrigin('https://pr-42.realsyncdynamicsai.pages.dev', [
        'https://pr-42.realsyncdynamicsai.pages.dev',
      ]),
    ).toBe('https://pr-42.realsyncdynamicsai.pages.dev');
  });
});

describe('corsHeaders', () => {
  it('setzt Vary: Origin', () => {
    const h = corsHeaders(
      new Request('https://api', { headers: { origin: 'https://realsyncdynamicsai.de' } }),
    );
    expect(h['Vary']).toBe('Origin');
  });
  it('reflektiert erlaubten Origin', () => {
    const h = corsHeaders(
      new Request('https://api', { headers: { origin: 'https://realsyncdynamicsai.de' } }),
    );
    expect(h['Access-Control-Allow-Origin']).toBe('https://realsyncdynamicsai.de');
  });
  it('fällt bei unbekanntem Origin auf Default zurück', () => {
    const h = corsHeaders(
      new Request('https://api', { headers: { origin: 'https://evil.example' } }),
    );
    expect(h['Access-Control-Allow-Origin']).toBe(DEFAULT_ORIGIN);
  });
  it('setzt sinnvolle Allow-Headers + Methods', () => {
    const h = corsHeaders(new Request('https://api'));
    expect(h['Access-Control-Allow-Headers']).toContain('authorization');
    expect(h['Access-Control-Allow-Headers']).toContain('x-tenant-id');
    expect(h['Access-Control-Allow-Methods']).toContain('POST');
    expect(h['Access-Control-Allow-Methods']).toContain('OPTIONS');
  });
});

describe('withCors factory', () => {
  it('liefert json/jsonError/preflight mit CORS-Headern', async () => {
    const req = new Request('https://api', {
      headers: { origin: 'https://realsyncdynamicsai.de' },
    });
    const { json, jsonError, preflight } = withCors(req);

    const ok = json({ ok: true });
    expect(ok.status).toBe(200);
    expect(ok.headers.get('access-control-allow-origin')).toBe(
      'https://realsyncdynamicsai.de',
    );
    expect(ok.headers.get('content-type')).toContain('application/json');
    expect(await ok.json()).toEqual({ ok: true });

    const err = jsonError(400, 'BAD', 'invalid');
    expect(err.status).toBe(400);
    expect(await err.json()).toEqual({
      ok: false,
      error: { code: 'BAD', message: 'invalid' },
    });
    expect(err.headers.get('access-control-allow-origin')).toBe(
      'https://realsyncdynamicsai.de',
    );

    const pre = preflight();
    expect(pre.status).toBe(200);
    expect(pre.headers.get('access-control-allow-origin')).toBe(
      'https://realsyncdynamicsai.de',
    );
    expect(await pre.text()).toBe('ok');
  });
});
