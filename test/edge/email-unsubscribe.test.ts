/**
 * Issue #2282 — /api/sp-unsubscribe und /api/drip-unsubscribe.
 *
 * Belegt am Handler (ohne Netz, RPC als Spy):
 *  - GET/HEAD ändern nichts: die Abmelde-RPC wird nie aufgerufen (= 0 geänderte Zeilen).
 *  - POST (Formular und RFC 8058 One-Click) ruft die RPC genau einmal mit Liste + Token.
 *  - Gleiche Antwort für gültige, unbekannte und bereits abgemeldete Tokens.
 *  - Fehlender/kaputter Token: kein DB-Aufruf, neutrale Antwort.
 *  - no-store, no-referrer, CSP; DB-Ausfall → 503 statt Scheinbestätigung.
 *  - Middleware: CSRF-Ausnahme und kein SPA-404-Umschreiben nur für exakt diese Pfade.
 * Die DB-Seite (unsubscribed_at, Idempotenz, Versandsperre) prüft
 * test/runtime/db/email-unsubscribe.db.test.ts gegen echtes Postgres.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import {
  MAX_POST_BYTES,
  UNSUBSCRIBE_LISTS,
  createRestUnsubscribeRpc,
  handleUnsubscribe,
  isUnsubscribePath,
  normalizeToken,
  type UnsubscribeList,
} from '../../src/lib/emailUnsubscribe';
import { onRequest as middleware } from '../../functions/_middleware';
import { onRequest as spFunction } from '../../functions/api/sp-unsubscribe';
import { onRequest as dripFunction } from '../../functions/api/drip-unsubscribe';

const TOKEN = '3f2b8c1e-9a4d-4e6f-8b2a-1c3d5e7f9a0b';
const OTHER = '0a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d';
const ORIGIN = 'https://realsyncdynamicsai.de';

function rpcSpy(result: boolean | Error = true) {
  return vi.fn(async (_list: UnsubscribeList, _token: string) => {
    if (result instanceof Error) throw result;
    return result;
  });
}

function req(path: string, init: RequestInit = {}): Request {
  return new Request(`${ORIGIN}${path}`, init);
}

function oneClick(path: string): Request {
  return req(path, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: 'List-Unsubscribe=One-Click',
  });
}

function formPost(path: string, token: string): Request {
  return req(path, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ token }).toString(),
  });
}

function expectSecurityHeaders(res: Response): void {
  expect(res.headers.get('cache-control')).toContain('no-store');
  expect(res.headers.get('referrer-policy')).toBe('no-referrer');
  expect(res.headers.get('x-robots-tag')).toContain('noindex');
  expect(res.headers.get('content-security-policy')).toContain("default-src 'none'");
  expect(res.headers.get('content-security-policy')).toContain("form-action 'self'");
}

describe.each(Object.values(UNSUBSCRIBE_LISTS))('$path', (cfg) => {
  it('GET zeigt nur die Bestätigung und ruft die Abmelde-RPC nie auf', async () => {
    const rpc = rpcSpy();
    const res = await handleUnsubscribe(req(`${cfg.path}?token=${TOKEN}`), cfg, rpc);
    expect(res.status).toBe(200);
    expect(rpc).not.toHaveBeenCalled();
    const body = await res.text();
    expect(body).toContain('Abmeldung bestätigen');
    expect(body).toContain(`<form method="post" action="${cfg.path}">`);
    expect(body).toContain(`name="token" value="${TOKEN}"`);
    // keine externen Ressourcen, über die der Token per Referer abfließen könnte
    expect(body).not.toMatch(/(src|href)="https?:/);
    expectSecurityHeaders(res);
  });

  it('HEAD und wiederholte GETs (Linkscanner) ändern ebenfalls nichts', async () => {
    const rpc = rpcSpy();
    for (let i = 0; i < 3; i++) {
      await handleUnsubscribe(req(`${cfg.path}?token=${TOKEN}`), cfg, rpc);
    }
    const head = await handleUnsubscribe(req(`${cfg.path}?token=${TOKEN}`, { method: 'HEAD' }), cfg, rpc);
    expect(head.status).toBe(200);
    expect(await head.text()).toBe('');
    expect(rpc).not.toHaveBeenCalled();
  });

  it('RFC-8058-One-Click-POST meldet über die RPC ab (Token aus der URL)', async () => {
    const rpc = rpcSpy();
    const res = await handleUnsubscribe(oneClick(`${cfg.path}?token=${TOKEN}`), cfg, rpc);
    expect(res.status).toBe(200);
    expect(rpc).toHaveBeenCalledTimes(1);
    expect(rpc).toHaveBeenCalledWith(cfg.list, TOKEN);
    expect(await res.text()).toContain('Abmeldung verarbeitet');
    expectSecurityHeaders(res);
  });

  it('Formular-POST aus der Bestätigungsansicht nutzt den Token aus dem Body', async () => {
    const rpc = rpcSpy();
    const res = await handleUnsubscribe(formPost(cfg.path, TOKEN.toUpperCase()), cfg, rpc);
    expect(res.status).toBe(200);
    expect(rpc).toHaveBeenCalledWith(cfg.list, TOKEN);
  });

  it('wiederholter POST liefert dieselbe Antwort (Idempotenz liegt in der DB)', async () => {
    const rpc = rpcSpy();
    const a = await handleUnsubscribe(oneClick(`${cfg.path}?token=${TOKEN}`), cfg, rpc);
    const b = await handleUnsubscribe(oneClick(`${cfg.path}?token=${TOKEN}`), cfg, rpc);
    expect(a.status).toBe(b.status);
    expect(await a.text()).toBe(await b.text());
  });

  it('gültiger und unbekannter Token sind von außen nicht unterscheidbar', async () => {
    // Die RPC liefert void — für beide Fälle `true`. Antwort muss bytegleich sein.
    const known = await handleUnsubscribe(oneClick(`${cfg.path}?token=${TOKEN}`), cfg, rpcSpy(true));
    const unknown = await handleUnsubscribe(oneClick(`${cfg.path}?token=${OTHER}`), cfg, rpcSpy(true));
    expect(known.status).toBe(unknown.status);
    const kt = await known.text();
    expect(kt).toBe(await unknown.text());
    expect(kt).not.toContain(TOKEN);
    expect([...known.headers.entries()]).toEqual([...unknown.headers.entries()]);
  });

  it.each([
    ['fehlend', ''],
    ['leer', '?token='],
    ['kein UUID-Format', '?token=abc'],
    ['SQL-Versuch', `?token=${encodeURIComponent("' OR 1=1 --")}`],
    ['zu lang', `?token=${TOKEN}0`],
  ])('Token %s: kein DB-Aufruf, neutrale Antwort', async (_name, query) => {
    const rpc = rpcSpy();
    const get = await handleUnsubscribe(req(`${cfg.path}${query}`), cfg, rpc);
    const post = await handleUnsubscribe(oneClick(`${cfg.path}${query}`), cfg, rpc);
    expect(get.status).toBe(400);
    expect(post.status).toBe(400);
    expect(rpc).not.toHaveBeenCalled();
    const body = await post.text();
    expect(body).toContain('Link unvollständig');
    expect(body).not.toMatch(/abonnent|nicht gefunden|unbekannt/i);
    expectSecurityHeaders(post);
  });

  it('DB nicht erreichbar → 503, keine Scheinbestätigung', async () => {
    for (const rpc of [rpcSpy(false), rpcSpy(new Error('network'))]) {
      const res = await handleUnsubscribe(oneClick(`${cfg.path}?token=${TOKEN}`), cfg, rpc);
      expect(res.status).toBe(503);
      expect(await res.text()).not.toContain('Abmeldung verarbeitet');
    }
  });

  it('übergroßer oder falsch typisierter Body wird ohne DB-Aufruf abgelehnt', async () => {
    const rpc = rpcSpy();
    const big = req(cfg.path, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: `token=${TOKEN}&pad=${'x'.repeat(MAX_POST_BYTES)}`,
    });
    const json = req(cfg.path, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ token: TOKEN }),
    });
    expect((await handleUnsubscribe(big, cfg, rpc)).status).toBe(400);
    expect((await handleUnsubscribe(json, cfg, rpc)).status).toBe(400);
    expect(rpc).not.toHaveBeenCalled();
  });

  it('andere Methoden → 405 mit Allow-Header', async () => {
    const rpc = rpcSpy();
    for (const method of ['PUT', 'DELETE', 'PATCH']) {
      const res = await handleUnsubscribe(req(`${cfg.path}?token=${TOKEN}`, { method }), cfg, rpc);
      expect(res.status).toBe(405);
      expect(res.headers.get('allow')).toBe('GET, HEAD, POST');
    }
    expect(rpc).not.toHaveBeenCalled();
  });
});

describe('normalizeToken', () => {
  it('akzeptiert nur UUIDs und normalisiert auf Kleinbuchstaben', () => {
    expect(normalizeToken(TOKEN.toUpperCase())).toBe(TOKEN);
    expect(normalizeToken(` ${TOKEN} `)).toBe(TOKEN);
    expect(normalizeToken(null)).toBeNull();
    expect(normalizeToken(123)).toBeNull();
    expect(normalizeToken('not-a-token')).toBeNull();
  });
});

describe('createRestUnsubscribeRpc', () => {
  it('ruft nur die Abmelde-RPC mit dem öffentlichen Key auf, ohne Authorization-JWT', async () => {
    const fetchMock = vi.fn(async () => new Response(null, { status: 204 }));
    const rpc = createRestUnsubscribeRpc('https://proj.supabase.co/', 'sb_publishable_test', fetchMock as unknown as typeof fetch);
    expect(await rpc('drip', TOKEN)).toBe(true);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://proj.supabase.co/rest/v1/rpc/email_unsubscribe_by_token');
    expect(init.method).toBe('POST');
    const headers = init.headers as Record<string, string>;
    expect(headers.apikey).toBe('sb_publishable_test');
    expect(headers.authorization).toBeUndefined();
    expect(JSON.parse(String(init.body))).toEqual({ p_list: 'drip', p_token: TOKEN });
  });

  it('meldet Fehler der DB als false (→ 503)', async () => {
    const fetchMock = vi.fn(async () => new Response('{}', { status: 500 }));
    const rpc = createRestUnsubscribeRpc('https://proj.supabase.co', 'k', fetchMock as unknown as typeof fetch);
    expect(await rpc('sp', TOKEN)).toBe(false);
  });
});

describe('Pages-Functions-Verdrahtung', () => {
  it('Function-GET ruft kein fetch auf; POST trifft nur die Abmelde-RPC', async () => {
    const fetchMock = vi.fn(async () => new Response(null, { status: 204 }));
    vi.stubGlobal('fetch', fetchMock);
    try {
      await spFunction({ request: req(`/api/sp-unsubscribe?token=${TOKEN}`) });
      await dripFunction({ request: req(`/api/drip-unsubscribe?token=${TOKEN}`) });
      expect(fetchMock).not.toHaveBeenCalled();

      const sp = await spFunction({ request: oneClick(`/api/sp-unsubscribe?token=${TOKEN}`) });
      const drip = await dripFunction({ request: oneClick(`/api/drip-unsubscribe?token=${TOKEN}`) });
      expect(sp.status).toBe(200);
      expect(drip.status).toBe(200);
      expect(fetchMock).toHaveBeenCalledTimes(2);
      const bodies = fetchMock.mock.calls.map((c) => JSON.parse(String((c as unknown as [string, RequestInit])[1].body)));
      expect(bodies).toEqual([
        { p_list: 'sp', p_token: TOKEN },
        { p_list: 'drip', p_token: TOKEN },
      ]);
      for (const c of fetchMock.mock.calls) {
        expect((c as unknown as [string])[0]).toMatch(/\/rest\/v1\/rpc\/email_unsubscribe_by_token$/);
      }
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('die Functions enthalten keine service_role- oder Secret-Referenz', () => {
    for (const f of ['functions/api/sp-unsubscribe.ts', 'functions/api/drip-unsubscribe.ts', 'src/lib/emailUnsubscribe.ts']) {
      const src = readFileSync(resolve(__dirname, '../..', f), 'utf8');
      expect(src).not.toMatch(/SERVICE_ROLE|service_role_key|SUPABASE_SERVICE/i);
    }
  });

  it('Mail-Handler verlinken genau die implementierten Pfade mit One-Click-Header', () => {
    const drip = readFileSync(resolve(__dirname, '../../supabase/functions/audit-drip-cron/index.ts'), 'utf8');
    const sp = readFileSync(resolve(__dirname, '../../supabase/functions/sub-processor-notify/index.ts'), 'utf8');
    expect(drip).toContain(`${UNSUBSCRIBE_LISTS.drip.path}?token=`);
    expect(sp).toContain(`${UNSUBSCRIBE_LISTS.sp.path}?token=`);
    for (const src of [drip, sp]) expect(src).toContain("'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click'");
  });
});

describe('Middleware', () => {
  const html200 = () => new Response('<html>fn</html>', { status: 200, headers: { 'content-type': 'text/html; charset=utf-8' } });

  it('lässt One-Click-/Formular-POST trotz Cookie ohne CSRF-Header durch', async () => {
    for (const path of ['/api/sp-unsubscribe', '/api/drip-unsubscribe']) {
      const next = vi.fn(async () => html200());
      const res = await middleware({
        request: req(`${path}?token=${TOKEN}`, {
          method: 'POST',
          headers: { cookie: 'rsd_csrf=abc', origin: ORIGIN, 'content-type': 'application/x-www-form-urlencoded' },
          body: 'List-Unsubscribe=One-Click',
        }),
        next,
      });
      expect(next).toHaveBeenCalledTimes(1);
      expect(res.status).toBe(200);
    }
  });

  it('ersetzt die HTML-Antwort der Abmelde-Function nicht durch die SPA-404-Seite', async () => {
    const assetsFetch = vi.fn(async () => new Response('<html>404</html>', { status: 200, headers: { 'content-type': 'text/html' } }));
    const res = await middleware({
      request: req(`/api/sp-unsubscribe?token=${TOKEN}`),
      env: { ASSETS: { fetch: assetsFetch } },
      next: async () => html200(),
    });
    expect(res.status).toBe(200);
    expect(await res.text()).toBe('<html>fn</html>');
    expect(assetsFetch).not.toHaveBeenCalled();
  });

  it('Ausnahme gilt nur für exakt diese Pfade', async () => {
    expect(isUnsubscribePath('/api/sp-unsubscribe')).toBe(true);
    expect(isUnsubscribePath('/api/drip-unsubscribe')).toBe(true);
    for (const p of ['/api/sp-unsubscribe/', '/api/sp-unsubscribe/x', '/api/recheck-unsubscribe', '/api/fn/sales-lead']) {
      expect(isUnsubscribePath(p)).toBe(false);
    }
    const next = vi.fn(async () => html200());
    const res = await middleware({
      request: req('/api/fn/sales-lead', {
        method: 'POST',
        headers: { cookie: 'rsd_csrf=abc', origin: ORIGIN },
        body: '{}',
      }),
      next,
    });
    expect(res.status).toBe(403);
    expect(next).not.toHaveBeenCalled();
  });

  it('ein Pfad ohne Function (Slash-Variante) bekommt weiter den echten 404', async () => {
    const res = await middleware({
      request: req(`/api/sp-unsubscribe/?token=${TOKEN}`),
      next: async () => html200(),
    });
    expect(res.status).toBe(404);
  });
});
