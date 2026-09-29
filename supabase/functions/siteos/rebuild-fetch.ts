// Rebuild — Abruf der Ausgangsseite (DISCOVER, Netzwerkteil).
//
// Was abgerufen wird, entscheidet der Kern (`rebuild/crawl.ts`: SSRF-Schranke,
// robots.txt, Unterseiten-Auswahl). Hier steht nur das Wie — mit den
// Schranken, die ein Abruf fremder Adressen im Namen eines Mandanten braucht:
//
//   • Jede Adresse und jeder Schritt einer Weiterleitung läuft durch
//     `isPublicHttpUrl`; zusätzlich wird der Name aufgelöst (A und AAAA,
//     mit Zeitgrenze) und jede Zieladresse gegen private Bereiche geprüft.
//     Abgerufen wird nur, was nachweislich öffentlich auflöst — „nicht
//     prüfbar" (Zeitüberschreitung, Resolverfehler, keine Adresse, keine
//     Namensauflösung in der Laufzeit) sperrt wie „privat" (fail-closed).
//   • Restlücke, benannt: `fetch` löst den Namen selbst noch einmal auf.
//     Ein Nameserver mit TTL 0 kann dazwischen umschalten (DNS-Rebinding).
//     Schließen lässt sich das nur mit einem Egress-Proxy, der Zieladressen
//     prüft — Betriebsaufgabe, nicht Code. Bis dahin begrenzen Rollen,
//     Kostenbremse, Protokoll jedes Versuchs und die Kurzfassung der
//     Antwort (Auszüge, kein HTML) die Wirkung.
//   • Weiterleitungen werden von Hand verfolgt (höchstens 4), nie vom Client.
//   • Größen- und Zeitgrenzen je Abruf und für den ganzen Lauf.
//   • Keine Cookies, keine Zugangsdaten, eine ausgewiesene Kennung.
//
// Keine Imports aus `jsr:` — die Datei ist in Deno und (für Tests) in Vitest
// ladbar; `Deno` wird nur über `globalThis` angesprochen.

import {
  REBUILD_USER_AGENT,
  canonicalPageKey,
  discoverPageResources,
  isBlockedAddress,
  isPublicHttpUrl,
  parseRobots,
  parseSitemap,
  planCrawl,
  robotsAllows,
  type CrawlCandidate,
  type ExtractInput,
  type RobotsRules,
  type SnapshotInput,
} from '../../../packages/siteos-core/src/index.ts';

export const FETCH_LIMITS = Object.freeze({
  /** Startseite + Unterseiten. */
  maxPages: 6,
  maxStylesheets: 3,
  maxHtmlBytes: 1_500_000,
  maxCssBytes: 600_000,
  maxTextBytes: 300_000,
  perRequestMs: 8_000,
  /** Gesamtbudget des Laufs — danach wird nichts Neues mehr begonnen. */
  totalMs: 28_000,
  maxRedirects: 4,
  /** Zeitgrenze je Namensauflösung (A bzw. AAAA). */
  dnsMs: 2_500,
});

export interface FetchedResource {
  url: string;
  status: number;
  contentType: string;
  bytes: Uint8Array;
  truncated: boolean;
}

export type FetchOutcome = { ok: true; resource: FetchedResource } | { ok: false; reason: string };

interface DnsApi {
  resolveDns?: (name: string, type: 'A' | 'AAAA', options?: { signal?: AbortSignal }) => Promise<string[]>;
}

/**
 * `public`     jede aufgelöste Adresse ist öffentlich
 * `private`    mindestens eine Adresse liegt in einem privaten/reservierten Bereich
 * `unresolved` weder A- noch AAAA-Eintrag
 * `unchecked`  nicht prüfbar (keine Namensauflösung, Zeitüberschreitung, Resolverfehler)
 *
 * Nur `public` wird abgerufen.
 */
export type DnsVerdict = 'public' | 'private' | 'unresolved' | 'unchecked';

