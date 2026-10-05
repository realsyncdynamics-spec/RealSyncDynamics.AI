// @vitest-environment node
/**
 * Egress-Proxy des Node-Executors: jede Verbindung des Browsers — auch
 * Redirect-Hops, die context.route() nicht sieht — wird DNS-gepinnt gegen den
 * HostGuard geprüft. Gesperrte Ziele werden nie kontaktiert.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createServer, request, type Server } from 'node:http';
import { connect, type AddressInfo } from 'node:net';
import { createHostGuard } from '../../deploy/playwright-scanner/netguard';
import { forwardableStatus, parseAuthority, startEgressProxy, type EgressProxy } from '../../deploy/playwright-scanner/egress-proxy';

let allowed: Server;
let blocked: Server;
let allowedPort = 0;
let blockedPort = 0;
let blockedConnections = 0;
let proxy: EgressProxy;
const resolved: string[] = [];
const logged: Array<Record<string, unknown>> = [];

function listen(server: Server): Promise<number> {
  return new Promise((ok) => server.listen(0, '127.0.0.1', () => ok((server.address() as AddressInfo).port)));
}

/** Rohes CONNECT; liefert die Statuszeile und den offenen Socket. */
function rawConnect(authority: string): Promise<{ status: string; socket: import('node:net').Socket }> {
  return new Promise((resolve, reject) => {
    const socket = connect(proxy.port, '127.0.0.1', () => {
      socket.write(`CONNECT ${authority} HTTP/1.1\r\nHost: ${authority}\r\n\r\n`);
    });
    let buf = '';
    const onData = (chunk: Buffer) => {
      buf += chunk.toString('latin1');
      const end = buf.indexOf('\r\n\r\n');
      if (end >= 0) {
        socket.off('data', onData);
        resolve({ status: buf.split('\r\n')[0] ?? '', socket });
      }
    };
    socket.on('data', onData);
    socket.on('error', reject);
  });
}

function viaProxy(url: string, extraHeaders: Record<string, string> = {}): Promise<{ status: number; body: string; egress: string | undefined; raw: string[] }> {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const req = request({ host: '127.0.0.1', port: proxy.port, path: url, headers: { host: u.host, ...extraHeaders } }, (res) => {
      let body = '';
      res.on('data', (c) => { body += c; });
      res.on('end', () => resolve({ status: res.statusCode ?? 0, body, egress: res.headers['x-rsd-egress'] as string | undefined, raw: res.rawHeaders }));
    });
    req.on('error', reject);
    req.end();
  });
}

beforeAll(async () => {
  allowed = createServer((req, res) => {
    if (req.url === '/headers') {
      // Doppelte Set-Cookie, Hop-by-Hop und ein feindlicher Header-Name.
      res.writeHead(200, ['Content-Type', 'application/json', 'Set-Cookie', 'a=1', 'Set-Cookie', 'b=2', 'Keep-Alive', 'timeout=77', '__proto__', 'x', 'Connection', 'close']);
      res.end(JSON.stringify(req.rawHeaders));
      return;
    }
    const status = /^\/status\/(\d{3})$/.exec(req.url ?? '');
    if (status) {
      res.writeHead(Number(status[1]), { 'content-type': 'text/plain', connection: 'close' });
      res.end('UPSTREAM-BODY');
      return;
    }
    res.writeHead(200, { 'content-type': 'text/plain', connection: 'close' });
    res.end(`allowed:${req.url}`);
  });
  allowedPort = await listen(allowed);
  blocked = createServer((_req, res) => { res.writeHead(200); res.end('SECRET'); });
  blocked.on('connection', () => { blockedConnections += 1; });
  blockedPort = await listen(blocked);

  const guard = createHostGuard([`127.0.0.1:${allowedPort}`], async (host) => {
    resolved.push(host);
    return host === 'internal.test' ? ['10.0.0.1'] : host === 'metadata.test' ? ['169.254.169.254'] : [];
  });
  proxy = await startEgressProxy(guard, { log: (e) => logged.push(e) });
});

afterAll(async () => {
  await proxy?.close();
  await new Promise((r) => allowed?.close(r));
  await new Promise((r) => blocked?.close(r));
});

