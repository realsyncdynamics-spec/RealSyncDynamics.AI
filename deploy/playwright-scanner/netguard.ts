// Netzwerk-Schutz des Browser-Executors (SSRF, private Netze, Metadaten).
//
// Gleiche Regeln wie supabase/functions/_shared/browser-runtime/url.ts —
// die Parität prüft test/executor/netguard.test.ts. Zusätzlich hier:
// DNS-Auflösung (jede aufgelöste Adresse muss öffentlich sein) und ein
// kurzer Cache, weil der Route-Guard jede Unterressource prüft.
//
// Laufzeitneutral (Node und Cloudflare Workers): kein node:-Import. Der
// Resolver wird injiziert — Node: node-resolver.ts (System-DNS),
// Workers: createDohResolver (DNS über HTTPS).
//
// Grenze des Route-Guards (empirisch geprüft, Playwright 1.59): HTTP-
// Redirect-Hops laufen NICHT durch context.route(). Im Node-Executor
// schließt der Egress-Proxy (egress-proxy.ts) diese Lücke — er verbindet nur
// zu der hier geprüften Adresse (DNS-gepinnt, auch gegen Rebinding). Im
// Cloudflare-Executor bleibt die Landeprüfung (isLandingAllowed) die Grenze.

const BLOCKED_SUFFIXES = ['.localhost', '.local', '.internal', '.intranet', '.lan', '.home.arpa', '.corp'];

export function parseIPv4(host: string): [number, number, number, number] | null {
  const m = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (!m) return null;
  const parts = [Number(m[1]), Number(m[2]), Number(m[3]), Number(m[4])] as [number, number, number, number];
  return parts.every((p) => p >= 0 && p <= 255) ? parts : null;
}

export function isNonPublicIPv4([a, b, c]: [number, number, number, number]): boolean {
  if (a === 0 || a === 10 || a === 127) return true;
  if (a === 100 && b >= 64 && b <= 127) return true;
  if (a === 169 && b === 254) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 0 && (c === 0 || c === 2)) return true;
  if (a === 192 && b === 88 && c === 99) return true;
  if (a === 192 && b === 168) return true;
  if (a === 198 && (b === 18 || b === 19)) return true;
  if (a === 198 && b === 51 && c === 100) return true;
  if (a === 203 && b === 0 && c === 113) return true;
  if (a >= 224) return true;
  return false;
}

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
    const out: number[] = [];
    for (const g of s.split(':')) {
      if (!/^[0-9a-f]{1,4}$/i.test(g)) return null;
      out.push(parseInt(g, 16));
    }
    return out;
  };
  const head = parseGroups(halves[0] ?? '');
  const rest = halves.length === 2 ? parseGroups(halves[1] ?? '') : [];
  if (!head || !rest) return null;
  let groups: number[];
  if (halves.length === 2) {
    const fill = 8 - head.length - rest.length;
    if (fill < 1) return null;
    groups = [...head, ...new Array<number>(fill).fill(0), ...rest];
  } else {
    groups = head;
  }
  if (groups.length !== 8) return null;
  if (tail.length === 2) {
    groups[6] = tail[0]!;
    groups[7] = tail[1]!;
  }
  return groups;
}

function embeddedV4(hi: number, lo: number): [number, number, number, number] {
  return [hi >> 8, hi & 0xff, lo >> 8, lo & 0xff];
}

export function isNonPublicIPv6(g: number[]): boolean {
  const at = (i: number) => g[i] ?? 0;
  const allZeroUntil = (n: number) => g.slice(0, n).every((x) => x === 0);
  if (g.every((x) => x === 0)) return true;
  if (allZeroUntil(7) && at(7) === 1) return true;
  if (allZeroUntil(5) && at(5) === 0xffff) return isNonPublicIPv4(embeddedV4(at(6), at(7)));
  if (allZeroUntil(6)) return isNonPublicIPv4(embeddedV4(at(6), at(7)));
  if (at(0) === 0x64 && at(1) === 0xff9b && g.slice(2, 6).every((x) => x === 0)) return isNonPublicIPv4(embeddedV4(at(6), at(7)));
  if (at(0) === 0x2002) return isNonPublicIPv4(embeddedV4(at(1), at(2)));
  if ((at(0) & 0xfe00) === 0xfc00) return true;
  if ((at(0) & 0xffc0) === 0xfe80) return true;
  if ((at(0) & 0xffc0) === 0xfec0) return true;
  if ((at(0) & 0xff00) === 0xff00) return true;
  if (at(0) === 0x2001 && at(1) === 0x0db8) return true;
  if (at(0) === 0x0100 && g.slice(1, 4).every((x) => x === 0)) return true;
  return false;
}

/** Nicht-öffentliche IP-Adresse (Ergebnis einer DNS-Auflösung oder Literal). */
export function isNonPublicAddress(address: string): boolean {
  const v4 = parseIPv4(address);
  if (v4) return isNonPublicIPv4(v4);
  const v6 = parseIPv6(address);
  if (v6) return isNonPublicIPv6(v6);
  return true; // Unbekanntes Format: fail closed
}

export function isStaticallyNonPublicHost(rawHost: string): boolean {
  let host = rawHost.toLowerCase();
  if (host.endsWith('.')) host = host.slice(0, -1);
  if (host.length === 0) return true;
  const v4 = parseIPv4(host);
  if (v4) return isNonPublicIPv4(v4);
  const v6 = parseIPv6(host);
  if (v6) return isNonPublicIPv6(v6);
  if (host.startsWith('[')) return true;
  if (host === 'localhost') return true;
  if (BLOCKED_SUFFIXES.some((s) => host.endsWith(s))) return true;
  if (!host.includes('.')) return true;
  return false;
}

