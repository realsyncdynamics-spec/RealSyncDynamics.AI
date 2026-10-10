// Abruf der zu prüfenden Seite.
//
// Erzeugt eine `SiteObservation` — die Eingabe der Analysatoren aus
// `packages/siteos-core`. Der Abruf selbst ist die einzige Stelle des
// öffentlichen Scans, die das Netz berührt.
//
// Sicherheitsrelevanz: Dieser Endpunkt ist **ohne Anmeldung** erreichbar.
// Zwei Schranken folgen daraus und sind nicht verhandelbar:
//
//   1. **Zeit** — ein Ziel, das die Verbindung offen hält, darf keinen
//      Worker binden (`AbortController`).
//   2. **Menge** — die Antwort wird streamend gelesen und beim Erreichen
//      der Obergrenze abgebrochen. `response.text()` würde die vollständige
//      Antwort in den Speicher ziehen; eine Datei von einem Gigabyte hinter
//      einer harmlos aussehenden Adresse wäre damit ein Denial-of-Service
//      gegen die eigene Funktion.
//
// Der HTML-Text wird ausgewertet, aber **nicht gespeichert**
// (Art. 5 Abs. 1 lit. c DSGVO — Datenminimierung). Persistiert werden nur
// die abgeleiteten Befunde und Signale.

import type { SiteObservation } from '../../../../packages/siteos-core/src/index.ts';
import { isPrivateAddressLiteral, validateScanTarget } from './target.ts';

export const FETCH_TIMEOUT_MS = 12_000;
export const MAX_HTML_BYTES = 1_500_000;

/**
 * Wie viele Weiterleitungen verfolgt werden. Jede einzelne wird erneut
 * geprüft — siehe `followWithGuard()`.
 */
export const MAX_REDIRECTS = 5;

export const SCANNER_USER_AGENT =
  'RealSyncDynamics-Scanner/1.0 (+https://realsyncdynamicsai.de/scan)';

/** Nur zum Testen austauschbar — in Produktion das globale `fetch`. */
export type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

/**
 * Löst einen Hostnamen in IP-Adressen auf (A und AAAA). Eine leere Liste
 * heißt: Der Host löst nicht auf. Nur zum Testen austauschbar — in
 * Produktion `Deno.resolveDns`, siehe `defaultResolver()`.
 */
export type ResolveLike = (host: string, signal: AbortSignal) => Promise<string[]>;

type DenoDns = {
  resolveDns: (query: string, type: 'A' | 'AAAA', options?: { signal?: AbortSignal }) => Promise<string[]>;
};

/**
 * Auflösung über `Deno.resolveDns`, dieselbe API wie in email-auth-rescan.
 *
 * `null` nur dort, wo es kein `Deno` gibt — also unter Vitest. Die
 * Edge-Laufzeit hat `Deno` immer, dort ist die Prüfung damit immer aktiv.
 * Tests, die sie prüfen, injizieren `resolveImpl`.
 */
function defaultResolver(): ResolveLike | null {
  const deno = (globalThis as unknown as { Deno?: Partial<DenoDns> }).Deno;
  if (typeof deno?.resolveDns !== 'function') return null;
  const resolveDns = deno.resolveDns.bind(deno) as DenoDns['resolveDns'];
  return async (host, signal) => {
    const [v4, v6] = await Promise.allSettled([
      resolveDns(host, 'A', { signal }),
      resolveDns(host, 'AAAA', { signal }),
    ]);
    return [
      ...(v4.status === 'fulfilled' ? v4.value : []),
      ...(v6.status === 'fulfilled' ? v6.value : []),
    ];
  };
}

/**
 * Ein Ziel — Eingabe oder Station einer Weiterleitung — liegt außerhalb der
 * SSRF-Schranke (`validateScanTarget`). Eigene Klasse, damit Aufrufer es von
 * einem gewöhnlichen Netzfehler unterscheiden und dem Besucher sagen können,
 * warum nicht geprüft wurde.
 */
export class TargetRefusedError extends Error {
  readonly code = 'TARGET_REFUSED';
  constructor(message: string) {
    super(message);
    this.name = 'TargetRefusedError';
  }
}

