// siteos/rebuild-fetch — SSRF-Schranke zur Laufzeit.
//
// Die Datei hat keine `jsr:`-Importe und ist in Vitest ladbar. `Deno` und
// `fetch` werden gestellt; geprüft wird das Verhalten, das der
// Quelltext-Test (`test/security/siteos-rebuild-auth.test.ts`) nur an der
// Form festmachen kann:
//
//   • Abgerufen wird nur, was nachweislich öffentlich auflöst. „Nicht
//     prüfbar" (keine Namensauflösung, Zeitüberschreitung, Resolverfehler)
//     und „löst nicht auf" sperren wie „privat" — fail-closed.
//   • Jede Namensauflösung bekommt eine Zeitgrenze.
//   • Jeder Schritt einer Weiterleitung wird erneut geprüft.

import { afterEach, describe, expect, it, vi } from 'vitest';
import { resolvesToPublic, safeFetch } from '../../supabase/functions/siteos/rebuild-fetch';

type Resolver = (name: string, type: 'A' | 'AAAA', options?: { signal?: AbortSignal }) => Promise<string[]>;

function withDeno(resolveDns: Resolver | undefined): void {
  vi.stubGlobal('Deno', resolveDns ? { resolveDns } : {});
}

function notFound(): Error {
  const error = new Error('no record found for Query { name: Name("x"), query_type: AAAA }');
  error.name = 'NotFound';
  return error;
}

function timeout(): Error {
  const error = new Error('The operation timed out.');
  error.name = 'TimeoutError';
  return error;
}

const records = (a: string[] | Error, aaaa: string[] | Error): Resolver => async (_name, type) => {
  const value = type === 'A' ? a : aaaa;
  if (value instanceof Error) throw value;
  return value;
};

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('resolvesToPublic', () => {
  it('ohne Namensauflösung in der Laufzeit: nicht prüfbar', async () => {
    withDeno(undefined);
    expect(await resolvesToPublic('beispiel.example')).toBe('unchecked');
  });

  it('öffentlich, wenn jede Adresse öffentlich ist — fehlendes AAAA ist normal', async () => {
    withDeno(records(['93.184.216.34'], notFound()));
    expect(await resolvesToPublic('beispiel.example')).toBe('public');
  });

  it('privat, sobald eine Adresse privat ist', async () => {
    withDeno(records(['93.184.216.34', '10.0.0.7'], notFound()));
    expect(await resolvesToPublic('beispiel.example')).toBe('private');
    withDeno(records(notFound(), ['fd00::1']));
    expect(await resolvesToPublic('beispiel.example')).toBe('private');
    withDeno(records(['169.254.169.254'], notFound()));
    expect(await resolvesToPublic('metadata.example')).toBe('private');
  });

  it('Zeitüberschreitung oder Resolverfehler: nicht prüfbar (nicht „öffentlich")', async () => {
    withDeno(records(timeout(), ['2001:4860:4860::8888']));
    expect(await resolvesToPublic('beispiel.example')).toBe('unchecked');
    const servfail = new Error('proto error: SERVFAIL');
    withDeno(records(['93.184.216.34'], servfail));
    expect(await resolvesToPublic('beispiel.example')).toBe('unchecked');
  });

  it('kein Eintrag: löst nicht auf', async () => {
    withDeno(records(notFound(), notFound()));
    expect(await resolvesToPublic('gibt-es-nicht.example')).toBe('unresolved');
  });

  it('gibt jeder Auflösung eine Zeitgrenze mit', async () => {
    const resolver = vi.fn<Resolver>(async () => ['93.184.216.34']);
    withDeno(resolver);
    await resolvesToPublic('beispiel.example', 1234);
    expect(resolver).toHaveBeenCalledTimes(2);
    for (const call of resolver.mock.calls) expect(call[2]?.signal).toBeInstanceOf(AbortSignal);
  });

  it('prüft IP-Literale direkt', async () => {
    withDeno(undefined);
    expect(await resolvesToPublic('127.0.0.1')).toBe('private');
    expect(await resolvesToPublic('[::1]')).toBe('private');
    expect(await resolvesToPublic('93.184.216.34')).toBe('public');
  });
});

describe('safeFetch', () => {
  const deadline = () => Date.now() + 20_000;
  const html = (status = 200, headers: Record<string, string> = { 'content-type': 'text/html' }) => new Response(status >= 300 && status < 400 ? null : '<html></html>', { status, headers });

  it('ruft nicht ab, was sich nicht prüfen lässt', async () => {
    withDeno(undefined);
    const fetchSpy = vi.fn(async () => html());
    vi.stubGlobal('fetch', fetchSpy);
    const result = await safeFetch(new URL('https://beispiel.example/'), 'text/html', 10_000, deadline());
    expect(result).toEqual({ ok: false, reason: 'die Zieladresse ließ sich nicht prüfen' });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('ruft ab, was öffentlich auflöst — ohne Zugangsdaten, Weiterleitungen von Hand', async () => {
    withDeno(records(['93.184.216.34'], notFound()));
    const fetchSpy = vi.fn(async (_url: URL, _init?: RequestInit) => html());
    vi.stubGlobal('fetch', fetchSpy);
    const result = await safeFetch(new URL('https://beispiel.example/'), 'text/html', 10_000, deadline());
    expect(result.ok).toBe(true);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(fetchSpy.mock.calls[0][1]).toMatchObject({ redirect: 'manual', credentials: 'omit' });
  });

  it('prüft jeden Schritt einer Weiterleitung neu — eine private Zieladresse wird nicht abgerufen', async () => {
    withDeno(async (name, type) => {
      if (type === 'AAAA') throw notFound();
      return name === 'intern.example' ? ['192.168.1.10'] : ['93.184.216.34'];
    });
    const fetchSpy = vi.fn(async () => html(302, { location: 'https://intern.example/admin' }));
    vi.stubGlobal('fetch', fetchSpy);
    const result = await safeFetch(new URL('https://beispiel.example/'), 'text/html', 10_000, deadline());
    expect(result).toEqual({ ok: false, reason: 'der Name zeigt auf eine private Adresse' });
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it('eine Weiterleitung auf eine private IP scheitert schon an der Adressprüfung', async () => {
    withDeno(records(['93.184.216.34'], notFound()));
    const fetchSpy = vi.fn(async () => html(301, { location: 'http://169.254.169.254/latest/meta-data/' }));
    vi.stubGlobal('fetch', fetchSpy);
    const result = await safeFetch(new URL('https://beispiel.example/'), 'text/html', 10_000, deadline());
    expect(result.ok).toBe(false);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it('markiert an der Größengrenze gekürzte Dokumente', async () => {
    withDeno(records(['93.184.216.34'], notFound()));
    vi.stubGlobal('fetch', vi.fn(async () => new Response('x'.repeat(5_000), { status: 200, headers: { 'content-type': 'text/html' } })));
    const result = await safeFetch(new URL('https://beispiel.example/'), 'text/html', 1_000, deadline());
    expect(result.ok && result.resource.truncated).toBe(true);
    expect(result.ok && result.resource.bytes.length).toBe(1_000);
  });
});
