// Governed Browser Runtime — statische URL-/Adressprüfung (rein, importfrei).
//
// Verteidigung in der Tiefe: Die Edge Function lehnt Navigationsziele ab, die
// schon ohne DNS als nicht-öffentlich erkennbar sind. Der Executor prüft
// zusätzlich nach DNS-Auflösung und für jede Unterressource
// (deploy/playwright-scanner/netguard.ts — gleiche Regeln, Paritätstest in
// test/browser-runtime/netguard-parity.test.ts).
//
// Blockiert (sofern nicht ausdrücklich administrativ freigegeben):
//   - andere Schemata als http/https (file:, data:, javascript:, ftp:, chrome: …)
//   - Zugangsdaten in der URL
//   - localhost, *.localhost, *.local, *.internal, *.lan, *.home.arpa,
//     einteilige Hostnamen (Intranet, z. B. „metadata")
//   - private, Loopback-, Link-Local-, CGNAT-, Dokumentations-, Multicast-
//     und reservierte IPv4/IPv6-Adressen inkl. eingebetteter IPv4
//     (::ffff:a.b.c.d, 64:ff9b::/96, 2002::/16, ::a.b.c.d)
//   - Metadaten-Endpunkte (169.254.169.254, fd00:ec2::254, metadata.google.internal)

export type UrlCheck =
  | { ok: true; url: string; host: string }
  | {
      ok: false;
      reason: 'INVALID_URL' | 'SCHEME_NOT_ALLOWED' | 'CREDENTIALS_NOT_ALLOWED' | 'PRIVATE_NETWORK_BLOCKED';
    };

const BLOCKED_SUFFIXES = ['.localhost', '.local', '.internal', '.intranet', '.lan', '.home.arpa', '.corp'];

export function parseIPv4(host: string): [number, number, number, number] | null {
  const m = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (!m) return null;
  const parts = m.slice(1).map(Number) as [number, number, number, number];
  return parts.every((p) => p >= 0 && p <= 255) ? parts : null;
}

export function isNonPublicIPv4([a, b, c]: [number, number, number, number], d = 0): boolean {
  if (a === 0) return true;                                  // 0.0.0.0/8
  if (a === 10) return true;                                 // 10/8
  if (a === 100 && b >= 64 && b <= 127) return true;         // 100.64/10 CGNAT
  if (a === 127) return true;                                // Loopback
  if (a === 169 && b === 254) return true;                   // Link-Local, Metadaten
  if (a === 172 && b >= 16 && b <= 31) return true;          // 172.16/12
  if (a === 192 && b === 0 && (c === 0 || c === 2)) return true; // 192.0.0/24, TEST-NET-1
  if (a === 192 && b === 88 && c === 99) return true;        // 6to4-Relay
  if (a === 192 && b === 168) return true;                   // 192.168/16
  if (a === 198 && (b === 18 || b === 19)) return true;      // 198.18/15 Benchmark
  if (a === 198 && b === 51 && c === 100) return true;       // TEST-NET-2
  if (a === 203 && b === 0 && c === 113) return true;        // TEST-NET-3
  if (a >= 224) return true;                                 // Multicast, reserviert, Broadcast
  void d;
  return false;
}

/** IPv6 → 8 Gruppen à 16 Bit; akzeptiert '::' und eine eingebettete IPv4 am Ende. */
export function parseIPv6(input: string): number[] | null {
  let host = input;
  if (host.startsWith('[') && host.endsWith(']')) host = host.slice(1, -1);
  const zone = host.indexOf('%');
  if (zone >= 0) host = host.slice(0, zone);
  if (!host.includes(':')) return null;

  let tail: number[] = [];
  const lastColon = host.lastIndexOf(':');
  const maybeV4 = host.slice(lastColon + 1);
  if (maybeV4.includes('.')) {
    const v4 = parseIPv4(maybeV4);
    if (!v4) return null;
    tail = [(v4[0] << 8) | v4[1], (v4[2] << 8) | v4[3]];
    host = host.slice(0, lastColon + 1) + '0:0';
  }

  const halves = host.split('::');
  if (halves.length > 2) return null;
  const parseGroups = (s: string): number[] | null => {
    if (s === '') return [];
    const groups = s.split(':');
    const out: number[] = [];
    for (const g of groups) {
      if (!/^[0-9a-f]{1,4}$/i.test(g)) return null;
      out.push(parseInt(g, 16));
    }
    return out;
  };
  const head = parseGroups(halves[0]);
  const rest = halves.length === 2 ? parseGroups(halves[1]) : [];
  if (!head || !rest) return null;
  let groups: number[];
  if (halves.length === 2) {
    const fill = 8 - head.length - rest.length;
    if (fill < 1) return null;
    groups = [...head, ...new Array(fill).fill(0), ...rest];
  } else {
    groups = head;
  }
  if (groups.length !== 8) return null;
  if (tail.length === 2) {
    groups[6] = tail[0];
    groups[7] = tail[1];
  }
  return groups;
}

function embeddedV4(hi: number, lo: number): [number, number, number, number] {
  return [hi >> 8, hi & 0xff, lo >> 8, lo & 0xff];
}