const DEFAULT_SCAN_HEADERS: Readonly<Record<string, string>> = {
  'user-agent': SCANNER_USER_AGENT,
  // Ohne diesen Header liefern manche Seiten eine reine
  // Weiterleitungsantwort statt des Dokuments.
  accept: 'text/html,application/xhtml+xml',
  'accept-language': 'de-DE,de;q=0.9,en;q=0.8',
};

export interface GuardedFetchOptions {
  timeoutMs: number;
  headers?: Readonly<Record<string, string>>;
  fetchImpl?: FetchLike;
  /** Nur für Tests. Ohne Angabe `Deno.resolveDns` (siehe `defaultResolver`). */
  resolveImpl?: ResolveLike;
}

/**
 * Abruf einer Besucher-Adresse für Scans außerhalb von `observeSite`
 * (gdpr-audit, cookie-scan): Eingangsprüfung, jede Weiterleitung erneut
 * geprüft (`followWithGuard`), harte Zeitgrenze bis zum Antwortkopf.
 * `response.url` ist die tatsächlich gelesene Adresse.
 *
 * Wirft `TargetRefusedError`, wenn Eingabe oder eine Station abgelehnt wird.
 */
export async function fetchGuarded(raw: string, options: GuardedFetchOptions): Promise<Response> {
  const check = validateScanTarget(raw);
  if (!check.ok) throw new TargetRefusedError(`target refused: ${check.reason}`);
  const fetchImpl = options.fetchImpl ?? ((input, init) => fetch(input, init));
  // Die Deadline muss bis zum Body-Read gelten, nicht nur bis zu den
  // Antwort-Headern. AbortSignal.timeout bleibt nach dem Return aktiv und
  // beendet deshalb auch ein haengendes response.text()/reader.read().
  const signal = AbortSignal.timeout(options.timeoutMs);
  const resolve = options.resolveImpl ?? defaultResolver();
  return await followWithGuard(check.url, fetchImpl, signal, options.headers, resolve);
}

export interface ObserveOptions {
  fetchImpl?: FetchLike;
  /** Nur für Tests. Ohne Angabe `Deno.resolveDns` (siehe `defaultResolver`). */
  resolveImpl?: ResolveLike;
  timeoutMs?: number;
  maxBytes?: number;
  /** Zeitquelle; austauschbar, damit Tests nicht auf die Uhr angewiesen sind. */
  now?: () => number;
}

