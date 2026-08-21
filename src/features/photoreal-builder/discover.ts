import { getSupabase, isSupabaseConfigured } from '../../lib/supabase';
import { inferredFromHost, parseHtml } from './parse';
import type { SiteDiscovery } from './types';

export function normalizeUrl(raw: string) {
  const s = raw.trim();
  if (!s) throw new Error('Domain fehlt');
  const withProto = /^https?:\/\//i.test(s) ? s : `https://${s}`;
  const u = new URL(withProto);
  if (!u.hostname.includes('.')) throw new Error('Ungültige Domain');
  return u.toString();
}

/**
 * Photoreal reconstruction does not wait for login.
 * 1. Public siteos crawl (no tenant) — real HTML, EU-hosted.
 * 2. Direct fetch — works only without CORS.
 * 3. inferredFromHost — the customer still sees a rebuilt site.
 */
export async function discoverSite(raw: string): Promise<SiteDiscovery> {
  const url = normalizeUrl(raw);
  const fromEdge = await tryPublicDiscover(url);
  if (fromEdge) return fromEdge;
  const fromBrowser = await tryBrowserFetch(url);
  if (fromBrowser) return fromBrowser;
  return inferredFromHost(url);
}

async function tryPublicDiscover(url: string): Promise<SiteDiscovery | null> {
  if (!isSupabaseConfigured()) return null;
  try {
    const { data, error } = await getSupabase().functions.invoke('siteos/public-discover', {
      body: { url },
    });
    if (error || !data) return null;
    const html = typeof data.html === 'string' ? data.html : '';
    const source = typeof data.source_url === 'string' ? data.source_url : url;
    const status = typeof data.status === 'number' ? data.status : 200;
    if (html.length < 40) return null;
    return parseHtml(source, html, status);
  } catch {
    return null;
  }
}

async function tryBrowserFetch(url: string): Promise<SiteDiscovery | null> {
  try {
    const res = await fetch(url, {
      redirect: 'follow',
      signal: AbortSignal.timeout(8000),
      headers: { Accept: 'text/html,application/xhtml+xml' },
    });
    const html = await res.text();
    if (!html || html.length < 40) return null;
    return parseHtml(url, html.slice(0, 350_000), res.status);
  } catch {
    return null;
  }
}
