// Abruf einer Ausgangsseite — der einzige Netzwerkzugriff des Rebuilds.
//
// Der Kern (`packages/siteos-core/src/rebuild`) hat keinen Netzwerkzugriff
// und darf keinen haben. Alles, was hier steht, ist Schutz des Abrufs:
// nur http(s), keine privaten oder lokalen Adressen (auch nicht nach einer
// Weiterleitung), begrenzte Zeit, begrenzte Größe, nur HTML.
//
// Die Adressprüfung ist bewusst dieselbe wie in `handlers/discover.ts` —
// dort inline, hier als Funktion, weil sie zwei Aufrufer hat. Eine dritte
// Kopie wäre die Stelle, an der irgendwann ein Bereich vergessen wird.

const MAX_HTML_BYTES = 1_500_000;
const MAX_REDIRECTS = 3;
const TIMEOUT_MS = 10_000;

export interface FetchedSource {
  sourceUrl: string;
  finalUrl: string;
  statusCode: number;
  contentType: string | null;
  html: string;
  fetchedAt: string;
}

export class SourceFetchError extends Error {
  readonly code: 'BAD_REQUEST' | 'UNREACHABLE';
  constructor(code: 'BAD_REQUEST' | 'UNREACHABLE', message: string) {
    super(message);
    this.code = code;
  }
}

export function parseSourceUrl(raw: string): URL {
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    throw new SourceFetchError('BAD_REQUEST', 'invalid url');
  }
  if (!['http:', 'https:'].includes(url.protocol)) throw new SourceFetchError('BAD_REQUEST', 'only http and https are supported');
  if (isBlockedHostname(url.hostname)) throw new SourceFetchError('BAD_REQUEST', 'private or local addresses are not allowed');
  return url;
}

export async function fetchSource(startUrl: URL): Promise<FetchedSource> {
  let current = startUrl;
  let response: Response | null = null;
  for (let redirects = 0; redirects <= MAX_REDIRECTS; redirects += 1) {
    if (isBlockedHostname(current.hostname)) throw new SourceFetchError('BAD_REQUEST', 'redirected to a private or local address');
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
      response = await fetch(current, {
        method: 'GET',
        redirect: 'manual',
        headers: {
          accept: 'text/html,application/xhtml+xml;q=0.9,*/*;q=0.1',
          'user-agent': 'RealSyncDynamicsAI-SiteOS-Rebuild/1.0 (+https://realsyncdynamicsai.de)',
        },
        signal: controller.signal,
      });
    } catch (error) {
      throw new SourceFetchError('UNREACHABLE', error instanceof Error ? error.message : 'fetch failed');
    } finally {
      clearTimeout(timer);
    }
    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get('location');
      if (!location) throw new SourceFetchError('UNREACHABLE', 'redirect response without location');
      if (redirects === MAX_REDIRECTS) throw new SourceFetchError('UNREACHABLE', 'too many redirects');
      current = new URL(location, current);
      continue;
    }
    break;
  }
  if (!response) throw new SourceFetchError('UNREACHABLE', 'no response');
  if (!response.ok) throw new SourceFetchError('UNREACHABLE', `source returned HTTP ${response.status}`);

  const contentType = response.headers.get('content-type');
  if (!contentType || !/text\/html|application\/xhtml\+xml/i.test(contentType)) {
    throw new SourceFetchError('UNREACHABLE', 'source is not an HTML document');
  }
  const declared = Number(response.headers.get('content-length') ?? 0);
  if (declared > MAX_HTML_BYTES) throw new SourceFetchError('UNREACHABLE', 'source document is too large');

  const html = (await response.text()).slice(0, MAX_HTML_BYTES);
  return {
    sourceUrl: startUrl.toString(),
    finalUrl: current.toString(),
    statusCode: response.status,
    contentType,
    html,
    fetchedAt: new Date().toISOString(),
  };
}

export function isBlockedHostname(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/^\[|\]$/g, '');
  if (host === 'localhost' || host.endsWith('.localhost') || host === 'local' || host.endsWith('.local') || host.endsWith('.internal')) return true;
  if (host === '::1' || host.startsWith('fc') || host.startsWith('fd') || host.startsWith('fe80:')) return true;
  const parts = host.split('.').map(Number);
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) return false;
  const [a, b] = parts;
  return a === 0 || a === 10 || a === 127 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127) || a >= 224;
}
