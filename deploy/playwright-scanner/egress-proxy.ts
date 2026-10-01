// Egress-Proxy des Node-Executors.
//
// Chromium spricht ausschließlich über diesen Proxy (chromium.launch({ proxy })
// — Playwright erzwingt dabei <-loopback>, also auch localhost/127.0.0.1).
// Jede Verbindung wird gegen den HostGuard geprüft: Navigationen, Redirect-
// Hops, Unterressourcen, WebSockets (Chromium tunnelt sie per CONNECT).
// Verbunden wird nur zu der geprüften Adresse (HostGuard.pin) — ein
// Hostname kann zwischen Prüfung und Verbindung nicht auf eine private
// Adresse umgebogen werden (DNS-Rebinding).
//
// Grund: context.route() sieht HTTP-Redirect-Hops nicht (empirisch geprüft,
// Playwright 1.59) — ohne Proxy erreicht ein 302 auf 169.254.169.254 das Ziel.
// Lauscht nur auf 127.0.0.1; kein TLS-Aufbruch (CONNECT bleibt Ende-zu-Ende).

import * as http from 'node:http';
import * as net from 'node:net';
import type { HostGuard } from './netguard.js';

export interface EgressProxy {
  readonly url: string;
  readonly port: number;
  /** Abgewiesene Verbindungen seit Start. */
  blockedCount(): number;
  close(): Promise<void>;
}

const HOP_BY_HOP = new Set([
  'connection', 'keep-alive', 'proxy-connection', 'proxy-authorization', 'proxy-authenticate',
  'te', 'trailer', 'transfer-encoding', 'upgrade',
]);

const REFUSED = 'HTTP/1.1 403 Forbidden\r\nX-RSD-Egress: blocked\r\nContent-Length: 0\r\nConnection: close\r\n\r\n';
const BAD_GATEWAY = 'HTTP/1.1 502 Bad Gateway\r\nContent-Length: 0\r\nConnection: close\r\n\r\n';

/** "host:port" bzw. "[v6]:port" aus einem CONNECT. */
export function parseAuthority(authority: string): { host: string; port: number } | null {
  const m = /^\[([0-9a-fA-F:.]+)\]:(\d{1,5})$/.exec(authority) ?? /^([A-Za-z0-9._-]+):(\d{1,5})$/.exec(authority);
  if (!m) return null;
  const port = Number(m[2]);
  if (!Number.isInteger(port) || port < 1 || port > 65_535) return null;
  return { host: m[1]!, port };
}

/** Standardports wie in einer URL weglassen (Allowlist-Semantik von netguard). */
function portKey(port: number): string {
  return port === 80 || port === 443 ? '' : String(port);
}

function filterHeaders(headers: http.IncomingHttpHeaders): http.OutgoingHttpHeaders {
  const out: http.OutgoingHttpHeaders = {};
  for (const [name, value] of Object.entries(headers)) {
    if (value === undefined || HOP_BY_HOP.has(name)) continue;
    out[name] = value;
  }
  return out;
}

export async function startEgressProxy(
  guard: HostGuard,
  opts: { connectTimeoutMs?: number; log?: (event: Record<string, unknown>) => void } = {},
): Promise<EgressProxy> {
  const connectTimeoutMs = opts.connectTimeoutMs ?? 15_000;
  const log = opts.log ?? (() => undefined);
  const sockets = new Set<net.Socket>();
  let blocked = 0;

  const refuse = (kind: string): void => {
    blocked += 1;
    // Nur die Art, nie Host/URL: Ziele können Eingaben enthalten.
    log({ event: 'egress_blocked', kind });
  };

  const server = http.createServer((req, res) => {
    void (async () => {
      let url: URL;
      try { url = new URL(req.url ?? ''); } catch {
        res.writeHead(400, { 'content-length': '0' }).end();
        return;
      }
      if (url.protocol !== 'http:' || url.username || url.password) {
        refuse('http_invalid');
        res.writeHead(403, { 'x-rsd-egress': 'blocked', 'content-length': '0' }).end();
        return;
      }
      const port = url.port ? Number(url.port) : 80;
      const address = await guard.pin(url.hostname, portKey(port));
      if (!address) {
        refuse('http');
        res.writeHead(403, { 'content-type': 'text/plain; charset=utf-8', 'x-rsd-egress': 'blocked', 'cache-control': 'no-store' })
          .end('blocked by executor egress policy');
        return;
      }
      const headers = filterHeaders(req.headers);
      headers.host = url.host;
      const upstream = http.request({
        host: address,
        port,
        method: req.method,
        path: `${url.pathname}${url.search}`,
        headers,
        setHost: false,
        timeout: connectTimeoutMs,
      });
      upstream.on('response', (r) => {
        res.writeHead(r.statusCode ?? 502, filterHeaders(r.headers));
        r.pipe(res);
      });
      upstream.on('timeout', () => upstream.destroy(new Error('timeout')));
      upstream.on('error', () => {
        if (!res.headersSent) res.writeHead(502, { 'content-length': '0' }).end();
        else res.destroy();
      });
      req.pipe(upstream);
    })().catch(() => {
      if (!res.headersSent) res.writeHead(502, { 'content-length': '0' }).end();
    });
  });

  server.on('connect', (req: http.IncomingMessage, client: net.Socket, head: Buffer) => {
    void (async () => {
      const target = parseAuthority(req.url ?? '');
      const address = target ? await guard.pin(target.host, portKey(target.port)) : null;
      if (!target || !address) {
        refuse('connect');
        client.end(REFUSED);
        return;
      }
      let connected = false;
      const upstream = net.connect({ host: address, port: target.port });
      upstream.setTimeout(connectTimeoutMs, () => upstream.destroy());
      upstream.once('connect', () => {
        connected = true;
        upstream.setTimeout(0);
        client.write('HTTP/1.1 200 Connection Established\r\n\r\n');
        if (head.length > 0) upstream.write(head);
        upstream.pipe(client);
        client.pipe(upstream);
      });
      upstream.on('error', () => {
        if (!connected && !client.destroyed) client.end(BAD_GATEWAY);
        else client.destroy();
      });
      upstream.on('close', () => client.destroy());
      client.on('error', () => upstream.destroy());
      client.on('close', () => upstream.destroy());
    })().catch(() => client.destroy());
  });

  // Chromium tunnelt WebSockets per CONNECT; ein Upgrade am Proxy selbst ist
  // nie legitim.
  server.on('upgrade', (_req, socket: net.Socket) => {
    refuse('upgrade');
    socket.destroy();
  });

  server.on('connection', (socket: net.Socket) => {
    sockets.add(socket);
    socket.on('close', () => sockets.delete(socket));
  });
  server.maxConnections = 1_024;

  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => resolve());
  });
  const port = (server.address() as net.AddressInfo).port;

  return {
    url: `http://127.0.0.1:${port}`,
    port,
    blockedCount: () => blocked,
    close: () => new Promise<void>((resolve) => {
      for (const s of sockets) s.destroy();
      server.close(() => resolve());
    }),
  };
}
