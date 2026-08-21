import { handleOptions, jsonError, jsonResponse, methodNotAllowed } from '../../_shared/gateway.ts';

/**
 * Anonymous HTML crawl for the photoreal website builder.
 *
 * No tenant, no membership, no DB write. The customer must see THEIR site
 * before login and before Stripe. SSRF guards stay identical to `discover`.
 *
 * POST /functions/v1/siteos/public-discover
 * body: { url: string }
 * returns: { ok, source_url, status, html }
 */
const MAX_HTML_BYTES = 350_000;
const MAX_REDIRECTS = 3;

export async function handle(req: Request): Promise<Response> {
  const preflight = handleOptions(req);
  if (preflight) return preflight;
  if (req.method !== 'POST') return methodNotAllowed();

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return jsonError(400, 'BAD_REQUEST', 'invalid json');
  }
  const rawUrl = String(body.url ?? '').trim();
  if (!rawUrl) return jsonError(400, 'BAD_REQUEST', 'url required');

  let sourceUrl: URL;
  try {
    sourceUrl = new URL(/^https?:\/\//i.test(rawUrl) ? rawUrl : `https://${rawUrl}`);
  } catch {
    return jsonError(400, 'BAD_REQUEST', 'invalid url');
  }
  if (!['http:', 'https:'].includes(sourceUrl.protocol)) {
    return jsonError(400, 'BAD_REQUEST', 'only http and https are supported');
  }
  if (isBlockedHostname(sourceUrl.hostname)) {
    return jsonError(400, 'BAD_REQUEST', 'private or local addresses are not allowed');
  }

  try {
    const found = await crawl(sourceUrl);
    return jsonResponse({ ok: true, ...found });
  } catch (error) {
    return jsonError(502, 'UNREACHABLE', error instanceof Error ? error.message : 'website discovery failed');
  }
}

async function crawl(startUrl: URL) {
  let current = startUrl;
  let response: Response | null = null;
  for (let redirects = 0; redirects <= MAX_REDIRECTS; redirects += 1) {
    if (isBlockedHostname(current.hostname)) throw new Error('redirected to a private or local address');
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8_000);
    try {
      response = await fetch(current, {
        method: 'GET',
        redirect: 'manual',
        headers: {
          accept: 'text/html,application/xhtml+xml;q=0.9,*/*;q=0.1',
          'user-agent': 'RealSyncDynamicsAI-Rebuild/1.0 (+https://realsyncdynamicsai.de)',
        },
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timer);
    }
    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get('location');
      if (!location) throw new Error('redirect response without location');
      if (redirects === MAX_REDIRECTS) throw new Error('too many redirects');
      current = new URL(location, current);
      continue;
    }
    break;
  }
  if (!response) throw new Error('no response');
  if (!response.ok) throw new Error(`source returned HTTP ${response.status}`);
  const html = (await response.text()).slice(0, MAX_HTML_BYTES);
  if (html.length < 40) throw new Error('source document is empty');
  return { source_url: current.toString(), status: response.status, html };
}

function isBlockedHostname(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/^\[|\]$/g, '');
  if (host === 'localhost' || host.endsWith('.localhost') || host === 'local') return true;
  if (host === '::1' || host.startsWith('fc') || host.startsWith('fd') || host.startsWith('fe80:')) return true;
  const parts = host.split('.').map(Number);
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) return false;
  const [a, b] = parts;
  return a === 0 || a === 10 || a === 127 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127) || a >= 224;
}
