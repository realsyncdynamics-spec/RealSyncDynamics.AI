// Lokaler Egress-Proxy für Chromium.
//
// Warum: Playwright-Routen sehen bei Weiterleitungen nur die erste Anfrage
// (lokal nachgewiesen, siehe Entwicklungsentwurf C1). Jede Verbindung des
// Browsers läuft deshalb hier durch:
//   - nur Ports 80/443,
//   - Hostname wird HIER aufgelöst; alle Adressen müssen öffentlich sein,
//   - verbunden wird mit genau der geprüften Adresse (kein DNS-Rebinding
//     zwischen Prüfung und Verbindung).
// Pfade und Inhalte sieht der Proxy bei HTTPS nicht — das prüfen Guardian
// und Route-Wächter. Der Proxy schützt die Netzgrenze.

import http from 'node:http';
import net from 'node:net';
import { isPrivateHostLiteral } from '../../../packages/browser-guardian/src/policy.ts';

export type Resolver = (hostname: string) => Promise<string[]>;
export type Dial = (address: string, port: number) => net.Socket;

export interface EgressProxyOptions {
  resolveHost: Resolver;
  /** Nur für Tests ersetzbar. Standard: TCP zur geprüften Adresse. */
  dial?: Dial;
  allowedPorts?: number[];
}

export interface EgressProxy {
  url: string;
  blocked: () => number;
  close: () => Promise<void>;
}

const defaultDial: Dial = (address, port) => net.connect({ host: address, port });

export async function startEgressProxy(opts: EgressProxyOptions): Promise<EgressProxy> {
  const dial = opts.dial ?? defaultDial;
  const ports = new Set(opts.allowedPorts ?? [80, 443]);
  let blocked = 0;

  async function pinned(hostname: string, port: number): Promise<string | null> {
    const host = hostname.replace(/^\[|\]$/g, '');
    if (!ports.has(port) || isPrivateHostLiteral(host)) return null;
    let addresses: string[];
    try {
      addresses = net.isIP(host) ? [host] : await opts.resolveHost(host);
    } catch {
      return null;
    }
    if (addresses.length === 0 || addresses.some((a) => isPrivateHostLiteral(a))) return null;
    return addresses[0];
  }

  const server = http.createServer(async (req, res) => {
    // Klartext-HTTP in absoluter Form (Proxy-Anfrage).
    let target: URL;
    try { target = new URL(req.url ?? ''); } catch { blocked += 1; req.socket.destroy(); return; }
    const port = Number(target.port || 80);
    const address = target.protocol === 'http:' ? await pinned(target.hostname, port) : null;
    // Verbindung kappen statt 403: sonst zeigt Chromium die Antwort als Seite
    // unter der gesperrten Adresse an.
    if (!address) { blocked += 1; req.socket.destroy(); return; }
    const headers = { ...req.headers };
    delete headers['proxy-connection'];
    delete headers['proxy-authorization'];
    const upstream = http.request({
      method: req.method,
      path: `${target.pathname}${target.search}`,
      headers,
      createConnection: () => dial(address, port),
    }, (up) => {
      res.writeHead(up.statusCode ?? 502, up.headers);
      up.pipe(res);
    });
    upstream.on('error', () => { if (!res.headersSent) res.writeHead(502); res.end(); });
    req.pipe(upstream);
  });

  server.on('connect', async (req, client: net.Socket, head: Buffer) => {
    const [host, portRaw] = (req.url ?? '').split(/:(?=\d+$)/);
    const address = await pinned(host ?? '', Number(portRaw));
    if (!address) {
      blocked += 1;
      client.end('HTTP/1.1 403 Forbidden\r\nx-realsync-guardian: blocked\r\n\r\n');
      return;
    }
    const upstream = dial(address, Number(portRaw));
    upstream.on('connect', () => {
      client.write('HTTP/1.1 200 Connection Established\r\n\r\n');
      if (head.length) upstream.write(head);
      upstream.pipe(client);
      client.pipe(upstream);
    });
    const fail = () => { client.destroy(); upstream.destroy(); };
    upstream.on('error', fail);
    client.on('error', fail);
  });

  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address() as net.AddressInfo;
  return {
    url: `http://127.0.0.1:${port}`,
    blocked: () => blocked,
    close: () => new Promise<void>((resolve) => { server.closeAllConnections(); server.close(() => resolve()); }),
  };
}
