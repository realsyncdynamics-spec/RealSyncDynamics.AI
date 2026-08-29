/**
 * Zielprüfung des öffentlichen Scans.
 *
 * Sicherheitsrelevanz: Der Scan ruft eine Adresse ab, die ein **nicht
 * angemeldeter** Besucher bestimmt. Fällt diese Schranke, wird die Edge
 * Function zum Werkzeug für Anfragen ins interne Netz und an
 * Cloud-Metadaten-Endpunkte (SSRF). Die Fälle unten sind deshalb keine
 * Stilfragen — jeder einzelne ist ein Angriffspfad.
 */
import { describe, expect, it } from 'vitest';
import {
  isPrivateAddressLiteral,
  normalizeScanInput,
  validateScanTarget,
} from '../../supabase/functions/_shared/public-scan/target';

describe('normalizeScanInput', () => {
  it('ergänzt https bei einer nackten Domain', () => {
    expect(normalizeScanInput('firma.de')).toBe('https://firma.de');
  });

  it('lässt ein vorhandenes Schema unberührt', () => {
    expect(normalizeScanInput('http://firma.de')).toBe('http://firma.de');
    expect(normalizeScanInput('https://firma.de/pfad')).toBe('https://firma.de/pfad');
  });

  it('biegt ein fremdes Schema nicht still auf https um', () => {
    // Sonst würde `file:///etc/passwd` zu `https://file:///etc/passwd`
    // umgeschrieben und die Ablehnung fiele weniger deutlich aus.
    expect(normalizeScanInput('file:///etc/passwd')).toBe('file:///etc/passwd');
  });

  it('entfernt Leerraum und ein mitkopiertes @', () => {
    expect(normalizeScanInput('  @firma.de  ')).toBe('https://firma.de');
  });

  it('gibt bei leerer Eingabe eine leere Zeichenkette zurück', () => {
    expect(normalizeScanInput('   ')).toBe('');
  });
});

describe('validateScanTarget — zugelassene Ziele', () => {
  it('nimmt eine gewöhnliche Domain an', () => {
    const result = validateScanTarget('firma.de');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.domain).toBe('firma.de');
      expect(result.url.protocol).toBe('https:');
    }
  });

  it('nimmt eine Unterseite an — wer eine Unterseite prüfen will, darf das', () => {
    const result = validateScanTarget('https://firma.de/impressum');
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.url.pathname).toBe('/impressum');
  });

  it('nimmt die Standard-Ports an', () => {
    expect(validateScanTarget('https://firma.de:443').ok).toBe(true);
    expect(validateScanTarget('http://firma.de:80').ok).toBe(true);
  });
});

describe('validateScanTarget — SSRF-Schranke', () => {
  const abgelehnt: [string, string][] = [
    ['file:///etc/passwd', 'Datei-Schema'],
    ['gopher://firma.de', 'exotisches Schema'],
    ['http://localhost', 'localhost'],
    ['http://LOCALHOST', 'localhost in Großschreibung'],
    ['http://dienst.internal', 'interne Zone'],
    ['http://nas.local', 'lokale Zone'],
    ['http://router.home.arpa', 'Heimnetz-Zone'],
    ['http://127.0.0.1', 'Loopback'],
    ['http://10.0.0.5', 'privates Netz 10/8'],
    ['http://172.16.0.1', 'privates Netz 172.16/12'],
    ['http://172.31.255.254', 'oberes Ende von 172.16/12'],
    ['http://192.168.1.1', 'privates Netz 192.168/16'],
    ['http://169.254.169.254', 'Cloud-Metadaten'],
    ['http://100.64.0.1', 'Carrier-Grade NAT'],
    ['http://0.0.0.0', 'unspezifizierte Adresse'],
    ['http://[::1]', 'IPv6-Loopback'],
    ['http://[fd00::1]', 'IPv6 Unique-Local'],
    ['http://[fe80::1]', 'IPv6 Link-Local'],
    ['http://[::ffff:169.254.169.254]', 'IPv4-gemappte Metadaten-Adresse'],
    ['http://firma.de:8080', 'Nicht-Standard-Port'],
    ['http://firma.de:22', 'SSH-Port'],
    ['https://admin:geheim@firma.de', 'Zugangsdaten in der URL'],
    ['http://intranet', 'Kurzname ohne Punkt'],
  ];

  it.each(abgelehnt)('lehnt %s ab (%s)', (eingabe) => {
    const result = validateScanTarget(eingabe);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason.length).toBeGreaterThan(0);
  });

  it.each([
    ['http://0177.0.0.1', 'oktal'],
    ['http://0x7f.0.0.1', 'hexadezimal'],
    ['http://2130706433', 'als Ganzzahl'],
    ['http://127.1', 'verkürzt'],
  ])('lehnt %s ab — Loopback in ausweichender Schreibweise (%s)', (eingabe) => {
    // Der WHATWG-Parser vereinheitlicht diese Formen zu 127.0.0.1, bevor
    // die Schranke greift. Der Test hält fest, dass wir uns darauf
    // verlassen — und schlägt an, falls eine Laufzeit das anders macht.
    expect(validateScanTarget(eingabe).ok).toBe(false);
  });

  it('sperrt eine öffentliche Adresse nicht wegen führender Null', () => {
    // 010.0.0.1 normalisiert zu 8.0.0.1 und ist damit öffentlich. Eine
    // eigene Oktal-Regel hätte hier fälschlich abgelehnt.
    expect(validateScanTarget('http://010.0.0.1').ok).toBe(true);
  });

  it('meldet einen für Menschen lesbaren Grund', () => {
    const result = validateScanTarget('nicht mal ansatzweise eine url');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toMatch(/Adresse|Domain/);
  });
});

describe('isPrivateAddressLiteral', () => {
  it('hält öffentliche Adressen für öffentlich', () => {
    expect(isPrivateAddressLiteral('8.8.8.8')).toBe(false);
    expect(isPrivateAddressLiteral('93.184.216.34')).toBe(false);
    expect(isPrivateAddressLiteral('172.32.0.1')).toBe(false); // knapp außerhalb 172.16/12
    expect(isPrivateAddressLiteral('192.169.0.1')).toBe(false);
  });

  it('behandelt Hostnamen, die keine Adressliterale sind, als unauffällig', () => {
    expect(isPrivateAddressLiteral('firma.de')).toBe(false);
  });
});
