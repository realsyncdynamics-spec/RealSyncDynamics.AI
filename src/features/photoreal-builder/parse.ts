import { companyFromHost, hostFromUrl, industryFromText } from './design-variants';
import type { ServiceItem, SiteDiscovery } from './types';

const BOILERPLATE =
  /cookie|consent|tracking|newsletter|warenkorb|login|anmelden|alle akzeptieren|privacy-policy|gtm-|googletag/i;

function stripTags(html: string) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ");
}

function decode(s: string) {
  return s
    .replace(/&nbsp;/gi, " ")
    .replace(/&/gi, "&")
    .replace(/"/gi, '"')
    .replace(/&#39;|'/gi, "'")
    .replace(/</gi, "<")
    .replace(/>/gi, ">")
    .replace(/\s+/g, " ")
    .trim();
}

function meta(html: string, name: string) {
  const re = new RegExp(
    `<meta[^>]+(?:name|property)=["']${name}["'][^>]+content=["']([^"']+)["']`,
    "i",
  );
  const alt = new RegExp(
    `<meta[^>]+content=["']([^"']+)["'][^>]+(?:name|property)=["']${name}["']`,
    "i",
  );
  return decode(html.match(re)?.[1] ?? html.match(alt)?.[1] ?? "");
}

function all(html: string, re: RegExp) {
  const out: string[] = [];
  const g = new RegExp(re.source, re.flags.includes("g") ? re.flags : `${re.flags}g`);
  let m: RegExpExecArray | null;
  while ((m = g.exec(html))) {
    const v = decode(m[1] ?? "");
    if (v && !BOILERPLATE.test(v)) out.push(v);
  }
  return out;
}

function unique(items: string[], max = 12) {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of items) {
    const k = raw.toLowerCase();
    if (k.length < 3 || seen.has(k)) continue;
    seen.add(k);
    out.push(raw);
    if (out.length >= max) break;
  }
  return out;
}

function emails(text: string) {
  return unique((text.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g) ?? []).filter((e) => !/example\.com|sentry|wixpress|godaddy/i.test(e)), 5);
}

function phones(text: string) {
  return unique(
    (text.match(/(?:\+49|0049|0)[\d\s/()-]{8,18}/g) ?? []).map((p) => p.replace(/\s+/g, " ").trim()),
    4,
  );
}

function servicesFrom(headings: string[], paragraphs: string[]): ServiceItem[] {
  const candidates = headings.filter(
    (h) =>
      h.length > 3 &&
      h.length < 48 &&
      !/home|start|willkommen|impressum|datenschutz|cookie|menü|menu|kontakt/i.test(h),
  );
  const out: ServiceItem[] = [];
  for (const title of candidates.slice(0, 6)) {
    const description =
      paragraphs.find((p) => p.length > 40 && p.toLowerCase().includes(title.toLowerCase().slice(0, 12))) ??
      paragraphs[out.length] ??
      `${title} — aus der bestehenden Website übernommen, neu strukturiert.`;
    out.push({ type: "service", title, description: description.slice(0, 220) });
  }
  return out;
}

export function inferredFromHost(url: string): SiteDiscovery {
  const host = hostFromUrl(url);
  const company = companyFromHost(host);
  const industry = industryFromText(`${host} ${company}`);
  return {
    url,
    host,
    fetched: false,
    status: null,
    title: company,
    description: `${company} — Inhalte konnten nicht geladen werden. Die neue Architektur wird aus Domain und Branche abgeleitet.`,
    company,
    headings: [company, "Leistungen", "Über uns"],
    paragraphs: [],
    services: [],
    nav: ["Home", "Leistungen", "Über uns", "Kontakt"],
    emails: [],
    phones: [],
    address: null,
    hours: null,
    hasImpressum: false,
    hasDatenschutz: false,
    themeColor: null,
    missing: ["Inhalte der Ausgangsseite", "Impressum", "Datenschutz", "Leistungen"],
    industry,
    photos: [],
  };
}

