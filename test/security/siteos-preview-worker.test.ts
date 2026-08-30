import { beforeEach, describe, expect, it } from 'vitest';

import worker from '../../workers/siteos-preview/src/index';

/**
 * Verhaltensprüfung des Vorschau-Workers.
 *
 * Auf dieser Herkunft läuft erzeugter Code. Die drei Dinge, die hier
 * schiefgehen können, sind: ein offener Schreibpfad, eine erratbare Kennung
 * und ein Dokument, das ohne Schutzheader ausgeliefert wird. Genau die prüft
 * diese Datei.
 */

const VALID_ID = 'a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6';
const TOKEN = 'test-write-token';

/** Ablage-Attrappe mit derselben Schnittstelle wie KV. */
function fakeKv() {
  const store = new Map<string, string>();
  const ttls = new Map<string, number | undefined>();
  return {
    store,
    ttls,
    async get(key: string, type?: string) {
      const raw = store.get(key);
      if (raw === undefined) return null;
      return type === 'json' ? JSON.parse(raw) : raw;
    },
    async put(key: string, value: string, options?: { expirationTtl?: number }) {
      store.set(key, value);
      ttls.set(key, options?.expirationTtl);
    },
    async delete(key: string) {
      store.delete(key);
      ttls.delete(key);
    },
  };
}

let kv: ReturnType<typeof fakeKv>;
let env: { PREVIEWS: unknown; PREVIEW_WRITE_TOKEN?: string };

beforeEach(() => {
  kv = fakeKv();
  env = { PREVIEWS: kv, PREVIEW_WRITE_TOKEN: TOKEN };
});

function call(method: string, path: string, init: RequestInit = {}) {
  return worker.fetch(
    new Request(`https://siteos-preview.example.workers.dev${path}`, { method, ...init }),
    env as never,
  );
}

