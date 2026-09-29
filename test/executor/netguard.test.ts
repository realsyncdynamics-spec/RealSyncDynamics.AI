// @vitest-environment node
/**
 * Netzwerk-Schutz: Edge-Function-Vorprüfung (url.ts) und Executor
 * (netguard.ts) müssen dieselben Hosts als nicht-öffentlich einstufen.
 */
import { describe, expect, it } from 'vitest';
import {
  checkNavigationUrl,
  isStaticallyNonPublicHost as edgeHost,
  parseAllowlist as edgeAllowlist,
} from '../../supabase/functions/_shared/browser-runtime/url';
import {
  assertNavigable,
  createHostGuard,
  isNonPublicAddress,
  isStaticallyNonPublicHost as executorHost,
} from '../../deploy/playwright-scanner/netguard';

const BLOCKED_HOSTS = [
  'localhost', 'localhost.', 'app.localhost', 'printer.local', 'metadata.google.internal', 'intranet',
  'metadata', 'router.lan', 'nas.home.arpa',
  '127.0.0.1', '127.1.2.3', '0.0.0.0', '10.0.0.5', '100.64.0.1', '169.254.169.254', '172.16.0.1', '172.31.255.255',
  '192.168.1.1', '192.0.0.8', '192.0.2.1', '198.18.0.1', '198.51.100.7', '203.0.113.9', '224.0.0.1', '255.255.255.255',
  '[::]', '[::1]', '[::ffff:7f00:1]', '[::ffff:127.0.0.1]', '[::ffff:a9fe:a9fe]', '[fd00:ec2::254]', '[fe80::1]',
  '[fc00::1]', '[ff02::1]', '[2001:db8::1]', '[64:ff9b::a00:1]', '[2002:a00:1::]', '[::7f00:1]',
];

const PUBLIC_HOSTS = [
  'example.com', 'realsyncdynamicsai.de', 'sub.domain.co.uk', '8.8.8.8', '1.1.1.1', '172.32.0.1', '100.128.0.1',
  '[2606:4700:4700::1111]', '[::ffff:808:808]', '[2002:808:808::]',
];

describe('statische Host-Einstufung (Edge ↔ Executor-Parität)', () => {
  it.each(BLOCKED_HOSTS)('%s ist nicht öffentlich', (host) => {
    expect(edgeHost(host)).toBe(true);
    expect(executorHost(host)).toBe(true);
  });

  it.each(PUBLIC_HOSTS)('%s ist öffentlich', (host) => {
    expect(edgeHost(host)).toBe(false);
    expect(executorHost(host)).toBe(false);
  });
});

describe('checkNavigationUrl (Edge-Vorprüfung)', () => {
  it('normalisiert öffentliche Ziele und ergänzt https', () => {
    expect(checkNavigationUrl('example.com/path')).toEqual({ ok: true, url: 'https://example.com/path', host: 'example.com' });
    expect(checkNavigationUrl('example.com:8443/x')).toMatchObject({ ok: true, url: 'https://example.com:8443/x' });
    expect(checkNavigationUrl('https://example.com/#/spa')).toMatchObject({ ok: true, url: 'https://example.com/#/spa' });
  });

  it('lehnt fremde Schemata und Zugangsdaten ab', () => {
    for (const raw of ['file:///etc/passwd', 'javascript:alert(1)', 'data:text/html,x', 'ftp://example.com', 'chrome://settings']) {
      expect(checkNavigationUrl(raw)).toMatchObject({ ok: false, reason: 'SCHEME_NOT_ALLOWED' });
    }
    expect(checkNavigationUrl('https://user:pw@example.com')).toMatchObject({ ok: false, reason: 'CREDENTIALS_NOT_ALLOWED' });
  });

  it('erkennt numerische IPv4-Schreibweisen über den URL-Parser', () => {
    for (const raw of ['http://2130706433/', 'http://0x7f000001/', 'http://0177.0.0.1/', 'http://127.1/', 'http://169.254.169.254/latest/meta-data']) {
      expect(checkNavigationUrl(raw)).toMatchObject({ ok: false, reason: 'PRIVATE_NETWORK_BLOCKED' });
    }
  });

  it('lässt nur ausdrücklich freigegebene private Hosts durch', () => {
    const allow = edgeAllowlist('127.0.0.1:4010, intranet.example.');
    expect(checkNavigationUrl('http://127.0.0.1:4010/', allow).ok).toBe(true);
    expect(checkNavigationUrl('http://127.0.0.1:4011/', allow).ok).toBe(false);
    expect(checkNavigationUrl('http://intranet.example/', allow).ok).toBe(true);
  });
});

describe('Executor-HostGuard mit DNS', () => {
  const resolver = async (host: string) => ({
    'public.test': ['93.184.216.34'],
    'rebind.test': ['93.184.216.34', '10.0.0.1'],
    'v6private.test': ['fd00::1'],
    'metadata.test': ['169.254.169.254'],
  } as Record<string, string[]>)[host] ?? [];

  it('verlangt, dass JEDE aufgelöste Adresse öffentlich ist', async () => {
    const guard = createHostGuard([], resolver);
    expect(await guard.allows('public.test', '')).toBe(true);
    expect(await guard.allows('rebind.test', '')).toBe(false);
    expect(await guard.allows('v6private.test', '')).toBe(false);
    expect(await guard.allows('metadata.test', '')).toBe(false);
    expect(await guard.allows('unknown.test', '')).toBe(false);
  });

  it('assertNavigable wirft stabile Codes', async () => {
    const guard = createHostGuard([], resolver);
    await expect(assertNavigable('file:///etc/passwd', guard)).rejects.toThrow('INVALID_URL');
    await expect(assertNavigable('https://a:b@public.test/', guard)).rejects.toThrow('URL_CREDENTIALS_NOT_ALLOWED');
    await expect(assertNavigable('https://metadata.test/', guard)).rejects.toThrow('PRIVATE_NETWORK_BLOCKED');
    await expect(assertNavigable('https://public.test/x', guard)).resolves.toBeInstanceOf(URL);
  });

  it('unbekannte Adressformate gelten als nicht öffentlich (fail closed)', () => {
    expect(isNonPublicAddress('not-an-ip')).toBe(true);
    expect(isNonPublicAddress('8.8.4.4')).toBe(false);
  });
});
