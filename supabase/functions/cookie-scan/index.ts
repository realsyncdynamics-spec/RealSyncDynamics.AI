// Cookie-Scanner — öffentliches Free-Tool ohne Email-Gate.
//
// POST /functions/v1/cookie-scan   (verify_jwt = false; public endpoint)
// Body: { url: string }
//
// Lightweight im Vergleich zu gdpr-audit:
//   - kein Email-Lead-Capture, keine DB-Persistenz, keine sales_leads-Row
//   - reine Set-Cookie-Header-Analyse + Tracker-Script-Detection in HTML
//   - Rate-Limit per IP-Hash via in-memory Map (~5 req/IP/min)
//
// Response shape (für /cookie-scanner-Frontend):
//   {
//     ok: true,
//     domain: string,
//     fetched_status: number | null,
//     scanned_at: string (ISO),
//     cookies: Cookie[],
//     trackers: Tracker[],
//     score: 0..100,
//     severity: 'pass' | 'low' | 'medium' | 'high' | 'critical'
//   }

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const URL_RE = /^https?:\/\/[^\s/$.?#].[^\s]*$/i;

interface Cookie {
  name: string;
  value_preview: string;          // erste 8 Zeichen, Rest maskiert
  domain: string | null;
  path: string | null;
  expires: string | null;          // raw Date string oder Max-Age
  http_only: boolean;
  secure: boolean;
  same_site: string | null;
  category: 'essential' | 'tracking' | 'unknown';
  third_party: boolean;            // domain-cookie ≠ Site-domain
  set_before_consent: boolean;     // immer true im Free-Scan, da kein Consent gegeben wurde
}

interface Tracker {
  id: string;                      // 'google_analytics', 'meta_pixel', etc.
  name: string;                    // human-readable
  category: 'analytics' | 'advertising' | 'ux' | 'consent_manager';
  pattern_matched: string;         // Auszug aus dem Script-Tag oder URL
  consent_compliant: boolean;      // false wenn vor irgendeinem Consent-Manager geladen
}

interface ScanResult {
  ok: true;
  url: string;
  domain: string;
  fetched_status: number | null;
  fetch_error: string | null;
  scanned_at: string;
  cookies: Cookie[];
  trackers: Tracker[];
  consent_manager_detected: boolean;
  score: number;
  severity: 'pass' | 'low' | 'medium' | 'high' | 'critical';
  summary: string;
}

// Tracker-Patterns — abgeglichen mit den Hauptprüfregeln in
// _shared/rules/gdpr.json. Keine Regex auf User-eingegebenes HTML, sondern
// strict-includes/-pattern. Erweiterbar ohne Code-Änderung sobald die
// scripts/audit-batch.mjs-Liste wächst.
const TRACKER_PATTERNS: Array<{ id: string; name: string; category: Tracker['category']; needles: string[] }> = [
  { id: 'google_analytics', name: 'Google Analytics (GA4)', category: 'analytics',     needles: ['googletagmanager.com/gtag/js', 'google-analytics.com/analytics.js', 'googletagmanager.com/gtm.js'] },
  { id: 'meta_pixel',       name: 'Meta / Facebook Pixel', category: 'advertising',    needles: ['connect.facebook.net/en_US/fbevents.js', 'fbq(']          },
  { id: 'linkedin_insight', name: 'LinkedIn Insight Tag',  category: 'advertising',    needles: ['snap.licdn.com/li.lms-analytics']                          },
  { id: 'tiktok_pixel',     name: 'TikTok Pixel',          category: 'advertising',    needles: ['analytics.tiktok.com', 'sdk.tiktok-cn.com']               },
  { id: 'hotjar',           name: 'Hotjar',                category: 'ux',             needles: ['static.hotjar.com', 'hotjar-']                            },
  { id: 'clarity',          name: 'Microsoft Clarity',     category: 'ux',             needles: ['clarity.ms/tag', '(function(c,l,a,r,i,t,y)']             },
  { id: 'matomo',           name: 'Matomo',                category: 'analytics',      needles: ['matomo.js', 'piwik.js']                                   },
];

const CONSENT_PATTERNS: string[] = [
  'cookiebot.com', 'usercentrics.eu', 'borlabs-cookie', 'klaro', 'onetrust.com',
  'cookieyes.com', 'real-cookie-banner', 'iubenda.com',
];

const ESSENTIAL_COOKIE_NAMES = new Set([
  // Common framework / session cookies — heuristic only
  'sessionid', 'csrf', 'csrftoken', 'xsrf-token', 'phpsessid', 'jsessionid',
  'connect.sid', 'next-auth.csrf-token', 'cf_clearance', 'cf-bm',
]);

const TRACKING_COOKIE_PATTERNS = [
  /^_ga/, /^_gid/, /^_gat/,                 // Google Analytics
  /^_fbp/, /^_fbc/,                          // Meta Pixel
  /^_li_/, /^bcookie/, /^lidc/,             // LinkedIn
  /^_tt_/, /^ttp/,                          // TikTok
  /^_hj/,                                   // Hotjar
  /^_clck/, /^_clsk/, /^MR/, /^MUID/,       // Microsoft Clarity / MS-Ads
  /^_pk_/,                                  // Matomo
];

// Per-IP rate-limit: simple Map cleared per cold-start
const RATE_LIMIT = new Map<string, { count: number; reset: number }>();
const RATE_LIMIT_MAX = 6;
const RATE_LIMIT_WINDOW_MS = 60_000;

async function sha256Hex(input: string): Promise<string> {
  const buf = new TextEncoder().encode(input);
  const hash = await crypto.subtle.digest('SHA-256', buf);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function checkRateLimit(ipHash: string): boolean {
  const now = Date.now();
  const rec = RATE_LIMIT.get(ipHash);
  if (!rec || now > rec.reset) {
    RATE_LIMIT.set(ipHash, { count: 1, reset: now + RATE_LIMIT_WINDOW_MS });
    return true;
  }
  if (rec.count >= RATE_LIMIT_MAX) return false;
  rec.count++;
  return true;
}

function maskValue(v: string): string {
  if (v.length <= 8) return v;
  return v.slice(0, 8) + '…';
}

function classifyCookie(name: string, siteDomain: string, cookieDomain: string | null): {
  category: Cookie['category']; third_party: boolean;
} {
  const isThirdParty = cookieDomain != null
    && !siteDomain.endsWith(cookieDomain.replace(/^\./, ''))
    && !cookieDomain.replace(/^\./, '').endsWith(siteDomain);

  const lc = name.toLowerCase();
  if (ESSENTIAL_COOKIE_NAMES.has(lc)) return { category: 'essential', third_party: isThirdParty };
  if (TRACKING_COOKIE_PATTERNS.some((re) => re.test(name))) return { category: 'tracking', third_party: isThirdParty };
  return { category: 'unknown', third_party: isThirdParty };
}

function parseSetCookie(header: string, siteDomain: string): Cookie | null {
  const parts = header.split(';').map((s) => s.trim());
  if (parts.length === 0) return null;
  const [nameVal] = parts;
  const eq = nameVal.indexOf('=');
  if (eq < 1) return null;
  const name = nameVal.slice(0, eq);
  const value = nameVal.slice(eq + 1);

  const cookie: Cookie = {
    name,
    value_preview: maskValue(value),
    domain: null,
    path: null,
    expires: null,
    http_only: false,
    secure: false,
    same_site: null,
    category: 'unknown',
    third_party: false,
    set_before_consent: true,
  };

  for (let i = 1; i < parts.length; i++) {
    const p = parts[i];
    const lower = p.toLowerCase();
    if (lower === 'httponly') cookie.http_only = true;
    else if (lower === 'secure') cookie.secure = true;
    else if (lower.startsWith('domain=')) cookie.domain = p.slice(7);
    else if (lower.startsWith('path=')) cookie.path = p.slice(5);
    else if (lower.startsWith('expires=')) cookie.expires = p.slice(8);
    else if (lower.startsWith('max-age=') && !cookie.expires) cookie.expires = `Max-Age=${p.slice(8)}`;
    else if (lower.startsWith('samesite=')) cookie.same_site = p.slice(9);
  }

  const cls = classifyCookie(name, siteDomain, cookie.domain);
  cookie.category = cls.category;
  cookie.third_party = cls.third_party;
  return cookie;
}

function detectTrackers(html: string): { trackers: Tracker[]; consent_manager_detected: boolean } {
  const trackers: Tracker[] = [];
  for (const t of TRACKER_PATTERNS) {
    const hit = t.needles.find((needle) => html.includes(needle));
    if (hit) {
      trackers.push({
        id: t.id,
        name: t.name,
        category: t.category,
        pattern_matched: hit,
        consent_compliant: false,
      });
    }
  }
  const consent_manager_detected = CONSENT_PATTERNS.some((p) => html.includes(p));
  if (consent_manager_detected) {
    // Cannot prove pre-consent loading from server-side scan alone —
    // mark all trackers as „needs manual verification" rather than auto-flag.
    for (const t of trackers) t.consent_compliant = false; // still false: fetch was without consent
  }
  return { trackers, consent_manager_detected };
}

function scoreScan(cookies: Cookie[], trackers: Tracker[], consentManager: boolean): { score: number; severity: ScanResult['severity']; summary: string } {
  let score = 100;
  const trackingCookies = cookies.filter((c) => c.category === 'tracking').length;
  const thirdPartyCookies = cookies.filter((c) => c.third_party).length;
  const trackerCount = trackers.length;

  score -= trackingCookies * 8;
  score -= thirdPartyCookies * 4;
  score -= trackerCount * 10;
  if (!consentManager && trackerCount > 0) score -= 15;

  score = Math.max(0, Math.min(100, score));

  let severity: ScanResult['severity'];
  if (score >= 90) severity = 'pass';
  else if (score >= 70) severity = 'low';
  else if (score >= 50) severity = 'medium';
  else if (score >= 30) severity = 'high';
  else severity = 'critical';

  const parts: string[] = [];
  if (cookies.length === 0) parts.push('Keine Cookies vor Consent gesetzt.');
  else parts.push(`${cookies.length} Cookie${cookies.length === 1 ? '' : 's'} vor Consent gesetzt`);
  if (trackerCount > 0) parts.push(`${trackerCount} Tracker erkannt`);
  if (consentManager) parts.push('Consent-Manager vorhanden — manuelle Verifikation der Pre-Consent-Loading-Reihenfolge nötig');
  else if (trackerCount > 0) parts.push('Kein Consent-Manager erkannt');

  const summary = parts.join(' · ');
  return { score, severity, summary };
}

async function fetchWithTimeout(url: string, timeoutMs: number): Promise<Response> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    return await fetch(url, {
      method: 'GET',
      signal: ctrl.signal,
      redirect: 'follow',
      headers: {
        'User-Agent': 'RealSyncDynamics-CookieScanner/1.0 (+https://realsyncdynamicsai.de/cookie-scanner)',
        'Accept': 'text/html,application/xhtml+xml',
      },
    });
  } finally {
    clearTimeout(t);
  }
}