function put(body: unknown, token: string | null = TOKEN, id = VALID_ID) {
  return call('PUT', `/p/${id}`, {
    body: JSON.stringify(body),
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
}

describe('Schreibpfad', () => {
  it('nimmt ein Dokument mit gültigem Token an', async () => {
    const res = await put({ html: '<!doctype html><html><head></head><body>a</body></html>' });
    expect(res.status).toBe(201);
    expect(kv.store.has(VALID_ID)).toBe(true);
  });

  it('weist einen fehlenden Token ab', async () => {
    expect((await put({ html: '<p>a</p>' }, null)).status).toBe(401);
    expect(kv.store.size).toBe(0);
  });

  it('weist einen falschen Token ab', async () => {
    expect((await put({ html: '<p>a</p>' }, 'falsch')).status).toBe(401);
    expect(kv.store.size).toBe(0);
  });

  it('ist zu, wenn gar kein Geheimnis gesetzt ist — nicht offen', async () => {
    // Der gefährlichste Konfigurationsfehler wäre, ein fehlendes Geheimnis als
    // „keine Prüfung nötig" zu lesen.
    delete env.PREVIEW_WRITE_TOKEN;
    expect((await put({ html: '<p>a</p>' }, TOKEN)).status).toBe(401);
    expect((await put({ html: '<p>a</p>' }, null)).status).toBe(401);
    expect(kv.store.size).toBe(0);
  });

  it('setzt eine Ablaufzeit, damit ein Entwurf nicht liegenbleibt', async () => {
    await put({ html: '<p>a</p>' });
    expect(kv.ttls.get(VALID_ID)).toBeGreaterThan(0);
  });

  it('lehnt leeres und übergrosses HTML ab', async () => {
    expect((await put({ html: '' })).status).toBe(400);
    expect((await put({ html: 'x'.repeat(3 * 1024 * 1024) })).status).toBe(413);
  });

  it('lehnt kaputten und nicht-objektartigen Rumpf ab', async () => {
    const broken = await call('PUT', `/p/${VALID_ID}`, {
      body: '{kaputt',
      headers: { Authorization: `Bearer ${TOKEN}` },
    });
    expect(broken.status).toBe(400);

    const notObject = await put('nur ein String' as unknown);
    expect(notObject.status).toBe(400);
  });

  it('fällt bei unbekannter Isolationsstufe auf die strengere zurück', async () => {
    // Ein Tippfehler darf keine Skripte freischalten.
    await put({ html: '<p>a</p>', isolation: 'intercative' });
    expect(JSON.parse(kv.store.get(VALID_ID)!).isolation).toBe('static');
  });
});

describe('Kennung', () => {
  it('weist alles ab, was keine 128-Bit-Hex-Kennung ist', async () => {
    for (const bad of ['kurz', 'A'.repeat(32), 'a'.repeat(31), 'a'.repeat(33), 'zzzz']) {
      const res = await call('GET', `/p/${bad}`);
      expect(res.status, bad).toBe(400);
    }
  });

  it('lässt Pfad-Manipulation gar nicht erst am Muster ankommen', async () => {
    // `/p/../etc` wird bereits von der URL-Normalisierung zu `/etc` — die
    // Anfrage erreicht den Kennungs-Zweig nie und endet auf 404. Geprüft wird
    // hier also die Wirkung, nicht der Statuscode: Es entsteht kein
    // Speicherzugriff ausserhalb des Kennungsraums.
    for (const bad of ['../etc', 'a/../b', '..%2f..']) {
      const res = await call('GET', `/p/${bad}`);
      expect([400, 404], bad).toContain(res.status);
      expect(res.headers.get('Content-Type')).toContain('application/json');
    }
  });

  it('unterscheidet abgelaufen nicht von nie existiert', async () => {
    // Sonst liesse sich über die Statuscodes herausfinden, welche Kennungen
    // es einmal gab.
    const res = await call('GET', `/p/${'b'.repeat(32)}`);
    expect(res.status).toBe(404);
  });
});

describe('Auslieferung', () => {
  it('liefert das Dokument mit vollständigen Schutzheadern', async () => {
    const html = '<!doctype html><html><head></head><body>hallo</body></html>';
    await put({ html });

    const res = await call('GET', `/p/${VALID_ID}`);
    expect(res.status).toBe(200);
    expect(await res.text()).toBe(html);

    const csp = res.headers.get('Content-Security-Policy') ?? '';
    expect(csp).toContain("default-src 'none'");
    expect(csp).toContain('frame-ancestors');
    expect(res.headers.get('X-Content-Type-Options')).toBe('nosniff');
    expect(res.headers.get('Referrer-Policy')).toBe('no-referrer');
    expect(res.headers.get('Cache-Control')).toContain('no-store');
    expect(res.headers.get('X-Robots-Tag')).toContain('noindex');
  });

  it('sperrt Skripte, solange die Vorschau statisch ist', async () => {
    await put({ html: '<p>a</p>' });
    const res = await call('GET', `/p/${VALID_ID}`);
    expect(res.headers.get('Content-Security-Policy')).toContain("script-src 'none'");
  });

  it('erlaubt eingebettetes Skript erst bei ausdrücklich interaktiver Vorschau', async () => {
    await put({ html: '<p>a</p>', isolation: 'interactive' });
    const res = await call('GET', `/p/${VALID_ID}`);
    expect(res.headers.get('Content-Security-Policy')).toContain("script-src 'unsafe-inline'");
  });

  it('beantwortet HEAD ohne Rumpf, aber mit denselben Headern', async () => {
    await put({ html: '<p>a</p>' });
    const res = await call('HEAD', `/p/${VALID_ID}`);
    expect(res.status).toBe(200);
    expect(await res.text()).toBe('');
    expect(res.headers.get('Content-Security-Policy')).toBeTruthy();
  });
});

describe('Übrige Pfade', () => {
  it('antwortet auf /healthz', async () => {
    const res = await call('GET', '/healthz');
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
  });

  it('kennt keine anderen Pfade', async () => {
    expect((await call('GET', '/')).status).toBe(404);
    expect((await call('GET', '/admin')).status).toBe(404);
  });

  it('lehnt POST ab', async () => {
    expect((await call('POST', `/p/${VALID_ID}`)).status).toBe(405);
  });

  it('löscht nur mit gültigem Token', async () => {
    await put({ html: '<p>a</p>' });
    expect((await call('DELETE', `/p/${VALID_ID}`)).status).toBe(401);
    expect(kv.store.has(VALID_ID)).toBe(true);

    const ok = await call('DELETE', `/p/${VALID_ID}`, { headers: { Authorization: `Bearer ${TOKEN}` } });
    expect(ok.status).toBe(200);
    expect(kv.store.has(VALID_ID)).toBe(false);
  });
});
