/**
 * `fetchGuarded` — SSRF-Schranke für gdpr-audit und cookie-scan.
 *
 * Beide Endpunkte sind ohne Anmeldung erreichbar und riefen die
 * Besucher-Adresse mit `redirect: 'follow'` ab. cookie-scan prüfte nur das
 * URL-Format, gdpr-audit nur `localhost` und gepunktete IPv4. Eine
 * öffentliche Seite mit `302 → http://169.254.169.254/…` lenkte beide auf den
 * Metadaten-Endpunkt; IPv6-Literale, `*.internal` und Nicht-Standard-Ports
 * gingen direkt durch.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  fetchGuarded,
  isPrivateResolvedAddress,
  TargetRefusedError,
} from '../../supabase/functions/_shared/public-scan/observe';

function umleitung(nach: string, status = 302): Response {
  return new Response(null, { status, headers: { location: nach } });
}

describe('fetchGuarded', () => {
  it.each([
    'http://169.254.169.254/latest/meta-data/',
    'http://[::1]/',
    'http://[fd00:ec2::254]/',
    'http://[::ffff:a9fe:a9fe]/',
    'http://metadata.google.internal/computeMetadata/v1/',
    'http://localhost:8080/',
    'https://firma.de:8443/',
    'https://user:pw@firma.de/',
    'file:///etc/passwd',
  ])('lehnt %s ab, ohne einen Abruf zu machen', async (ziel) => {
    const besucht: string[] = [];
    await expect(
      fetchGuarded(ziel, { timeoutMs: 1000, fetchImpl: async (input) => { besucht.push(input); return new Response('x'); } }),
    ).rejects.toBeInstanceOf(TargetRefusedError);
    expect(besucht).toEqual([]);
  });

  it('weist eine Weiterleitung auf den Metadaten-Endpunkt zurück — das Ziel wird nie abgerufen', async () => {
    const besucht: string[] = [];
    await expect(
      fetchGuarded('https://firma.de', {
        timeoutMs: 1000,
        fetchImpl: async (input) => {
          besucht.push(input);
          return besucht.length === 1 ? umleitung('http://169.254.169.254/latest/meta-data/') : new Response('geheim');
        },
      }),
    ).rejects.toThrow(/redirect target refused/);
    expect(besucht).toEqual(['https://firma.de/']);
  });

  it('haelt die Deadline bis zum Body-Read aktiv', async () => {
    const res = await fetchGuarded('https://firma.de', {
      timeoutMs: 25,
      fetchImpl: async (_input, init) => {
        const signal = init?.signal;
        const body = new ReadableStream<Uint8Array>({
          start(controller) {
            if (!signal) return;
            const abbrechen = () => controller.error(new DOMException('aborted', 'AbortError'));
            if (signal.aborted) abbrechen();
            else signal.addEventListener('abort', abbrechen, { once: true });
          },
        });
        return new Response(body, { status: 200 });
      },
    });

    await expect(res.text()).rejects.toThrow();
  });

  it('folgt öffentlichen Weiterleitungen manuell, mit den übergebenen Headern; url = gelesene Adresse', async () => {
    const aufrufe: Array<{ input: string; init?: RequestInit }> = [];
    const res = await fetchGuarded('http://firma.de', {
      timeoutMs: 1000,
      headers: { 'user-agent': 'Audit/1.0' },
      fetchImpl: async (input, init) => {
        aufrufe.push({ input, init });
        return aufrufe.length === 1 ? umleitung('https://www.firma.de/') : new Response('<html>ok</html>', { status: 200 });
      },
    });
    expect(aufrufe.map((a) => a.input)).toEqual(['http://firma.de/', 'https://www.firma.de/']);
    expect(aufrufe.every((a) => a.init?.redirect === 'manual')).toBe(true);
    expect((aufrufe[0]!.init?.headers as Record<string, string>)['user-agent']).toBe('Audit/1.0');
    expect(res.url).toBe('https://www.firma.de/');
    expect(await res.text()).toBe('<html>ok</html>');
  });
});

describe('gdpr-audit und cookie-scan nutzen die Schranke (Quelltext)', () => {
  for (const fn of ['gdpr-audit', 'cookie-scan']) {
    const code = readFileSync(`supabase/functions/${fn}/index.ts`, 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/(^|[^:])\/\/.*$/gm, '$1');

    it(`${fn}: kein automatisches Folgen, Abruf nur über fetchGuarded`, () => {
      expect(code).not.toMatch(/redirect:\s*'follow'/);
      expect(code).toContain("from '../_shared/public-scan/observe.ts'");
      expect(code).toMatch(/fetchGuarded\(/);
      expect(code).not.toMatch(/await fetch\((url|target)/);
    });

    it(`${fn}: Eingang über validateScanTarget vor dem ersten Abruf, abgelehnte Weiterleitung → 400`, () => {
      const pruefung = code.indexOf('validateScanTarget(url)');
      const abruf = code.indexOf('await fetchWithTimeout(url');
      expect(pruefung).toBeGreaterThan(-1);
      expect(abruf).toBeGreaterThan(pruefung);
      expect(code).toContain("'REDIRECT_BLOCKED'");
      expect(code).toMatch(/instanceof TargetRefusedError/);
    });
  }
});

/**
 * DNS-Schranke (`assertPublicResolution`). `validateScanTarget` sieht nur den
 * Namen: `127.0.0.1.nip.io` oder ein eigener A-Eintrag auf 10.0.0.5 sahen
 * öffentlich aus und wurden abgerufen. Jetzt wird vor jedem Abruf und vor
 * jeder Weiterleitung aufgelöst; eine einzige private Adresse lehnt ab.
 */