describe('Egress-Proxy', () => {
  it('lauscht nur auf Loopback', () => {
    expect(proxy.url).toBe(`http://127.0.0.1:${proxy.port}`);
  });

  it('CONNECT zu nicht freigegebenem privaten Ziel: 403, Ziel nie kontaktiert', async () => {
    const before = proxy.blockedCount();
    const { status, socket } = await rawConnect(`127.0.0.1:${blockedPort}`);
    socket.destroy();
    expect(status).toBe('HTTP/1.1 403 Forbidden');
    expect(blockedConnections).toBe(0);
    expect(proxy.blockedCount()).toBe(before + 1);
  });

  it('CONNECT zu privat auflösenden Namen und Metadaten: 403', async () => {
    for (const authority of ['internal.test:443', 'metadata.test:80', '169.254.169.254:80', '[::1]:443', 'localhost:443']) {
      const { status, socket } = await rawConnect(authority);
      socket.destroy();
      expect(status, authority).toBe('HTTP/1.1 403 Forbidden');
    }
    expect(resolved).toEqual(expect.arrayContaining(['internal.test', 'metadata.test']));
    expect(resolved).not.toContain('localhost'); // statisch gesperrt, ohne DNS
  });

  it('CONNECT zu freigegebenem Ziel: Tunnel steht, Daten fließen', async () => {
    const { status, socket } = await rawConnect(`127.0.0.1:${allowedPort}`);
    expect(status).toBe('HTTP/1.1 200 Connection Established');
    const body = await new Promise<string>((resolve) => {
      let data = '';
      socket.on('data', (c) => { data += c.toString(); });
      socket.on('end', () => resolve(data));
      socket.write(`GET /tunnel HTTP/1.1\r\nHost: 127.0.0.1:${allowedPort}\r\nConnection: close\r\n\r\n`);
    });
    expect(body).toContain('allowed:/tunnel');
  });

  it('HTTP über den Proxy: gesperrtes Ziel 403 mit Kennung, Ziel nie kontaktiert', async () => {
    const out = await viaProxy(`http://127.0.0.1:${blockedPort}/latest/meta-data`);
    expect(out.status).toBe(403);
    expect(out.egress).toBe('blocked');
    expect(out.body).not.toContain('SECRET');
    expect(blockedConnections).toBe(0);
  });

  it('HTTP über den Proxy: freigegebenes Ziel wird weitergereicht', async () => {
    const out = await viaProxy(`http://127.0.0.1:${allowedPort}/page?q=1`);
    expect(out).toMatchObject({ status: 200, body: 'allowed:/page?q=1' });
  });

  it('reicht Header als Paare durch: ohne Hop-by-Hop, Host = Ziel, doppelte Set-Cookie bleiben', async () => {
    const out = await viaProxy(`http://127.0.0.1:${allowedPort}/headers`, { 'proxy-authorization': 'Basic Zm9vOmJhcg==', 'x-trace': '1' });
    expect(out.status).toBe(200);
    const sent = JSON.parse(out.body) as string[];
    const sentNames = sent.filter((_, i) => i % 2 === 0).map((n) => n.toLowerCase());
    expect(sentNames).not.toContain('proxy-authorization');
    expect(sent[sentNames.indexOf('host') * 2 + 1]).toBe(`127.0.0.1:${allowedPort}`);
    expect(sentNames).toContain('x-trace');
    const names = out.raw.filter((_, i) => i % 2 === 0).map((n) => n.toLowerCase());
    expect(names.filter((n) => n === 'set-cookie')).toHaveLength(2);
    // Hop-by-Hop des Ziels kommt nicht durch (Node setzt für die eigene Verbindung ggf. eigene Werte).
    expect(out.raw).not.toContain('timeout=77');
    expect(names).toContain('__proto__'); // als Header durchgereicht, nie als Objekt-Schlüssel
  });

  it('Statuscodes: 200–599 werden durchgereicht, anomale Antworten werden 502 ohne Inhalt des Ziels', async () => {
    expect(await viaProxy(`http://127.0.0.1:${allowedPort}/status/299`)).toMatchObject({ status: 299, body: 'UPSTREAM-BODY' });
    expect(await viaProxy(`http://127.0.0.1:${allowedPort}/status/404`)).toMatchObject({ status: 404, body: 'UPSTREAM-BODY' });
    expect(await viaProxy(`http://127.0.0.1:${allowedPort}/status/502`)).toMatchObject({ status: 502, body: 'UPSTREAM-BODY' });
    expect(await viaProxy(`http://127.0.0.1:${allowedPort}/status/799`)).toMatchObject({ status: 502, body: '' });
  });

  it('ungültige CONNECT-Ziele werden abgewiesen', async () => {
    for (const authority of ['no-port', 'host:99999', 'host:0']) {
      const { status, socket } = await rawConnect(authority);
      socket.destroy();
      expect(status, authority).toBe('HTTP/1.1 403 Forbidden');
    }
  });

  it('protokolliert nur die Art, nie Ziele', () => {
    expect(logged.length).toBeGreaterThan(0);
    for (const e of logged) expect(Object.keys(e).sort()).toEqual(['event', 'kind']);
    expect(JSON.stringify(logged)).not.toContain('127.0.0.1');
  });
});

describe('parseAuthority', () => {
  it('liest Host und Port, auch IPv6', () => {
    expect(parseAuthority('example.com:443')).toEqual({ host: 'example.com', port: 443 });
    expect(parseAuthority('[2606:4700::1111]:443')).toEqual({ host: '2606:4700::1111', port: 443 });
    expect(parseAuthority('example.com')).toBeNull();
    expect(parseAuthority('example.com:0')).toBeNull();
    expect(parseAuthority('exa mple.com:80')).toBeNull();
  });
});

describe('forwardableStatus', () => {
  it('nur endgültige Codes 200–599', () => {
    for (const code of [200, 204, 301, 404, 599]) expect(forwardableStatus(code)).toBe(code);
    for (const code of [undefined, 0, 100, 101, 199, 600, 799, 999, 200.5, Number.NaN]) expect(forwardableStatus(code)).toBeNull();
  });
});