export async function observeSite(url: URL, options: ObserveOptions = {}): Promise<SiteObservation> {
  const fetchImpl = options.fetchImpl ?? ((input, init) => fetch(input, init));
  const timeoutMs = options.timeoutMs ?? FETCH_TIMEOUT_MS;
  const maxBytes = options.maxBytes ?? MAX_HTML_BYTES;
  const now = options.now ?? (() => Date.now());

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  const startedAt = now();

  try {
    const resolve = options.resolveImpl ?? defaultResolver();
    const response = await followWithGuard(url, fetchImpl, controller.signal, DEFAULT_SCAN_HEADERS, resolve);
    const ttfbMs = now() - startedAt;

    const headers: Record<string, string> = {};
    response.headers.forEach((value, key) => {
      headers[key.toLowerCase()] = value;
    });

    const { text, byteLength } = await readCapped(response, maxBytes);

    // Die tatsächlich gelesene Adresse. Sie stammt aus der Sprungkette in
    // `followWithGuard()`, das sie über `withUrl()` setzt — die Laufzeit
    // füllt `response.url` bei `redirect: 'manual'` nicht mehr selbst.
    // Für die Analyse zählt genau diese Adresse: Sonst würde eine Seite,
    // die http auf https umleitet, als unverschlüsselt gemeldet.
    const finalUrl = response.url && response.url !== '' ? response.url : url.toString();
    const finalHost = safeHostname(finalUrl) ?? url.hostname;

    return {
      url: finalUrl,
      observedAt: new Date(now()).toISOString(),
      statusCode: response.status,
      headers,
      html: text,
      cookiesBeforeConsent: parseSetCookies(response.headers, finalHost),
      thirdPartyHosts: extractThirdPartyHosts(text, finalHost),
      ttfbMs,
      transferBytes: byteLength,
    };
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Verfolgt Weiterleitungen **selbst** und prüft jedes Ziel erneut.
 *
 * ## Warum nicht `redirect: 'follow'`
 *
 * Das wäre eine Umgehung der gesamten SSRF-Schranke. `validateScanTarget()`
 * prüft die Adresse, die der Besucher eingibt — nicht die, bei der der Abruf
 * endet. Mit automatischem Folgen genügt eine **öffentliche** Seite, die mit
 * `302 Location: http://169.254.169.254/…` antwortet, um den Scanner auf den
 * Cloud-Metadaten-Endpunkt zu lenken. Die Eingangsprüfung sähe eine
 * harmlose Domain und liesse sie durch.
 *
 * Deshalb: `redirect: 'manual'`, jede Zwischenstation durch dieselbe
 * Prüfung, und eine Obergrenze gegen Weiterleitungsschleifen.
 *
 * Vor jedem Abruf, also auch vor jeder Station, wird der Host zusätzlich
 * aufgelöst (`assertPublicResolution`). Erst das fängt Namen ab, die auf
 * eine private Adresse zeigen — statisch sieht `127.0.0.1.nip.io` öffentlich aus.
 */
async function followWithGuard(
  start: URL,
  fetchImpl: FetchLike,
  signal: AbortSignal,
  headers: Readonly<Record<string, string>> = DEFAULT_SCAN_HEADERS,
  resolve: ResolveLike | null = null,
): Promise<Response> {
  let current = start;

  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    await assertPublicResolution(current, resolve, signal);
    const response = await fetchImpl(current.toString(), {
      method: 'GET',
      redirect: 'manual',
      signal,
      headers: { ...headers },
    });

    const location = isRedirect(response.status) ? response.headers.get('location') : null;
    if (location === null || location.trim() === '') {
      // `Response.url` bleibt bei `redirect: 'manual'` leer. Damit die
      // Analyse die tatsächlich gelesene Adresse kennt (sonst würde eine
      // Seite, die http auf https umleitet, als unverschlüsselt gemeldet),
      // wird sie hier gesetzt.
      return withUrl(response, current.toString());
    }

    // Der Körper der Weiterleitungsantwort wird nie gelesen. Ohne
    // ausdrückliches Schliessen bliebe die Verbindung offen — bei fünf
    // Sprüngen je Scan summiert sich das.
    await response.body?.cancel().catch(() => undefined);

    let next: URL;
    try {
      next = new URL(location, current);
    } catch {
      throw new Error('redirect target is not parseable');
    }

    const check = validateScanTarget(next.toString());
    if (!check.ok) {
      // Bewusst ein Abbruch und kein stilles Ignorieren: Wer hierher
      // umleitet, versucht etwas, das nicht stattfinden soll.
      throw new TargetRefusedError(`redirect target refused: ${check.reason}`);
    }
    current = check.url;
  }

  throw new Error('too many redirects');
}

/**
 * DNS-Schranke: Der Host muss auflösen, und **jede** aufgelöste Adresse muss
 * öffentlich sein. Eine einzige private Adresse genügt zur Ablehnung, weil
 * nicht feststeht, welche davon `fetch` anschließend wählt.
 *
 * Adressliterale werden übersprungen — die hat `validateScanTarget` schon
 * statisch geprüft. Ohne Auflöser (nur unter Vitest) entfällt die Prüfung.
 *
 * Grenze: `fetch` löst danach selbst noch einmal auf. Ein Angreifer mit
 * eigenem Nameserver und TTL 0 kann zwischen beiden Anfragen die Antwort
 * wechseln (aktives DNS-Rebinding). Das schließt nur eine Verbindung, die an
 * die geprüfte Adresse gebunden ist; `fetch` bietet dafür keinen Einstieg.
 * Abgefangen wird damit jeder Name, der beständig auf ein internes Ziel zeigt.
 */
export async function assertPublicResolution(
  url: URL,
  resolve: ResolveLike | null,
  signal: AbortSignal,
): Promise<void> {
  if (!resolve) return;
  const host = url.hostname.toLowerCase();
  if (host.startsWith('[') || /^\d{1,3}(?:\.\d{1,3}){3}$/.test(host)) return;

  const addresses = await resolve(host, signal);
  if (addresses.length === 0) {
    // Kein Treffer ist kein Sicherheitsbefund, sondern ein Netzfehler —
    // genau wie ein `fetch` auf eine Domain, die es nicht gibt.
    throw new Error('target host does not resolve');
  }
  if (addresses.some(isPrivateResolvedAddress)) {
    throw new TargetRefusedError('target refused: host resolves to a private address');
  }
}

/**
 * Prüft eine aufgelöste Adresse, wie `Deno.resolveDns` sie liefert
 * (IPv6 ohne Klammern). Ergänzt `isPrivateAddressLiteral` um IPv6-Formen,
 * die eine IPv4-Adresse in den letzten 32 Bit tragen: IPv4-kompatibel
 * (`::/96`) und NAT64 (`64:ff9b::/96`). Ein AAAA-Eintrag `64:ff9b::a9fe:a9fe`
 * zeigt hinter einem NAT64-Gateway auf 169.254.169.254.
 */
export function isPrivateResolvedAddress(address: string): boolean {
  const a = address.trim().toLowerCase();
  if (!a.includes(':')) return isPrivateAddressLiteral(a);
  if (isPrivateAddressLiteral(`[${a}]`)) return true;
  const embedded = embeddedIpv4(a);
  return embedded !== null && isPrivateAddressLiteral(embedded);
}

/** IPv4 in den letzten 32 Bit von `::/96`, `::ffff:0:0/96` oder `64:ff9b::/96`, sonst `null`. */
function embeddedIpv4(v6: string): string | null {
  let s = v6;
  const dotted = /(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(s);
  if (dotted) {
    const [o1, o2, o3, o4] = dotted.slice(1).map(Number);
    s = `${s.slice(0, dotted.index)}${((o1 << 8) | o2).toString(16)}:${((o3 << 8) | o4).toString(16)}`;
  }

  const parts = s.split('::');
  if (parts.length > 2) return null;
  const head = parts[0] ? parts[0].split(':') : [];
  const tail = parts.length === 2 && parts[1] ? parts[1].split(':') : [];
  const fill = parts.length === 2 ? 8 - head.length - tail.length : 0;
  if (fill < 0) return null;
  const groups = [...head, ...Array<string>(fill).fill('0'), ...tail].map((g) => parseInt(g, 16));
  if (groups.length !== 8 || groups.some((g) => !Number.isInteger(g) || g < 0 || g > 0xffff)) return null;

  const zeros = (from: number, to: number) => groups.slice(from, to).every((g) => g === 0);
  const compatible = zeros(0, 6);
  const mapped = zeros(0, 5) && groups[5] === 0xffff;
  const nat64 = groups[0] === 0x64 && groups[1] === 0xff9b && zeros(2, 6);
  if (!compatible && !mapped && !nat64) return null;

  const [hi, lo] = [groups[6], groups[7]];
  return [hi >> 8, hi & 0xff, lo >> 8, lo & 0xff].join('.');
}

function isRedirect(status: number): boolean {
  return status === 301 || status === 302 || status === 303 || status === 307 || status === 308;
}

/** `Response.url` ist schreibgeschützt und bei `manual` leer. */
function withUrl(response: Response, url: string): Response {
  try {
    Object.defineProperty(response, 'url', { value: url, configurable: true });
  } catch {
    // Lässt eine Laufzeit das nicht zu, fällt `observeSite` auf die
    // Ausgangsadresse zurück — schlechter, aber nicht falsch.
  }
  return response;
}

/**
 * Liest den Antwortkörper bis zur Obergrenze und bricht dann ab. Der
 * Rückgabewert `byteLength` ist das **gelesene** Volumen — bei einem
 * Abbruch also die Obergrenze, nicht die wahre Größe der Ressource.
 */
async function readCapped(response: Response, maxBytes: number): Promise<{ text: string; byteLength: number }> {
  const body = response.body;
  if (!body) {
    // Ohne Body-Stream (z. B. in älteren Laufzeiten oder bei HEAD) bleibt
    // nur der vollständige Text. Die Obergrenze greift dann nachgelagert.
    const text = await response.text();
    const bytes = new TextEncoder().encode(text);
    return bytes.length > maxBytes
      ? { text: new TextDecoder().decode(bytes.slice(0, maxBytes)), byteLength: maxBytes }
      : { text, byteLength: bytes.length };
  }

  const reader = body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;

  try {
    while (total < maxBytes) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value) continue;

      const rest = maxBytes - total;
      if (value.byteLength > rest) {
        chunks.push(value.subarray(0, rest));
        total = maxBytes;
        break;
      }
      chunks.push(value);
      total += value.byteLength;
    }
  } finally {
    // Die Verbindung wird in jedem Fall geschlossen — auch wenn oben
    // abgebrochen wurde, sonst bliebe der Socket hängen.
    await reader.cancel().catch(() => undefined);
  }

  const merged = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.byteLength;
  }

  // `fatal: false` ist Absicht: Ein am Byte-Limit abgeschnittenes
  // Mehrbyte-Zeichen darf die Analyse nicht zum Absturz bringen.
  return { text: new TextDecoder('utf-8', { fatal: false }).decode(merged), byteLength: total };
}

