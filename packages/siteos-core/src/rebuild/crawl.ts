// DISCOVER — was abgerufen werden darf und was sich lohnt.
//
// Reine Funktionen: Adressprüfung (SSRF-Schranke), robots.txt, Sitemap und
// die Auswahl der Unterseiten. Das Abrufen selbst geschieht im Edge-Handler;
// hier steht nur, WAS abgerufen wird. Damit ist die Auswahl testbar, und die
// SSRF-Schranke ist dieselbe Funktion für jeden Schritt einer Weiterleitung.

/** Kennung, mit der sich der Abruf bei der fremden Website ausweist. */
export const REBUILD_USER_AGENT = 'RealSyncDynamicsAI-SiteOS-Rebuild/1.0 (+https://realsyncdynamicsai.de)';
const OWN_AGENT_TOKEN = 'realsyncdynamicsai';

// ─────────────────────────────────────────────────────────────────────
// Eingabe-Adresse
// ─────────────────────────────────────────────────────────────────────

/**
 * Macht aus einer Nutzereingabe („mueller-haustechnik.de") eine Adresse.
 * Nachsichtig beim Schema, streng beim Host: Ohne Punkt ist es kein
 * öffentlicher Name.
 */
export function normalizeInputUrl(raw: string): URL | null {
  const trimmed = raw.trim();
  if (trimmed === '' || trimmed.length > 2048) return null;
  const candidate = /^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  let url: URL;
  try {
    url = new URL(candidate);
  } catch {
    return null;
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
  url.hash = '';
  return url;
}

export type AddressCheck = { ok: true } | { ok: false; reason: string };

/**
 * SSRF-Schranke für jeden Abruf und jeden Schritt einer Weiterleitung.
 *
 * Erlaubt sind nur http/https auf Standard-Ports zu öffentlichen Namen.
 * Private und besondere Adressbereiche werden als Literal abgewiesen —
 * auch in Schreibweisen, die der URL-Parser erst normalisiert
 * (`http://2130706433/` wird zu `127.0.0.1` und damit geprüft).
 *
 * Bekannte Grenze (wie bei `siteos/runtime-scan`): DNS-Rebinding schließt
 * diese Prüfung allein nicht aus. Der Edge-Handler löst den Namen deshalb
 * zusätzlich auf, wo die Laufzeit das erlaubt.
 */
export function isPublicHttpUrl(url: URL): AddressCheck {
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return { ok: false, reason: 'nur http und https sind erlaubt' };
  if (url.username !== '' || url.password !== '') return { ok: false, reason: 'Zugangsdaten in der Adresse sind nicht erlaubt' };
  if (url.port !== '' && url.port !== '80' && url.port !== '443') return { ok: false, reason: 'nur Standard-Ports (80/443) sind erlaubt' };
  const host = url.hostname.toLowerCase().replace(/^\[|\]$/g, '').replace(/\.$/, '');
  if (host === '') return { ok: false, reason: 'kein Hostname' };
  if (isBlockedAddress(host)) return { ok: false, reason: 'private oder lokale Adresse' };
  if (!host.includes('.') && !host.includes(':')) return { ok: false, reason: 'kein öffentlicher Hostname' };
  if (/\.(localhost|local|internal|intranet|lan|home|corp|home\.arpa|test|invalid|example\.internal)$/.test(host) || host === 'localhost') {
    return { ok: false, reason: 'interner Hostname' };
  }
  return { ok: true };
}

/** Private, lokale und reservierte Adressbereiche (IPv4 und IPv6 als Literal). */
export function isBlockedAddress(hostOrIp: string): boolean {
  const host = hostOrIp.toLowerCase();
  if (host === 'localhost' || host.endsWith('.localhost')) return true;

  if (host.includes(':')) {
    // IPv6
    if (host === '::' || host === '::1') return true;
    if (/^f[cd][0-9a-f]{0,2}:/.test(host)) return true; // ULA fc00::/7
    if (/^fe[89ab][0-9a-f]?:/.test(host)) return true; // link-local fe80::/10
    if (host.startsWith('ff')) return true; // multicast
    const mapped = /^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/.exec(host);
    if (mapped) return isBlockedAddress(mapped[1]);
    if (/^::ffff:[0-9a-f]{1,4}:[0-9a-f]{1,4}$/.test(host)) return true; // mapped in hex form
    // Übriges ::/8 (IPv4-kompatibel, reserviert): keine öffentlichen Ziele.
    if (host.startsWith('::')) return true;
    // 6to4 (2002::/16) trägt eine IPv4-Adresse in sich — sie entscheidet.
    const sixToFour = /^2002:([0-9a-f]{1,4}):([0-9a-f]{1,4})(?::|$)/.exec(host);
    if (sixToFour) {
      const hi = parseInt(sixToFour[1], 16);
      const lo = parseInt(sixToFour[2], 16);
      return isBlockedAddress(`${hi >> 8}.${hi & 255}.${lo >> 8}.${lo & 255}`);
    }
    if (/^2001:0{0,4}:/.test(host)) return true; // Teredo 2001::/32
    if (host.startsWith('64:ff9b:')) return true; // NAT64
    if (host.startsWith('2001:db8:')) return true; // Dokumentation
    if (host.startsWith('100::')) return true; // Discard 100::/64
    return false;
  }

  const parts = host.split('.');
  if (parts.length !== 4 || !parts.every((p) => /^\d{1,3}$/.test(p))) return false;
  const [a, b] = parts.map(Number);
  if (parts.map(Number).some((n) => n > 255)) return true;
  return (
    a === 0
    || a === 10
    || a === 127
    || (a === 169 && b === 254)
    || (a === 172 && b >= 16 && b <= 31)
    || (a === 192 && b === 168)
    || (a === 100 && b >= 64 && b <= 127)
    || (a === 192 && b === 0)
    || (a === 198 && (b === 18 || b === 19))
    || a >= 224
  );
}

// ─────────────────────────────────────────────────────────────────────
// robots.txt
// ─────────────────────────────────────────────────────────────────────

export interface RobotsRules {
  found: boolean;
  allow: string[];
  disallow: string[];
  sitemaps: string[];
}

/**
 * Liest die Regeln für `*` und — vorrangig — für die eigene Kennung.
 * Eine Website, die uns ausdrücklich ausschließt, wird nicht gelesen, auch
 * wenn ihr Betreiber sie selbst zur Analyse eingereicht hat: Der Abruf
 * erfolgt in unserem Namen.
 */
export function parseRobots(text: string): RobotsRules {
  const groups: { agents: string[]; allow: string[]; disallow: string[] }[] = [];
  const sitemaps: string[] = [];
  let current: { agents: string[]; allow: string[]; disallow: string[] } | null = null;
  let lastWasAgent = false;

  for (const rawLine of text.slice(0, 200_000).split(/\r?\n/)) {
    const line = rawLine.split('#')[0].trim();
    if (line === '') continue;
    const colon = line.indexOf(':');
    if (colon === -1) continue;
    const field = line.slice(0, colon).trim().toLowerCase();
    const value = line.slice(colon + 1).trim();
    if (field === 'sitemap') {
      if (value !== '' && sitemaps.length < 10) sitemaps.push(value);
      continue;
    }
    if (field === 'user-agent') {
      if (!current || !lastWasAgent) {
        current = { agents: [], allow: [], disallow: [] };
        groups.push(current);
      }
      current.agents.push(value.toLowerCase());
      lastWasAgent = true;
      continue;
    }
    lastWasAgent = false;
    if (!current) continue;
    if (field === 'allow' && value !== '') current.allow.push(value);
    if (field === 'disallow' && value !== '') current.disallow.push(value);
  }

  const own = groups.find((g) => g.agents.some((a) => a !== '*' && OWN_AGENT_TOKEN.includes(a.replace(/[^a-z0-9]/g, '')) && a.length > 3));
  const star = groups.find((g) => g.agents.includes('*'));
  const chosen = own ?? star;
  return { found: true, allow: chosen?.allow ?? [], disallow: chosen?.disallow ?? [], sitemaps };
}

/** Längste passende Regel gewinnt; bei Gleichstand `Allow` (RFC 9309). */
export function robotsAllows(path: string, rules: RobotsRules): boolean {
  if (!rules.found) return true;
  let best: { length: number; allow: boolean } | null = null;
  const consider = (pattern: string, allow: boolean) => {
    if (!robotsPatternMatches(pattern, path)) return;
    const length = pattern.length;
    if (!best || length > best.length || (length === best.length && allow)) best = { length, allow };
  };
  for (const p of rules.disallow) consider(p, false);
  for (const p of rules.allow) consider(p, true);
  return best === null ? true : (best as { allow: boolean }).allow;
}

function robotsPatternMatches(pattern: string, path: string): boolean {
  // Unterstützt `*` und ein abschließendes `$` — ohne Regex aus fremden Mustern zu bauen.
  const anchored = pattern.endsWith('$');
  const body = anchored ? pattern.slice(0, -1) : pattern;
  const pieces = body.split('*');
  if (!path.startsWith(pieces[0])) return false;
  if (pieces.length === 1) return anchored ? path === pieces[0] : true;
  let at = pieces[0].length;
  // Mittlere Teile so früh wie möglich, der letzte bei `$` am Ende.
  for (let k = 1; k < pieces.length - 1; k += 1) {
    const found = path.indexOf(pieces[k], at);
    if (found === -1) return false;
    at = found + pieces[k].length;
  }
  const last = pieces[pieces.length - 1];
  if (anchored) return path.length - last.length >= at && path.endsWith(last);
  return path.indexOf(last, at) !== -1;
}

// ─────────────────────────────────────────────────────────────────────
// Sitemap
// ─────────────────────────────────────────────────────────────────────

/** Liest `<loc>`-Einträge; unterscheidet Sitemap-Index und URL-Liste. */
export function parseSitemap(xml: string): { urls: string[]; sitemaps: string[] } {
  const urls: string[] = [];
  const sitemaps: string[] = [];
  const lower = xml.slice(0, 2_000_000);
  const isIndex = /<sitemapindex[\s>]/i.test(lower.slice(0, 2000));
  let at = 0;
  while (urls.length + sitemaps.length < 2000) {
    const open = lower.indexOf('<loc>', at);
    if (open === -1) break;
    const close = lower.indexOf('</loc>', open + 5);
    if (close === -1) break;
    const value = lower.slice(open + 5, close).trim().replace(/^<!\[CDATA\[|\]\]>$/g, '').replace(/&amp;/g, '&');
    if (value !== '') (isIndex ? sitemaps : urls).push(value);
    at = close + 6;
  }
  return { urls, sitemaps };
}

// ─────────────────────────────────────────────────────────────────────
// Auswahl der Unterseiten
// ─────────────────────────────────────────────────────────────────────

/**
 * Welche Seiten tragen zum Rebuild bei? Kontakt, Leistungen, Über uns,
 * Preise, Referenzen, Termin und Impressum (Kontaktdaten!) — Blog-Artikel,
 * Archiv- und Filterseiten nicht.
 */
const PATH_WEIGHTS: ReadonlyArray<{ pattern: RegExp; weight: number }> = [
  { pattern: /(kontakt|contact|anfahrt|anfrage)/, weight: 10 },
  { pattern: /(leistung|service|angebot|produkt|product|loesung|lösung|beratungsfeld|rechtsgebiet|schwerpunkt|kompetenz)/, weight: 9 },
  { pattern: /(ueber-uns|uber-uns|über-uns|about|unternehmen|wir|team|kanzlei|praxis|firma)/, weight: 8 },
  { pattern: /(preis|pricing|kosten|tarif|pakete)/, weight: 8 },
  { pattern: /(termin|booking|buchen|reservierung)/, weight: 8 },
  { pattern: /(referenz|projekt|kunden|case|erfolg)/, weight: 7 },
  { pattern: /(impressum|imprint)/, weight: 6 },
  { pattern: /(faq|fragen)/, weight: 5 },
  { pattern: /(shop|warenkorb|checkout|kasse)/, weight: 5 },
];

const PATH_PENALTIES: ReadonlyArray<{ pattern: RegExp; weight: number }> = [
  { pattern: /(blog|news|aktuell|artikel|beitrag|magazin|presse|\/\d{4}\/\d{2}\/)/, weight: -8 },
  { pattern: /(tag|category|kategorie|author|autor|page\/\d|seite\/\d|feed|wp-json|wp-admin|login|cart|account|konto)/, weight: -12 },
  { pattern: /(datenschutz|privacy|agb|cookie|widerruf|barrierefreiheit)/, weight: -6 },
];

export interface CrawlCandidate {
  url: string;
  /** Linktext, falls bekannt (Navigation). */
  label?: string;
  /** Aus der Hauptnavigation? */
  inNavigation?: boolean;
}

/**
 * Wählt bis zu `max` Unterseiten derselben Website. Deterministisch: gleiche
 * Kandidaten ⇒ gleiche Auswahl in gleicher Reihenfolge.
 */
export function planCrawl(start: URL, candidates: CrawlCandidate[], max: number, robots?: RobotsRules): string[] {
  const home = canonicalPageKey(start);
  const scored = new Map<string, number>();
  for (const candidate of candidates) {
    let url: URL;
    try {
      url = new URL(candidate.url);
    } catch {
      continue;
    }
    if (url.hostname.replace(/^www\./, '') !== start.hostname.replace(/^www\./, '')) continue;
    if (!isPublicHttpUrl(url).ok) continue;
    if (/\.(pdf|jpe?g|png|gif|svg|webp|zip|docx?|xlsx?|mp4|xml|txt)$/i.test(url.pathname)) continue;
    const key = canonicalPageKey(url);
    if (key === home) continue;
    if (robots && !robotsAllows(url.pathname, robots)) continue;

    const haystack = `${decodeSafe(url.pathname).toLowerCase()} ${(candidate.label ?? '').toLowerCase()}`;
    let score = 0;
    for (const { pattern, weight } of PATH_WEIGHTS) if (pattern.test(haystack)) score = Math.max(score, weight);
    for (const { pattern, weight } of PATH_PENALTIES) if (pattern.test(haystack)) score += weight;
    if (candidate.inNavigation) score += 3;
    const depth = url.pathname.split('/').filter((s) => s !== '').length;
    score -= Math.max(0, depth - 1) * 2;
    if (url.search !== '') score -= 4;
    if (score <= 0) continue;
    scored.set(key, Math.max(scored.get(key) ?? 0, score));
  }
  return [...scored.entries()]
    .sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1))
    .slice(0, Math.max(0, max))
    .map(([key]) => key);
}

/** Seitenadresse ohne Fragment und ohne abschließenden Schrägstrich-Unterschied. */
export function canonicalPageKey(url: URL): string {
  const copy = new URL(url.toString());
  copy.hash = '';
  copy.hostname = copy.hostname.toLowerCase();
  if (copy.pathname.length > 1 && copy.pathname.endsWith('/')) copy.pathname = copy.pathname.slice(0, -1);
  return copy.toString();
}

function decodeSafe(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}
