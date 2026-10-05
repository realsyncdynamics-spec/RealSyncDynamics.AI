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