const DNS_REFUSAL: Readonly<Record<Exclude<DnsVerdict, 'public'>, string>> = {
  private: 'der Name zeigt auf eine private Adresse',
  unresolved: 'der Name lässt sich nicht auflösen',
  unchecked: 'die Zieladresse ließ sich nicht prüfen',
};

/** „Kein Eintrag dieses Typs" — normal (viele Namen haben kein AAAA). */
function isNoRecord(error: unknown): boolean {
  const name = (error as { name?: string })?.name ?? '';
  const message = (error as { message?: string })?.message ?? '';
  return name === 'NotFound' || /no record|nxdomain|not found/i.test(message);
}

/**
 * Löst einen Namen auf (A und AAAA, je mit Zeitgrenze) und prüft jede
 * Adresse. Literale IP-Adressen werden direkt geprüft.
 */
export async function resolvesToPublic(hostname: string, timeoutMs: number = FETCH_LIMITS.dnsMs): Promise<DnsVerdict> {
  const host = hostname.replace(/^\[|\]$/g, '').replace(/\.$/, '');
  if (/^[\d.]+$/.test(host) || host.includes(':')) return isBlockedAddress(host.toLowerCase()) ? 'private' : 'public';
  const deno = (globalThis as { Deno?: DnsApi }).Deno;
  if (!deno?.resolveDns) return 'unchecked';
  const addresses: string[] = [];
  for (const type of ['A', 'AAAA'] as const) {
    try {
      addresses.push(...(await deno.resolveDns(host, type, { signal: AbortSignal.timeout(Math.max(1, timeoutMs)) })));
    } catch (error) {
      // Kein Eintrag dieses Typs ist normal; alles andere — Zeitüberschreitung,
      // SERVFAIL, fehlende Berechtigung — heißt: nicht prüfbar.
      if (!isNoRecord(error)) return 'unchecked';
    }
  }
  if (addresses.length === 0) return 'unresolved';
  return addresses.some((a) => isBlockedAddress(a.toLowerCase())) ? 'private' : 'public';
}

/**
 * Ruft eine Adresse ab: manuelle Weiterleitungen, Schranke je Schritt,
 * Größenbegrenzung beim Lesen.
 */
export async function safeFetch(start: URL, accept: string, maxBytes: number, deadline: number): Promise<FetchOutcome> {
  let current = new URL(start.toString());
  for (let hop = 0; hop <= FETCH_LIMITS.maxRedirects; hop += 1) {
    const check = isPublicHttpUrl(current);
    if (!check.ok) return { ok: false, reason: check.reason };
    const budget = deadline - Date.now();
    if (budget < 500) return { ok: false, reason: 'Zeitbudget des Laufs erschöpft' };
    // Fail-closed: abgerufen wird nur, was nachweislich öffentlich auflöst.
    const dns = await resolvesToPublic(current.hostname, Math.min(FETCH_LIMITS.dnsMs, budget));
    if (dns !== 'public') return { ok: false, reason: DNS_REFUSAL[dns] };

    const remaining = deadline - Date.now();
    if (remaining < 500) return { ok: false, reason: 'Zeitbudget des Laufs erschöpft' };
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), Math.min(FETCH_LIMITS.perRequestMs, remaining));
    let response: Response;
    try {
      response = await fetch(current, {
        method: 'GET',
        redirect: 'manual',
        credentials: 'omit',
        headers: { accept, 'user-agent': REBUILD_USER_AGENT, 'accept-language': 'de-DE,de;q=0.9,en;q=0.5' },
        signal: controller.signal,
      });
    } catch (error) {
      clearTimeout(timer);
      return { ok: false, reason: (error as Error)?.name === 'AbortError' ? 'Zeitüberschreitung' : 'nicht erreichbar' };
    }

    if (response.status >= 300 && response.status < 400) {
      clearTimeout(timer);
      await response.body?.cancel().catch(() => undefined);
      const location = response.headers.get('location');
      if (!location) return { ok: false, reason: 'Weiterleitung ohne Ziel' };
      if (hop === FETCH_LIMITS.maxRedirects) return { ok: false, reason: 'zu viele Weiterleitungen' };
      try {
        current = new URL(location, current);
      } catch {
        return { ok: false, reason: 'ungültiges Weiterleitungsziel' };
      }
      continue;
    }

    try {
      const { bytes, truncated } = await readCapped(response, maxBytes);
      return {
        ok: true,
        resource: {
          url: current.toString(),
          status: response.status,
          contentType: response.headers.get('content-type') ?? '',
          bytes,
          truncated,
        },
      };
    } catch {
      return { ok: false, reason: 'Abbruch beim Lesen' };
    } finally {
      clearTimeout(timer);
    }
  }
  return { ok: false, reason: 'zu viele Weiterleitungen' };
}

