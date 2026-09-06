/**
 * Presence Tenant-Router — Verhalten des Workers (Scope 1, Aufgabe 3)
 *
 * Geprüft wird das, was der Worker selbst entscheidet: Normalisierung des
 * Host-Headers und die Unterscheidung der Antwortfälle. Die Auflösung selbst
 * liegt in der Datenbank und ist dort geprüft
 * (`test/runtime/db/presence-site-creation.db.test.ts`).
 *
 * Der wichtigste Fall hier ist der Unterschied zwischen 404 und 502: Ein
 * Ausfall der Auskunft darf nicht als „diese Seite gibt es nicht"
 * ausgeliefert werden. Genau diese Verwechslung macht einen
 * Datenbank-Ausfall für Aussenstehende ununterscheidbar von einer gelöschten
 * Website — und für Suchmaschinen zu einem Grund, sie zu deindexieren.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import router, {
  normalizeHost,
  resolveHost,
  type PresenceRouterEnv,
  type ResolvedSite,
} from '../../src/workers/presence-router/index';

const ENV: PresenceRouterEnv = {
  SUPABASE_URL: 'https://projekt.example.invalid',
  SUPABASE_ANON_KEY: 'anon-test-key',
};

const SITE: ResolvedSite = {
  tenant_id: '11111111-1111-1111-1111-111111111111',
  site_id: '22222222-2222-2222-2222-222222222222',
  slug: 'malerbetrieb-nord',
  template_id: 'handwerk-basis',
  status: 'published',
  published_at: '2026-09-06T00:00:00Z',
  ai_system_id: '33333333-3333-3333-3333-333333333333',
  business: null,
};

function req(host: string | null, pfad = '/'): Request {
  const headers = new Headers();
  if (host !== null) headers.set('host', host);
  return new Request(`https://beliebig.invalid${pfad}`, { headers });
}

describe('normalizeHost', () => {
  it('vereinheitlicht Grossschreibung, Port und Schlusspunkt', () => {
    expect(normalizeHost('Betrieb.RealSync.App')).toBe('betrieb.realsync.app');
    expect(normalizeHost('betrieb.realsync.app:8443')).toBe('betrieb.realsync.app');
    expect(normalizeHost('betrieb.realsync.app.')).toBe('betrieb.realsync.app');
    expect(normalizeHost('  Betrieb.realsync.app:443.  ')).toBe('betrieb.realsync.app');
  });

  it('gibt null für Fehlendes statt einer leeren Zeichenkette', () => {
    // Ein leerer String liefe als gültiger Host in die Abfrage und ergäbe
    // dort eine sinnlose Suche. null zwingt den Aufrufer zur Entscheidung.
    for (const eingabe of [null, undefined, '', '   ', ':443']) {
      expect(normalizeHost(eingabe), `Eingabe ${JSON.stringify(eingabe)}`).toBeNull();
    }
  });
});

describe('resolveHost', () => {
  it('schickt den Host an die RPC und reicht den Treffer durch', async () => {
    let gesehen: { url: string; body: string; apikey: string | null } | null = null;
    const fakeFetch = (async (url: string | URL | Request, init?: RequestInit) => {
      gesehen = {
        url: String(url),
        body: String(init?.body),
        apikey: new Headers(init?.headers).get('apikey'),
      };
      return new Response(JSON.stringify(SITE), { status: 200 });
    }) as unknown as typeof fetch;

    const out = await resolveHost('malerbetrieb-nord.realsync.app', ENV, fakeFetch);

    expect(out).toEqual(SITE);
    expect(gesehen!.url).toBe(`${ENV.SUPABASE_URL}/rest/v1/rpc/presence_resolve_host`);
    expect(JSON.parse(gesehen!.body)).toEqual({ p_host: 'malerbetrieb-nord.realsync.app' });
    expect(gesehen!.apikey).toBe(ENV.SUPABASE_ANON_KEY);
  });

  it('macht aus einer leeren Antwort null, nicht undefined', async () => {
    const fakeFetch = (async () =>
      new Response('null', { status: 200 })) as unknown as typeof fetch;
    expect(await resolveHost('unbekannt.realsync.app', ENV, fakeFetch)).toBeNull();
  });

  it('wirft, wenn die Auskunft selbst nicht antwortet', async () => {
    const fakeFetch = (async () =>
      new Response('boom', { status: 500 })) as unknown as typeof fetch;
    await expect(resolveHost('x.realsync.app', ENV, fakeFetch)).rejects.toThrow(/500/);
  });
});

describe('fetch-Handler', () => {
  it('beantwortet /__health ohne Datenbankzugriff', async () => {
    // Der Health-Check darf nicht von der Auflösung abhängen, sonst
    // beantwortet er eine andere Frage, als sein Name verspricht.
    const res = await router.fetch(req('irgendwas.invalid', '/__health'), {
      SUPABASE_URL: '',
      SUPABASE_ANON_KEY: '',
    });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, worker: 'presence-router' });
  });

  it('meldet fehlende Konfiguration als 500, nicht als 404', async () => {
    const res = await router.fetch(req('betrieb.realsync.app'), {
      SUPABASE_URL: '',
      SUPABASE_ANON_KEY: '',
    });
    expect(res.status).toBe(500);
    expect((await res.json() as { error: string }).error).toBe('router_misconfigured');
  });

  it('setzt Vary: Host — sonst liefert ein Cache die falsche Seite aus', async () => {
    // Der schwerwiegendste Fehler, den ein Multi-Tenant-Router machen kann:
    // die Antwort für Mandant A unter dem Hostnamen von Mandant B.
    const res = await router.fetch(req('betrieb.realsync.app', '/__health'), ENV);
    expect(res.headers.get('vary')).toBe('Host');
    expect(res.headers.get('cache-control')).toBe('no-store');
  });

  it('ohne Host-Header: 400', async () => {
    const res = await router.fetch(req(null), ENV);
    expect(res.status).toBe(400);
  });

  afterEach(() => { vi.unstubAllGlobals(); });

  it('unbekannter Host: 404', async () => {
    vi.stubGlobal('fetch', async () => new Response('null', { status: 200 }));
    const res = await router.fetch(req('gibtsnicht.realsync.app'), ENV);
    expect(res.status).toBe(404);
    expect((await res.json() as { error: string }).error).toBe('unknown_host');
  });

  it('Auskunft nicht erreichbar: 502 und NICHT 404', async () => {
    // Der Fall, um den es geht. Ein Ausfall der Datenbank als 404
    // auszuliefern hiesse, jeder Kundenseite für die Dauer der Störung zu
    // bescheinigen, dass es sie nicht gibt — mit Folgen weit über die
    // Störung hinaus, weil Suchmaschinen das glauben.
    vi.stubGlobal('fetch', async () => new Response('boom', { status: 503 }));
    const res = await router.fetch(req('betrieb.realsync.app'), ENV);
    expect(res.status).toBe(502);
    expect((await res.json() as { error: string }).error).toBe('resolution_unavailable');
  });

  it('Treffer: 200 mit der aufgelösten Site', async () => {
    vi.stubGlobal('fetch', async () => new Response(JSON.stringify(SITE), { status: 200 }));
    const res = await router.fetch(req('Malerbetrieb-Nord.RealSync.App:443'), ENV);
    expect(res.status).toBe(200);
    const body = await res.json() as { resolved: boolean; host: string; site: ResolvedSite };
    expect(body.resolved).toBe(true);
    // Der normalisierte Host wird zurückgegeben, nicht der rohe Header.
    expect(body.host).toBe('malerbetrieb-nord.realsync.app');
    expect(body.site.tenant_id).toBe(SITE.tenant_id);
  });
});
