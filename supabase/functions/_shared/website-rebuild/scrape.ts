// Step 1 — Scrape: Quell-URL holen und DOM-Resourcen indexieren.
//
// Rendert KEIN JavaScript (Server-side fetch, kein Headless-Browser). Für
// JS-heavy Single-Page-Apps liefert das nur das App-Shell — diese Sites
// brauchen Premium-Tier mit Headless-Render-Step (siehe out-of-scope).

import type { ScrapedSite } from './types.ts';

const FETCH_TIMEOUT_MS = 15_000;
const MAX_BYTES = 5 * 1024 * 1024; // 5 MB raw HTML cap

export async function scrapeSource(sourceUrl: string): Promise<ScrapedSite> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
  let res: Response;
  try {
    res = await fetch(sourceUrl, {
      headers: { 'User-Agent': 'RealSyncDynamics-Rebuild/1.0 (+https://realsyncdynamics.ai)' },
      redirect: 'follow',
      signal: ctrl.signal,
    });
  } finally {
    clearTimeout(timer);
  }

  if (!res.ok) throw new Error(`scrape_fetch_failed: status=${res.status}`);
  const ct = res.headers.get('content-type') ?? '';
  if (!ct.includes('text/html')) throw new Error(`scrape_not_html: content-type=${ct}`);

  const reader = res.body?.getReader();
  if (!reader) throw new Error('scrape_no_body');

  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    if (value) {
      total += value.length;
      if (total > MAX_BYTES) throw new Error('scrape_too_large');
      chunks.push(value);
    }
  }
  const html = new TextDecoder().decode(concat(chunks));

  return {
    html,
    title: extract(html, /<title[^>]*>([^<]*)<\/title>/i) ?? '',
    cssLinks: extractAll(html, /<link[^>]+rel=["']stylesheet["'][^>]*href=["']([^"']+)["']/gi),
    scriptSrcs: extractAll(html, /<script[^>]+src=["']([^"']+)["']/gi),
    imageSrcs: extractAll(html, /<img[^>]+src=["']([^"']+)["']/gi),
    iframeSrcs: extractAll(html, /<iframe[^>]+src=["']([^"']+)["']/gi),
    fontUrls: extractAll(html, /https?:\/\/fonts\.(?:googleapis|gstatic)\.com\/[^"'\s)]+/gi),
    inlineScripts: extractAll(html, /<script(?![^>]+src=)[^>]*>([\s\S]*?)<\/script>/gi),
    meta: extractMetaTags(html),
    byteSize: total,
  };
}

function concat(chunks: Uint8Array[]): Uint8Array {
  const len = chunks.reduce((s, c) => s + c.length, 0);
  const out = new Uint8Array(len);
  let off = 0;
  for (const c of chunks) { out.set(c, off); off += c.length; }
  return out;
}

function extract(s: string, re: RegExp): string | null {
  const m = s.match(re);
  return m ? m[1].trim() : null;
}

function extractAll(s: string, re: RegExp): string[] {
  const out = new Set<string>();
  for (const m of s.matchAll(re)) {
    if (m[1]) out.add(m[1].trim());
  }
  return [...out];
}

function extractMetaTags(html: string): Record<string, string> {
  const meta: Record<string, string> = {};
  for (const m of html.matchAll(
    /<meta[^>]+(?:name|property)=["']([^"']+)["'][^>]+content=["']([^"']*)["']/gi
  )) {
    meta[m[1].toLowerCase()] = m[2];
  }
  return meta;
}