describe('fetchGuarded — DNS-Schranke', () => {
  function aufloeser(tabelle: Record<string, string[]>) {
    const gefragt: string[] = [];
    const resolveImpl = async (host: string) => {
      gefragt.push(host);
      return tabelle[host] ?? [];
    };
    return { resolveImpl, gefragt };
  }

  it.each([
    ['127.0.0.1'],
    ['10.0.0.5'],
    ['169.254.169.254'],
    ['::1'],
    ['fd00::1'],
    ['::ffff:169.254.169.254'],
    ['64:ff9b::a9fe:a9fe'],
    ['::ffff:7f00:1'],
  ])('lehnt einen Namen ab, der auf %s zeigt — ohne Abruf', async (adresse) => {
    const besucht: string[] = [];
    const { resolveImpl } = aufloeser({ 'boese.example': [adresse] });
    await expect(
      fetchGuarded('https://boese.example/', {
        timeoutMs: 1000,
        resolveImpl,
        fetchImpl: async (input) => { besucht.push(input); return new Response('geheim'); },
      }),
    ).rejects.toBeInstanceOf(TargetRefusedError);
    expect(besucht).toEqual([]);
  });

  it('lehnt ab, sobald eine von mehreren Adressen privat ist', async () => {
    const { resolveImpl } = aufloeser({ 'gemischt.example': ['93.184.215.14', '10.0.0.5'] });
    await expect(
      fetchGuarded('https://gemischt.example/', { timeoutMs: 1000, resolveImpl, fetchImpl: async () => new Response('x') }),
    ).rejects.toBeInstanceOf(TargetRefusedError);
  });

  it('prüft jede Weiterleitung: Station mit privater Auflösung wird nie abgerufen', async () => {
    const besucht: string[] = [];
    const { resolveImpl, gefragt } = aufloeser({
      'firma.de': ['93.184.215.14'],
      'intern.example': ['192.168.1.10'],
    });
    await expect(
      fetchGuarded('https://firma.de', {
        timeoutMs: 1000,
        resolveImpl,
        fetchImpl: async (input) => {
          besucht.push(input);
          return umleitung('https://intern.example/admin');
        },
      }),
    ).rejects.toBeInstanceOf(TargetRefusedError);
    expect(besucht).toEqual(['https://firma.de/']);
    expect(gefragt).toEqual(['firma.de', 'intern.example']);
  });

  it('ruft öffentliche Ziele ab, auch IPv6 und NAT64 einer öffentlichen Adresse', async () => {
    const { resolveImpl } = aufloeser({ 'firma.de': ['93.184.215.14', '2606:2800:21f:cb07:6820:80da:af6b:8b2c', '64:ff9b::5db8:d70e'] });
    const res = await fetchGuarded('https://firma.de', {
      timeoutMs: 1000,
      resolveImpl,
      fetchImpl: async () => new Response('<html>ok</html>', { status: 200 }),
    });
    expect(await res.text()).toBe('<html>ok</html>');
  });

  it('ein Name ohne Auflösung ist ein Netzfehler, keine Ablehnung — und kein Abruf', async () => {
    const besucht: string[] = [];
    const { resolveImpl } = aufloeser({});
    const fehler = await fetchGuarded('https://gibt-es-nicht.example/', {
      timeoutMs: 1000,
      resolveImpl,
      fetchImpl: async (input) => { besucht.push(input); return new Response('x'); },
    }).catch((e: unknown) => e);
    expect(fehler).toBeInstanceOf(Error);
    expect(fehler).not.toBeInstanceOf(TargetRefusedError);
    expect((fehler as Error).message).toMatch(/does not resolve/);
    expect(besucht).toEqual([]);
  });

  it('fragt bei einem öffentlichen Adressliteral nicht nach', async () => {
    const { resolveImpl, gefragt } = aufloeser({});
    await fetchGuarded('https://93.184.215.14/', { timeoutMs: 1000, resolveImpl, fetchImpl: async () => new Response('ok') });
    expect(gefragt).toEqual([]);
  });

  it('gibt dem Auflöser die Deadline mit', async () => {
    let erhalten: AbortSignal | undefined;
    await fetchGuarded('https://firma.de', {
      timeoutMs: 1000,
      resolveImpl: async (_host, signal) => { erhalten = signal; return ['93.184.215.14']; },
      fetchImpl: async () => new Response('ok'),
    });
    expect(erhalten).toBeInstanceOf(AbortSignal);
  });
});