async function readCapped(response: Response, maxBytes: number): Promise<{ bytes: Uint8Array; truncated: boolean }> {
  const reader = response.body?.getReader();
  if (!reader) return { bytes: new Uint8Array(0), truncated: false };
  const chunks: Uint8Array[] = [];
  let total = 0;
  let truncated = false;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    if (total + value.length > maxBytes) {
      chunks.push(value.slice(0, maxBytes - total));
      total = maxBytes;
      truncated = true;
      await reader.cancel().catch(() => undefined);
      break;
    }
    chunks.push(value);
    total += value.length;
  }
  const out = new Uint8Array(total);
  let at = 0;
  for (const chunk of chunks) {
    out.set(chunk, at);
    at += chunk.length;
  }
  return { bytes: out, truncated };
}

/** Text aus Bytes — Zeichensatz aus Content-Type oder `<meta charset>`, sonst UTF-8. */
export function decodeText(bytes: Uint8Array, contentType: string): string {
  const declared = /charset=["']?([\w-]+)/i.exec(contentType)?.[1]
    ?? /<meta[^>]{0,200}charset=["']?([\w-]+)/i.exec(new TextDecoder('latin1').decode(bytes.slice(0, 2048)))?.[1]
    ?? 'utf-8';
  try {
    return new TextDecoder(declared.toLowerCase(), { fatal: false }).decode(bytes);
  } catch {
    return new TextDecoder('utf-8', { fatal: false }).decode(bytes);
  }
}

export function isHtml(contentType: string): boolean {
  return /text\/html|application\/xhtml\+xml/i.test(contentType);
}

export async function sha256OfBytes(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

// ─────────────────────────────────────────────────────────────────────
// Lauf: robots.txt → Startseite → Sitemap → Unterseiten + Stylesheets
// ─────────────────────────────────────────────────────────────────────

export type CrawlResult = { input: SnapshotInput } | { status: number; code: string; error: string };

const HTML_ACCEPT = 'text/html,application/xhtml+xml;q=0.9,*/*;q=0.1';

/**
 * Liest die Ausgangsseite ein. Die Startseite wird nur gelesen, wenn
 * robots.txt es erlaubt (der Abruf erfolgt in unserem Namen, siehe
 * `parseRobots`); Unterseiten wählt `planCrawl` unter denselben Regeln.
 * Was nicht gelesen wurde, steht mit Grund in `crawl.skipped` — der
 * Backend-Vergleich im Publish Gate macht daraus eine Freigabepflicht.
 */
export async function crawlSite(start: URL, nowIso: string): Promise<CrawlResult> {
  const deadline = Date.now() + FETCH_LIMITS.totalMs;
  const skipped: { url: string; reason: string }[] = [];

  let robotsUrl = `${start.protocol}//${start.host}/robots.txt`;
  let rules = await readRobots(robotsUrl, deadline);
  if (!robotsAllows(start.pathname || '/', rules)) {
    return { status: 422, code: 'ROBOTS_DISALLOWED', error: 'Die robots.txt der Website schließt den Abruf aus. RealSync liest die Seite deshalb nicht.' };
  }

  // ── Startseite ──────────────────────────────────────────────────────
  const home = await safeFetch(start, HTML_ACCEPT, FETCH_LIMITS.maxHtmlBytes, deadline);
  if (!home.ok) return { status: 422, code: 'UNREACHABLE', error: `Die Startseite war nicht abrufbar (${home.reason}).` };
  if (home.resource.status >= 400) return { status: 422, code: 'UNREACHABLE', error: `Die Startseite antwortet mit HTTP ${home.resource.status}.` };
  if (!isHtml(home.resource.contentType)) return { status: 422, code: 'NOT_HTML', error: 'Die Adresse liefert kein HTML-Dokument.' };

  const resolved = new URL(home.resource.url);
  if (resolved.host !== start.host) {
    // Weiterleitung auf einen anderen Host (z. B. www): dessen Regeln gelten.
    robotsUrl = `${resolved.protocol}//${resolved.host}/robots.txt`;
    rules = await readRobots(robotsUrl, deadline);
    if (!robotsAllows(resolved.pathname || '/', rules)) {
      return { status: 422, code: 'ROBOTS_DISALLOWED', error: 'Die robots.txt der Website schließt den Abruf aus. RealSync liest die Seite deshalb nicht.' };
    }
  }
  const homeHtml = decodeText(home.resource.bytes, home.resource.contentType);
  const resources = discoverPageResources(homeHtml, resolved.toString());

  // ── Sitemap ─────────────────────────────────────────────────────────
  const sitemap: SnapshotInput['sitemap'] = { found: false, url: null, urlCount: 0 };
  const sitemapUrls: string[] = [];
  const sitemapCandidates = (rules.sitemaps.length > 0 ? rules.sitemaps : [`${resolved.protocol}//${resolved.host}/sitemap.xml`]).slice(0, 2);
  for (const candidate of sitemapCandidates) {
    const url = sameSiteUrl(candidate, resolved);
    if (!url) continue;
    const listed = await readSitemap(url, resolved, deadline);
    if (listed) {
      sitemap.found = true;
      sitemap.url = url.toString();
      sitemap.urlCount = listed.length;
      sitemapUrls.push(...listed);
      break;
    }
  }

  // ── Unterseiten ─────────────────────────────────────────────────────
  const candidates: CrawlCandidate[] = [...resources.candidates, ...sitemapUrls.slice(0, 500).map((url) => ({ url }))];
  const planned = planCrawl(resolved, candidates, FETCH_LIMITS.maxPages - 1, rules);
  const excluded = new Set<string>();
  for (const candidate of candidates) {
    try {
      const url = new URL(candidate.url);
      if (url.hostname.replace(/^www\./, '') !== resolved.hostname.replace(/^www\./, '')) continue;
      if (!robotsAllows(url.pathname, rules)) excluded.add(canonicalPageKey(url));
    } catch {
      // ungültige Adresse — zählt nicht
    }
  }
  for (const url of [...excluded].slice(0, 25)) skipped.push({ url, reason: 'robots.txt' });

  const homeKey = canonicalPageKey(resolved);
  const subpages = await Promise.all(planned.map(async (url) => {
    const result = await safeFetch(new URL(url), HTML_ACCEPT, FETCH_LIMITS.maxHtmlBytes, deadline);
    if (!result.ok) return { url, error: result.reason };
    if (result.resource.status >= 400) return { url, error: `HTTP ${result.resource.status}` };
    if (!isHtml(result.resource.contentType)) return { url, error: 'kein HTML-Dokument' };
    const final = new URL(result.resource.url);
    if (final.hostname.replace(/^www\./, '') !== resolved.hostname.replace(/^www\./, '')) return { url, error: 'Weiterleitung auf eine andere Website' };
    if (canonicalPageKey(final) === homeKey) return { url, error: 'Weiterleitung auf die Startseite' };
    return { url, resource: result.resource };
  }));

  // ── Stylesheets der Startseite ──────────────────────────────────────
  const stylesheets: { url: string; css: string }[] = [];
  for (const href of resources.stylesheets.slice(0, FETCH_LIMITS.maxStylesheets)) {
    const result = await safeFetch(new URL(href), 'text/css,*/*;q=0.1', FETCH_LIMITS.maxCssBytes, deadline);
    if (result.ok && result.resource.status < 400) stylesheets.push({ url: result.resource.url, css: decodeText(result.resource.bytes, result.resource.contentType) });
    else skipped.push({ url: href, reason: result.ok ? `Stylesheet: HTTP ${result.resource.status}` : `Stylesheet: ${result.reason}` });
  }

  const pages: ExtractInput[] = [{
    url: resolved.toString(),
    html: homeHtml,
    statusCode: home.resource.status,
    fetchedAt: nowIso,
    documentSha256: await sha256OfBytes(home.resource.bytes),
    bytes: home.resource.bytes.length,
    truncated: home.resource.truncated,
    stylesheets,
  }];
  const fetched = [resolved.toString()];
  const seen = new Set([homeKey]);
  for (const entry of subpages) {
    if (!('resource' in entry) || !entry.resource) {
      skipped.push({ url: entry.url, reason: (entry as { error: string }).error });
      continue;
    }
    const key = canonicalPageKey(new URL(entry.resource.url));
    if (seen.has(key)) continue;
    seen.add(key);
    pages.push({
      url: entry.resource.url,
      html: decodeText(entry.resource.bytes, entry.resource.contentType),
      statusCode: entry.resource.status,
      fetchedAt: nowIso,
      documentSha256: await sha256OfBytes(entry.resource.bytes),
      bytes: entry.resource.bytes.length,
      truncated: entry.resource.truncated,
    });
    fetched.push(entry.resource.url);
  }

  return {
    input: {
      sourceUrl: start.toString(),
      resolvedUrl: resolved.toString(),
      fetchedAt: nowIso,
      pages,
      robots: { found: rules.found, sitemaps: rules.sitemaps, disallowAll: !robotsAllows('/', rules), url: robotsUrl },
      sitemap,
      crawl: { planned, fetched, skipped },
    },
  };
}

async function readRobots(url: string, deadline: number): Promise<RobotsRules> {
  const result = await safeFetch(new URL(url), 'text/plain,*/*;q=0.1', FETCH_LIMITS.maxTextBytes, deadline);
  // Kein robots.txt (404) oder HTML-Fehlerseite: keine Einschränkung.
  if (!result.ok || result.resource.status !== 200 || isHtml(result.resource.contentType)) {
    return { found: false, allow: [], disallow: [], sitemaps: [] };
  }
  return parseRobots(decodeText(result.resource.bytes, result.resource.contentType));
}

async function readSitemap(url: URL, site: URL, deadline: number): Promise<string[] | null> {
  const result = await safeFetch(url, 'application/xml,text/xml;q=0.9,*/*;q=0.1', 2_000_000, deadline);
  if (!result.ok || result.resource.status !== 200 || isHtml(result.resource.contentType)) return null;
  const parsed = parseSitemap(decodeText(result.resource.bytes, result.resource.contentType));
  if (parsed.urls.length > 0) return parsed.urls;
  // Sitemap-Index: die erste Teil-Sitemap derselben Website genügt für die Auswahl.
  for (const nested of parsed.sitemaps.slice(0, 1)) {
    const nestedUrl = sameSiteUrl(nested, site);
    if (!nestedUrl) continue;
    const inner = await safeFetch(nestedUrl, 'application/xml,text/xml;q=0.9,*/*;q=0.1', 2_000_000, deadline);
    if (inner.ok && inner.resource.status === 200) {
      const urls = parseSitemap(decodeText(inner.resource.bytes, inner.resource.contentType)).urls;
      return urls.length > 0 ? urls : null;
    }
  }
  return null;
}

function sameSiteUrl(value: string, site: URL): URL | null {
  try {
    const url = new URL(value, site);
    if (url.hostname.replace(/^www\./, '') !== site.hostname.replace(/^www\./, '')) return null;
    return url;
  } catch {
    return null;
  }
}