/**
 * Cookies aus der Antwort auf den nackten Abruf. Da kein Consent-Dialog
 * bedient wurde, ist jedes hier gesetzte Cookie per Definition vor der
 * Einwilligung gesetzt (§ 25 Abs. 1 TDDDG).
 */
export function parseSetCookies(headers: Headers, host: string): { name: string; host: string }[] {
  const raw = readSetCookieHeaders(headers);
  const cookies: { name: string; host: string }[] = [];

  for (const line of raw) {
    const name = line.split('=')[0]?.trim();
    if (!name) continue;
    // Das Domain-Attribut nennt den setzenden Host, sofern angegeben.
    const domain = /;\s*domain\s*=\s*([^;]+)/i.exec(line)?.[1]?.trim().replace(/^\./, '');
    cookies.push({ name, host: domain && domain !== '' ? domain : host });
  }

  return cookies;
}

function readSetCookieHeaders(headers: Headers): string[] {
  // `getSetCookie` liefert die Header einzeln; ältere Laufzeiten fassen sie
  // zu einer Zeichenkette zusammen. Beide Formen werden bedient.
  const withGetter = headers as Headers & { getSetCookie?: () => string[] };
  if (typeof withGetter.getSetCookie === 'function') {
    return withGetter.getSetCookie();
  }
  const single = headers.get('set-cookie');
  return single ? [single] : [];
}