export function parseAllowlist(value: string | undefined | null): string[] {
  if (!value) return [];
  return value.split(',').map((s) => s.trim().toLowerCase().replace(/\.$/, '')).filter((s) => s.length > 0 && s.length <= 300).slice(0, 20);
}

/** Löst einen Hostnamen in IP-Adressen auf (A + AAAA). Leer/Fehler = gesperrt. */
export type Resolver = (host: string) => Promise<string[]>;

export interface HostGuard {
  /** true = Anfrage an host[:port] darf raus. */
  allows(host: string, port: string): Promise<boolean>;
  /**
   * Adresse, mit der verbunden werden DARF (DNS-gepinnt), oder null = gesperrt.
   * Freigegebene Hosts (Allowlist) kommen unverändert zurück; öffentliche
   * Literale ebenso; Namen als erste geprüfte Adresse — wer zu ihr verbindet,
   * kann zwischen Prüfung und Verbindung nicht umgebogen werden (Rebinding).
   */
  pin(host: string, port: string): Promise<string | null>;
}

function normalizeHost(rawHost: string): string {
  return rawHost.toLowerCase().replace(/\.$/, '').replace(/^\[(.*)\]$/, '$1');
}

export function createHostGuard(
  allowlist: readonly string[],
  resolver: Resolver,
  ttlMs = 60_000,
  now: () => number = () => Date.now(),
): HostGuard {
  const allow = new Set(allowlist);
  const cache = new Map<string, { addresses: string[] | null; until: number }>();

  async function pin(rawHost: string, port: string): Promise<string | null> {
    const host = normalizeHost(rawHost);
    if (host.length === 0 || host.length > 253) return null;
    if (allow.has(port ? `${host}:${port}` : host) || (!port && allow.has(host))) return host;
    if (isStaticallyNonPublicHost(host.includes(':') ? `[${host}]` : host)) return null;
    if (parseIPv4(host) || parseIPv6(host)) return host; // öffentliches Literal
    const at = now();
    const hit = cache.get(host);
    let addresses: string[] | null;
    if (hit && hit.until > at) {
      addresses = hit.addresses;
    } else {
      try {
        const resolved = await resolver(host);
        addresses = resolved.length > 0 && resolved.every((a) => !isNonPublicAddress(a)) ? resolved : null;
      } catch {
        addresses = null;
      }
      if (cache.size >= 2_000) cache.clear();
      cache.set(host, { addresses, until: at + ttlMs });
    }
    return addresses?.[0] ?? null;
  }

  return {
    pin,
    async allows(host, port) {
      return (await pin(host, port)) !== null;
    },
  };
}

/** Prüft eine Navigations-URL vollständig (Schema, Zugangsdaten, Host inkl. DNS). */
export async function assertNavigable(raw: string, guard: HostGuard): Promise<URL> {
  let url: URL;
  try { url = new URL(raw); } catch { throw new Error('INVALID_URL'); }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') throw new Error('INVALID_URL');
  if (url.username || url.password) throw new Error('URL_CREDENTIALS_NOT_ALLOWED');
  if (!(await guard.allows(url.hostname, url.port))) throw new Error('PRIVATE_NETWORK_BLOCKED');
  return url;
}

/**
 * Darf die Seite auf dieser URL stehen (nach einer Aktion, vor Frame/Text)?
 * Fängt Redirect-Hops und selbstständige Navigationen ab, die der Route-Guard
 * nicht sieht. about: (blank, srcdoc) und Chromiums Fehlerseite sind
 * unkritisch; blob: zählt mit seinem Ursprung; data: kann keine
 * Netzwerkadresse erreichen. Alles andere (file:, chrome:, view-source:, …)
 * ist gesperrt.
 */
export async function isLandingAllowed(raw: string, guard: HostGuard): Promise<boolean> {
  if (raw.startsWith('chrome-error://')) return true;
  let url: URL;
  try { url = new URL(raw); } catch { return false; }
  if (url.protocol === 'about:' || url.protocol === 'data:') return true;
  if (url.protocol === 'blob:') {
    try {
      const inner = new URL(url.pathname);
      return (inner.protocol === 'http:' || inner.protocol === 'https:') && await guard.allows(inner.hostname, inner.port);
    } catch {
      return false;
    }
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return false;
  return guard.allows(url.hostname, url.port);
}

export type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

/**
 * Resolver über DNS-over-HTTPS (JSON-API, A + AAAA) — für Laufzeiten ohne
 * System-DNS (Cloudflare Workers). Fehler, NXDOMAIN oder leere Antworten
 * liefern [] und damit „gesperrt“.
 */
export function createDohResolver(
  fetchImpl: FetchLike,
  endpoint = 'https://cloudflare-dns.com/dns-query',
  timeoutMs = 3_000,
): Resolver {
  async function query(host: string, type: 'A' | 'AAAA'): Promise<string[]> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetchImpl(`${endpoint}?name=${encodeURIComponent(host)}&type=${type}`, {
        headers: { accept: 'application/dns-json' },
        signal: controller.signal,
      });
      if (!res.ok) throw new Error('DOH_HTTP');
      const body = await res.json() as { Status?: number; Answer?: Array<{ type?: number; data?: unknown }> };
      if (body.Status !== 0) return [];
      const want = type === 'A' ? 1 : 28;
      return (body.Answer ?? [])
        .filter((a) => a.type === want && typeof a.data === 'string')
        .map((a) => a.data as string);
    } finally {
      clearTimeout(timer);
    }
  }
  return async (host) => {
    const [v4, v6] = await Promise.all([query(host, 'A'), query(host, 'AAAA')]);
    return [...v4, ...v6];
  };
}