function jsonResponse(status: number, body: Record<string, unknown>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function jsonError(status: number, code: string, message: string) {
  return jsonResponse(status, { ok: false, error: { code, message } });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return jsonError(405, 'BAD_REQUEST', 'POST only');

  let body: { url?: string };
  try { body = await req.json(); } catch { return jsonError(400, 'BAD_REQUEST', 'invalid json'); }

  const url = (body.url ?? '').trim();
  if (!url || !URL_RE.test(url)) return jsonError(400, 'INVALID_URL', 'valid http(s) URL required');
  if (url.length > 1000)         return jsonError(400, 'INVALID_URL', 'url too long');

  const ipHeader = req.headers.get('x-forwarded-for') ?? req.headers.get('cf-connecting-ip') ?? 'unknown';
  const ipHash = await sha256Hex(ipHeader);
  if (!checkRateLimit(ipHash)) return jsonError(429, 'RATE_LIMITED', `max ${RATE_LIMIT_MAX} scans per minute, retry shortly`);

  let domain = '';
  try { domain = new URL(url).hostname.toLowerCase(); }
  catch { return jsonError(400, 'INVALID_URL', 'unparsable url'); }

  let html = '';
  let status: number | null = null;
  let setCookieHeaders: string[] = [];
  let fetchError: string | null = null;

  try {
    const resp = await fetchWithTimeout(url, 10_000);
    status = resp.status;

    // Deno's Headers polyfill exposes set-cookie as a comma-joined string.
    // The dedicated getSetCookie() returns the array.
    const sc: string[] | undefined = (resp.headers as unknown as { getSetCookie?: () => string[] }).getSetCookie?.();
    setCookieHeaders = sc ?? (resp.headers.get('set-cookie') ? resp.headers.get('set-cookie')!.split(/, (?=[A-Za-z0-9_-]+=)/) : []);

    if (resp.ok || (status >= 300 && status < 400)) {
      const reader = resp.body?.getReader();
      if (reader) {
        const chunks: Uint8Array[] = [];
        let total = 0;
        while (total < 1_000_000) {
          const { value, done } = await reader.read();
          if (done) break;
          chunks.push(value);
          total += value.byteLength;
        }
        await reader.cancel();
        const merged = new Uint8Array(total);
        let off = 0;
        for (const c of chunks) { merged.set(c, off); off += c.byteLength; }
        html = new TextDecoder('utf-8', { fatal: false }).decode(merged);
      }
    }
  } catch (err) {
    fetchError = err instanceof Error ? err.message : String(err);
  }

  const cookies = setCookieHeaders
    .map((h) => parseSetCookie(h, domain))
    .filter((c): c is Cookie => c != null);

  const { trackers, consent_manager_detected } = detectTrackers(html);
  const { score, severity, summary } = scoreScan(cookies, trackers, consent_manager_detected);

  const result: ScanResult = {
    ok: true,
    url,
    domain,
    fetched_status: status,
    fetch_error: fetchError,
    scanned_at: new Date().toISOString(),
    cookies,
    trackers,
    consent_manager_detected,
    score,
    severity,
    summary,
  };

  return jsonResponse(200, result as unknown as Record<string, unknown>);
});