/**
 * Fremd-Hosts, die aus dem ausgelieferten HTML heraus kontaktiert werden.
 * Subdomains derselben registrierbaren Domain gelten nicht als fremd —
 * `cdn.firma.de` ist für `firma.de` kein Drittanbieter.
 */
export function extractThirdPartyHosts(html: string, ownHost: string): string[] {
  const own = registrableDomain(ownHost);
  const hosts = new Set<string>();

  for (const match of html.matchAll(/(?:src|href)\s*=\s*["'](https?:\/\/[^"']+)["']/gi)) {
    const host = safeHostname(match[1]);
    if (!host) continue;
    if (registrableDomain(host) === own) continue;
    hosts.add(host);
  }

  return [...hosts].sort();
}

/**
 * Näherung an die registrierbare Domain: die letzten beiden Labels, bei
 * bekannten zusammengesetzten Endungen (`co.uk`) die letzten drei.
 *
 * Bewusst **keine** vollständige Public-Suffix-Liste: Sie wäre eine
 * mehrere hundert Kilobyte große Tabelle, die für diese Unterscheidung
 * nichts gewinnt. Die Näherung kann bei exotischen Endungen einen eigenen
 * Host als fremd einstufen — das erzeugt einen Hinweis zu viel, keinen zu
 * wenig, und ist damit die verträglichere Richtung.
 */
export function registrableDomain(host: string): string {
  const labels = host.toLowerCase().replace(/\.$/, '').split('.');
  if (labels.length <= 2) return labels.join('.');

  const zweiteEbene = new Set(['co', 'com', 'org', 'net', 'gov', 'ac', 'edu']);
  const vorletztes = labels[labels.length - 2];
  const anzahl = zweiteEbene.has(vorletztes) && labels[labels.length - 1].length === 2 ? 3 : 2;
  return labels.slice(-anzahl).join('.');
}

function safeHostname(raw: string): string | null {
  try {
    return new URL(raw).hostname.toLowerCase();
  } catch {
    return null;
  }
}