export function parseHtml(url: string, html: string, status: number | null = 200): SiteDiscovery {
  const host = hostFromUrl(url);
  const clean = stripTags(html);
  const title = decode(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? "") || companyFromHost(host);
  const description =
    meta(html, "description") ||
    meta(html, "og:description") ||
    "";
  const ogSite = meta(html, "og:site_name");
  const company = ogSite || companyFromHost(host);
  const h1 = all(clean, /<h1[^>]*>([\s\S]*?)<\/h1>/i);
  const h2 = all(clean, /<h2[^>]*>([\s\S]*?)<\/h2>/i);
  const headings = unique(
    [...h1, ...h2].map((h) => h.replace(/<[^>]+>/g, "")),
    16,
  );
  const paragraphs = unique(
    all(clean, /<p[^>]*>([\s\S]*?)<\/p>/i)
      .map((p) => p.replace(/<[^>]+>/g, ""))
      .filter((p) => p.length > 48 && p.length < 420 && !BOILERPLATE.test(p)),
    10,
  );
  const nav = unique(
    all(html, /<a[^>]+href=["'][^"']+["'][^>]*>([\s\S]*?)<\/a>/i)
      .map((t) => t.replace(/<[^>]+>/g, ""))
      .filter((t) => t.length > 1 && t.length < 28),
    10,
  );
  const text = `${title} ${description} ${headings.join(" ")} ${paragraphs.join(" ")}`;
  const hasImpressum = /impressum/i.test(html);
  const hasDatenschutz = /datenschutz|privacy/i.test(html);
  const services = servicesFrom(headings, paragraphs);
  const missing: string[] = [];
  if (!description) missing.push("Meta-Beschreibung");
  if (!services.length) missing.push("Leistungen");
  if (!hasImpressum) missing.push("Impressum");
  if (!hasDatenschutz) missing.push("Datenschutz");
  if (!emails(`${html} ${text}`).length) missing.push("E-Mail");

  return {
    url,
    host,
    fetched: true,
    status,
    title: title.slice(0, 120),
    description: (description || paragraphs[0] || `${company} — neu strukturiert.`).slice(0, 280),
    company,
    headings,
    paragraphs,
    services,
    nav,
    emails: emails(html),
    phones: phones(html),
    address: html.match(/\d{5}\s+[A-ZÄÖÜ][a-zäöüß-]+/)?.[0] ?? null,
    hours: html.match(/(?:Mo|Di|Mi|Do|Fr).{0,40}\d{1,2}[:.]\d{2}/)?.[0] ?? null,
    hasImpressum,
    hasDatenschutz,
    themeColor: meta(html, "theme-color") || null,
    missing,
    industry: industryFromText(`${host} ${company} ${title} ${description} ${headings.join(" ")}`),
    photos: extractPhotos(html, url),
  };
}

export function extractPhotos(html: string, base: string): string[] {
  const origin = (() => {
    try { return new URL(base).origin; } catch { return base; }
  })();
  const found: string[] = [];
  const og = html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i)?.[1]
    ?? html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i)?.[1];
  if (og) found.push(og);
  const re = /<img[^>]+src=["']([^"']+)["']/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) found.push(m[1]);
  const skip = /favicon|sprite|pixel|tracking|1x1|logo\.svg|data:image\/svg|gravatar|doubleclick|facebook\.com\/tr/i;
  const out: string[] = [];
  for (const raw of found) {
    if (skip.test(raw)) continue;
    let abs = raw;
    try { abs = new URL(raw, origin).href; } catch { continue; }
    if (!/^https?:\/\//i.test(abs) && !abs.startsWith("data:image")) continue;
    if (out.includes(abs)) continue;
    out.push(abs);
    if (out.length >= 12) break;
  }
  return out;
}

export function architecture(model: SiteDiscovery) {
  return [
    { id: "home" as const, path: "/", title: "Home", reason: "Neue Einstiegsseite, nicht die alte Startseite." },
    { id: "leistungen" as const, path: "/leistungen", title: "Leistungen", reason: "Fakten aus der Quelle, neue Struktur." },
    { id: "ueber" as const, path: "/ueber-uns", title: "Über uns", reason: "Tonalität neu, Tatsachen erhalten." },
    { id: "kontakt" as const, path: "/kontakt", title: "Kontakt", reason: "Nur übernommene Kontaktdaten." },
    { id: "recht" as const, path: "/rechtliches", title: "Rechtliches", reason: "Keine erfundenen Angaben." },
  ].filter((p) => p.id !== "leistungen" || model.services.length > 0 || model.missing.includes("Leistungen"));
}