describe('isPrivateResolvedAddress', () => {
  it.each([
    ['10.1.2.3', true],
    ['100.64.0.1', true],
    ['::', true],
    ['fe80::1', true],
    ['::127.0.0.1', true],
    ['64:ff9b::10.0.0.1', true],
    ['93.184.215.14', false],
    ['2a00:1450:4001:82f::200e', false],
    ['64:ff9b::808:808', false],
  ])('%s → privat: %s', (adresse, erwartet) => {
    expect(isPrivateResolvedAddress(adresse)).toBe(erwartet);
  });
});

describe('Standard-Auflösung in der Edge-Laufzeit (Quelltext)', () => {
  const code = readFileSync('supabase/functions/_shared/public-scan/observe.ts', 'utf8');

  it('fragt A und AAAA über Deno.resolveDns, mit der Deadline als Signal', () => {
    expect(code).toContain("resolveDns(host, 'A', { signal })");
    expect(code).toContain("resolveDns(host, 'AAAA', { signal })");
  });

  it('prüft vor jedem Abruf, auch vor jeder Weiterleitung', () => {
    const schleife = code.slice(code.indexOf('async function followWithGuard('));
    const pruefung = schleife.indexOf('await assertPublicResolution(current, resolve, signal)');
    const abruf = schleife.indexOf('await fetchImpl(current.toString()');
    expect(pruefung).toBeGreaterThan(-1);
    expect(pruefung).toBeLessThan(abruf);
  });

  it('fetchGuarded und observeSite nutzen beide den Standard-Auflöser', () => {
    expect(code.match(/options\.resolveImpl \?\? defaultResolver\(\)/g)?.length).toBe(2);
  });
});