export function isNonPublicIPv6(g: number[]): boolean {
  const allZeroUntil = (n: number) => g.slice(0, n).every((x) => x === 0);
  if (g.every((x) => x === 0)) return true;                                   // ::
  if (allZeroUntil(7) && g[7] === 1) return true;                             // ::1
  if (allZeroUntil(5) && g[5] === 0xffff) return isNonPublicIPv4(embeddedV4(g[6], g[7])); // ::ffff:a.b.c.d
  if (allZeroUntil(6)) return isNonPublicIPv4(embeddedV4(g[6], g[7]));        // ::a.b.c.d (veraltet)
  if (g[0] === 0x64 && g[1] === 0xff9b && g.slice(2, 6).every((x) => x === 0)) {
    return isNonPublicIPv4(embeddedV4(g[6], g[7]));                           // NAT64
  }
  if (g[0] === 0x2002) return isNonPublicIPv4(embeddedV4(g[1], g[2]));        // 6to4
  if ((g[0] & 0xfe00) === 0xfc00) return true;                                // fc00::/7 ULA (inkl. fd00:ec2::254)
  if ((g[0] & 0xffc0) === 0xfe80) return true;                                // fe80::/10
  if ((g[0] & 0xffc0) === 0xfec0) return true;                                // fec0::/10
  if ((g[0] & 0xff00) === 0xff00) return true;                                // Multicast
  if (g[0] === 0x2001 && g[1] === 0x0db8) return true;                        // Dokumentation
  if (g[0] === 0x0100 && g.slice(1, 4).every((x) => x === 0)) return true;    // Discard 100::/64
  return false;
}

/** true, wenn der Host (IP-Literal oder Name) ohne DNS als nicht-öffentlich gilt. */
export function isStaticallyNonPublicHost(rawHost: string): boolean {
  let host = rawHost.toLowerCase();
  if (host.endsWith('.')) host = host.slice(0, -1);
  if (host.length === 0) return true;
  const v4 = parseIPv4(host);
  if (v4) return isNonPublicIPv4(v4);
  const v6 = parseIPv6(host);
  if (v6) return isNonPublicIPv6(v6);
  if (host.startsWith('[')) return true; // unparsebares IPv6-Literal
  if (host === 'localhost') return true;
  if (BLOCKED_SUFFIXES.some((s) => host.endsWith(s))) return true;
  if (!host.includes('.')) return true; // einteilige Namen: Intranet/Metadaten
  return false;
}

function normalizeAllowEntry(entry: string): string {
  return entry.trim().toLowerCase().replace(/\.$/, '');
}

/**
 * Prüft ein Navigationsziel. `allowPrivateHosts` enthält ausdrücklich
 * administrativ freigegebene Einträge `host` oder `host:port` (z. B. für
 * lokale Integrationstests); leer = keine Ausnahme.
 */
export function checkNavigationUrl(raw: string, allowPrivateHosts: readonly string[] = []): UrlCheck {
  const trimmed = raw.trim();
  if (trimmed.length === 0 || trimmed.length > 2048) return { ok: false, reason: 'INVALID_URL' };
  // „example.com:8080/x" ist Host:Port, kein Schema; nur „scheme://" oder ein
  // bekanntes Nicht-HTTP-Schema (javascript:, data:, file: …) zählt als Schema.
  const hasScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed)
    || /^(javascript|data|file|vbscript|blob|about|chrome|chrome-extension|mailto|ftp|ws|wss|view-source):/i.test(trimmed);
  const candidate = hasScheme ? trimmed : `https://${trimmed}`;
  let url: URL;
  try {
    url = new URL(candidate);
  } catch {
    return { ok: false, reason: 'INVALID_URL' };
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return { ok: false, reason: 'SCHEME_NOT_ALLOWED' };
  if (url.username || url.password) return { ok: false, reason: 'CREDENTIALS_NOT_ALLOWED' };
  const host = url.hostname.toLowerCase().replace(/\.$/, '');
  if (!host) return { ok: false, reason: 'INVALID_URL' };

  const allow = new Set(allowPrivateHosts.map(normalizeAllowEntry).filter(Boolean));
  const hostPort = url.port ? `${host}:${url.port}` : host;
  const explicitlyAllowed = allow.has(hostPort) || (!url.port && allow.has(host));
  if (!explicitlyAllowed && isStaticallyNonPublicHost(host)) {
    return { ok: false, reason: 'PRIVATE_NETWORK_BLOCKED' };
  }
  return { ok: true, url: url.toString(), host };
}

/**
 * Form einer NICHT freigegebenen Roh-URL für Ereignis, Nachweis und Log:
 * nie Zugangsdaten, Query oder Fragment (können Passwörter/Tokens tragen und
 * lägen sonst für alle Mitglieder lesbar und unlöschbar in der Kette).
 * Nicht-HTTP-Schemata nur als Schema; Unlesbares als Platzhalter.
 */
export function recordableUrl(raw: string): string {
  const trimmed = String(raw ?? '').trim().slice(0, 4096);
  const hasScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed)
    || /^(javascript|data|file|vbscript|blob|about|chrome|chrome-extension|mailto|ftp|ws|wss|view-source):/i.test(trimmed);
  let url: URL;
  try {
    url = new URL(hasScheme ? trimmed : `https://${trimmed}`);
  } catch {
    return '[invalid-url]';
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return `${url.protocol}[redacted]`;
  return `${url.protocol}//${url.host}${url.pathname}`.slice(0, 2048);
}

export function parseAllowlist(value: string | undefined | null): string[] {
  if (!value) return [];
  return value.split(',').map(normalizeAllowEntry).filter((s) => s.length > 0 && s.length <= 300).slice(0, 20);
}
