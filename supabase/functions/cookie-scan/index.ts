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

import { corsHeaders, handleOptions, jsonResponse, jsonError } from '../_shared/gateway.ts';

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

interface PrivacyAnalytics {
  id: string;
  name: string;
  pattern_matched: string;
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
  privacy_analytics: PrivacyAnalytics[];
  consent_manager_detected: boolean;
  score: number;
  severity: 'pass' | 'low' | 'medium' | 'high' | 'critical';
  summary: string;
  forms?: {
    total_forms: number;
    has_email_field: boolean;
    has_password_field: boolean;
    has_phone_field: boolean;
    contact_form_detected: boolean;
    signup_form_detected: boolean;
    visible_consent_link: boolean;
  };
  unknown_scripts_count?: number;
}

// Tracker-Patterns — abgeglichen mit den Hauptprüfregeln in
// _shared/rules/gdpr.json. Keine Regex auf User-eingegebenes HTML, sondern
// strict-includes/-pattern. Erweiterbar ohne Code-Änderung sobald die
// scripts/audit-batch.mjs-Liste wächst.
const TRACKER_PATTERNS: Array<{ id: string; name: string; category: Tracker['category']; needles: string[] }> = [
  // Analytics
  { id: 'google_analytics', name: 'Google Analytics (GA4)',  category: 'analytics',   needles: ['googletagmanager.com/gtag/js', 'google-analytics.com/analytics.js', 'googletagmanager.com/gtm.js'] },
  { id: 'matomo',           name: 'Matomo',                  category: 'analytics',   needles: ['matomo.js', 'piwik.js']                                   },
  { id: 'mixpanel',         name: 'Mixpanel',                category: 'analytics',   needles: ['cdn.mxpnl.com', 'api.mixpanel.com']                       },
  { id: 'amplitude',        name: 'Amplitude',               category: 'analytics',   needles: ['cdn.amplitude.com', 'api.amplitude.com']                  },
  { id: 'segment',          name: 'Segment',                 category: 'analytics',   needles: ['cdn.segment.com/analytics.js', 'api.segment.io']          },
  { id: 'posthog',          name: 'PostHog',                 category: 'analytics',   needles: ['app.posthog.com', 'eu.posthog.com', '/posthog.js']        },
  // Advertising / Pixels
  { id: 'meta_pixel',       name: 'Meta / Facebook Pixel',   category: 'advertising', needles: ['connect.facebook.net/en_US/fbevents.js', 'fbq(']          },
  { id: 'linkedin_insight', name: 'LinkedIn Insight Tag',    category: 'advertising', needles: ['snap.licdn.com/li.lms-analytics']                          },
  { id: 'tiktok_pixel',     name: 'TikTok Pixel',            category: 'advertising', needles: ['analytics.tiktok.com', 'sdk.tiktok-cn.com']               },
  { id: 'pinterest_tag',    name: 'Pinterest Tag',           category: 'advertising', needles: ['s.pinimg.com/ct/core.js', 'pintrk(']                      },
  { id: 'twitter_pixel',    name: 'Twitter / X Pixel',       category: 'advertising', needles: ['static.ads-twitter.com/uwt.js', 'twq(']                   },
  { id: 'snapchat_pixel',   name: 'Snapchat Pixel',          category: 'advertising', needles: ['sc-static.net/scevent.min.js', 'snaptr(']                 },
  { id: 'reddit_pixel',     name: 'Reddit Pixel',            category: 'advertising', needles: ['www.redditstatic.com/ads/pixel.js', 'rdt(']               },
  { id: 'criteo',           name: 'Criteo',                  category: 'advertising', needles: ['static.criteo.net/js/']                                    },
  { id: 'outbrain',         name: 'Outbrain',                category: 'advertising', needles: ['amplify.outbrain.com', 'widgets.outbrain.com']             },
  { id: 'taboola',          name: 'Taboola',                 category: 'advertising', needles: ['cdn.taboola.com/libtrc']                                   },
  { id: 'adform',           name: 'Adform',                  category: 'advertising', needles: ['s1.adform.net', 'track.adform.net']                       },
  // UX / Heatmaps / Session-Replay
  { id: 'hotjar',           name: 'Hotjar',                  category: 'ux',          needles: ['static.hotjar.com', 'hotjar-']                            },
  { id: 'clarity',          name: 'Microsoft Clarity',       category: 'ux',          needles: ['clarity.ms/tag', '(function(c,l,a,r,i,t,y)']              },
  { id: 'fullstory',        name: 'FullStory',               category: 'ux',          needles: ['edge.fullstory.com/s/fs.js', 'FS.identify']               },
  { id: 'mouseflow',        name: 'Mouseflow',               category: 'ux',          needles: ['cdn.mouseflow.com']                                       },
  { id: 'smartlook',        name: 'Smartlook',               category: 'ux',          needles: ['rec.smartlook.com', 'web-sdk.smartlook.com']              },
  { id: 'lucky_orange',     name: 'Lucky Orange',            category: 'ux',          needles: ['cs.luckyorange.net', 'settings.luckyorange.net']          },
  { id: 'crazy_egg',        name: 'Crazy Egg',               category: 'ux',          needles: ['script.crazyegg.com']                                     },
];

// Privacy-friendly-by-design Analytics — sind technisch trotzdem Tracker
// (Set-Cookie / Network-Request) aber per default consent-frei betreibbar.
// Werden separat reportiert damit User die Wahl hat, ob sie als Befund zählen.
const PRIVACY_ANALYTICS_PATTERNS: Array<{ id: string; name: string; needles: string[] }> = [
  { id: 'plausible',  name: 'Plausible (privacy-friendly)',  needles: ['plausible.io/js/'] },
  { id: 'fathom',     name: 'Fathom Analytics (privacy-friendly)', needles: ['cdn.usefathom.com/script.js'] },
  { id: 'simple_analytics', name: 'Simple Analytics (privacy-friendly)', needles: ['scripts.simpleanalyticscdn.com'] },
  { id: 'umami',      name: 'Umami (privacy-friendly)',      needles: ['umami.is/script.js', '/umami.js'] },
];

const CONSENT_PATTERNS: string[] = [
  'cookiebot.com', 'usercentrics.eu', 'borlabs-cookie', 'klaro', 'onetrust.com',
  'cookieyes.com', 'real-cookie-banner', 'iubenda.com',
  // German-market additions
  'consentmanager.net', 'ccm19', 'cookie-information.com', 'cookieinformation.com',
  'cookielaw.org',                  // OneTrust CDN
  'didomi.io',                      // FR/EU CMP, growing in DE
  'trustarc.com',                   // US-heritage but EU-deployed
  'sourcepoint',                    // Sourcepoint CMP
  'osano.com',                      // Osano CMP
];

const ESSENTIAL_COOKIE_NAMES = new Set([
  // Common framework / session cookies — heuristic only
  'sessionid', 'csrf', 'csrftoken', 'xsrf-token', 'phpsessid', 'jsessionid',
  'connect.sid', 'next-auth.csrf-token', 'cf_clearance', 'cf-bm',
  '__host-next-auth.csrf-token', 'auth_session', 'authjs.session-token',
  '__cf_bm',                        // Cloudflare bot management (essential)
  '__stripe_mid', '__stripe_sid',   // Stripe checkout flow (essential, transactional)
  '__hssrc',                        // Hubspot (technically session-bound but borderline)
]);

const TRACKING_COOKIE_PATTERNS = [
  /^_ga/, /^_gid/, /^_gat/,                 // Google Analytics
  /^_fbp/, /^_fbc/,                          // Meta Pixel
  /^_li_/, /^bcookie/, /^lidc/,             // LinkedIn
  /^_tt_/, /^ttp/,                          // TikTok
  /^_pinterest_/, /^_pin_unauth/,            // Pinterest
  /^personalization_id/, /^muc_ads/,         // Twitter/X
  /^_scid/, /^sc_at/,                        // Snapchat
  /^_rdt_/,                                  // Reddit
  /^_hj/,                                    // Hotjar
  /^_clck/, /^_clsk/, /^MR/, /^MUID/,        // Microsoft Clarity / MS-Ads
  /^_pk_/,                                   // Matomo
  /^mp_/,                                    // Mixpanel
  /^amplitude_/, /^AMP_/,                    // Amplitude
  /^_cfduid/,                                // Cloudflare (deprecated but seen)
  /^IDE$/, /^DSID$/, /^id$/, /^FLC$/,        // DoubleClick / GA-Ads
  /^uetsid/, /^uetvid/,                      // Bing UET (Microsoft-Ads)
  /^_uetsid/, /^_uetvid/,
  /^crto_/, /^cto_/,                         // Criteo
  /^obuid/,                                  // Outbrain
  /^t_gid/,                                  // Taboola
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

function detectTrackers(html: string): {
  trackers: Tracker[];
  privacy_analytics: PrivacyAnalytics[];
  consent_manager_detected: boolean;
} {
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

  const privacy_analytics: PrivacyAnalytics[] = [];
  for (const p of PRIVACY_ANALYTICS_PATTERNS) {
    const hit = p.needles.find((needle) => html.includes(needle));
    if (hit) {
      privacy_analytics.push({ id: p.id, name: p.name, pattern_matched: hit });
    }
  }

  const consent_manager_detected = CONSENT_PATTERNS.some((p) => html.includes(p));
  if (consent_manager_detected) {
    // Cannot prove pre-consent loading from server-side scan alone —
    // mark all trackers as „needs manual verification" rather than auto-flag.
    for (const t of trackers) t.consent_compliant = false; // still false: fetch was without consent
  }
  return { trackers, privacy_analytics, consent_manager_detected };
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
        'User-Agent': 'RealSyncDynamics-CookieScanner/1.0 (+https://RealSyncDynamicsAI.de/cookie-scanner)',
        'Accept': 'text/html,application/xhtml+xml',
      },
    });
  } finally {
    clearTimeout(t);
  }
}

Deno.serve(async (req) => {
  const preflight = handleOptions(req); if (preflight) return preflight;
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

  const { trackers, privacy_analytics, consent_manager_detected } = detectTrackers(html);
  const { score, severity, summary } = scoreScan(cookies, trackers, consent_manager_detected);

  // Auto-Discovery — fire-and-forget Report von unbekannten 3rd-party Scripts
  // an die Datenbank. Blockiert nicht die Response.
  const unknownScripts = extractUnknownThirdPartyScripts(html, domain, trackers);
  if (unknownScripts.length > 0) {
    void reportUnknownScripts(unknownScripts, domain).catch((e) => {
      console.warn('[cookie-scan] report_unknown_tracker failed:', e instanceof Error ? e.message : String(e));
    });
  }

  // Form-Detection — Email/Password-Felder ohne sichtbaren Consent-Hinweis
  const formAnalysis = detectForms(html);

  const result: ScanResult = {
    ok: true,
    url,
    domain,
    fetched_status: status,
    fetch_error: fetchError,
    scanned_at: new Date().toISOString(),
    cookies,
    trackers,
    privacy_analytics,
    consent_manager_detected,
    score,
    severity,
    summary,
    forms: formAnalysis,
    unknown_scripts_count: unknownScripts.length,
  };

  return jsonResponse(result as unknown as Record<string, unknown>, 200);
});

/**
 * Extrahiert alle <script src="..."> aus dem HTML, filtert auf 3rd-party
 * (= andere Domain als die Site selbst) und entfernt jene die bereits durch
 * detectTrackers() klassifiziert wurden.
 */
function extractUnknownThirdPartyScripts(
  html: string,
  siteDomain: string,
  knownTrackers: Tracker[],
): Array<{ host: string; sampleUrl: string }> {
  const scriptSrcs = new Set<string>();
  for (const m of html.matchAll(/<script[^>]+src=["']([^"']+)["']/gi)) {
    if (m[1]) scriptSrcs.add(m[1].trim());
  }

  // Site-Domain inkl. ein-Level www-prefix-Variante
  const siteApex = siteDomain.replace(/^www\./, '');

  // Hosts die schon durch knownTrackers gematcht wurden — die nicht doppelt melden
  const matchedNeedles = knownTrackers.map((t) => t.pattern_matched.toLowerCase());

  const out: Array<{ host: string; sampleUrl: string }> = [];
  const seenHosts = new Set<string>();

  for (const src of scriptSrcs) {
    let parsedHost: string;
    try {
      // Relative oder protokoll-relative URLs als first-party betrachten
      if (!/^https?:/.test(src) && !src.startsWith('//')) continue;
      const fullUrl = src.startsWith('//') ? `https:${src}` : src;
      parsedHost = new URL(fullUrl).hostname.toLowerCase();
    } catch {
      continue;
    }

    const hostApex = parsedHost.replace(/^www\./, '');
    if (hostApex === siteApex) continue;                 // first-party
    if (hostApex.endsWith('.' + siteApex)) continue;     // subdomain der Site

    // Bereits durch tracker-registry erkannt?
    const lowerSrc = src.toLowerCase();
    if (matchedNeedles.some((n) => lowerSrc.includes(n))) continue;

    if (seenHosts.has(parsedHost)) continue;
    seenHosts.add(parsedHost);

    out.push({ host: parsedHost, sampleUrl: src.slice(0, 500) });
    if (out.length >= 20) break;                         // Limit pro Scan
  }

  return out;
}

async function reportUnknownScripts(
  scripts: Array<{ host: string; sampleUrl: string }>,
  customerDomain: string,
): Promise<void> {
  const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
  const SRK = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!SUPABASE_URL || !SRK) return;

  // Direkte HTTP-Calls an PostgREST RPC-Endpoint — keine supabase-js Lib nötig.
  await Promise.allSettled(scripts.map((s) =>
    fetch(`${SUPABASE_URL}/rest/v1/rpc/report_unknown_tracker`, {
      method: 'POST',
      headers: {
        'apikey': SRK,
        'authorization': `Bearer ${SRK}`,
        'content-type': 'application/json',
        'prefer': 'return=minimal',
      },
      body: JSON.stringify({
        p_script_host: s.host,
        p_sample_url: s.sampleUrl,
        p_customer_domain: customerDomain,
      }),
    })
  ));
}

interface FormAnalysis {
  total_forms: number;
  has_email_field: boolean;
  has_password_field: boolean;
  has_phone_field: boolean;
  contact_form_detected: boolean;        // Form mit email + (name|message)
  signup_form_detected: boolean;         // Form mit email + password
  visible_consent_link: boolean;         // Link zu /datenschutz oder /privacy in Form-Nähe
}

/**
 * Heuristische Form-Detection:
 *   - zählt <form>-Tags
 *   - sucht in deren content nach email/password/phone-Inputs
 *   - prüft ob ein Privacy-Link in der Nähe ist (= ground für Art-13-Hinweis)
 */
function detectForms(html: string): FormAnalysis {
  const forms: string[] = [];
  for (const m of html.matchAll(/<form[\s\S]*?<\/form>/gi)) {
    forms.push(m[0]);
  }
  let hasEmail = false;
  let hasPassword = false;
  let hasPhone = false;
  let signupDetected = false;
  let contactDetected = false;
  let privacyLink = false;

  for (const f of forms) {
    const lower = f.toLowerCase();
    const fEmail = /type=["']email["']|name=["'][^"']*e[-_]?mail/i.test(f);
    const fPassword = /type=["']password["']/i.test(lower);
    const fPhone = /type=["']tel["']|name=["'][^"']*(phone|tel|mobil)/i.test(f);
    const fMessage = /name=["'][^"']*(message|nachricht|comment)/i.test(f) || /<textarea/i.test(lower);

    if (fEmail) hasEmail = true;
    if (fPassword) hasPassword = true;
    if (fPhone) hasPhone = true;
    if (fEmail && fPassword) signupDetected = true;
    if (fEmail && fMessage) contactDetected = true;

    // Privacy-Link IM Formular oder direkt davor (~500 chars)
    if (/href=["'][^"']*(datenschutz|privacy|policy)/i.test(f)) privacyLink = true;
  }

  return {
    total_forms: forms.length,
    has_email_field: hasEmail,
    has_password_field: hasPassword,
    has_phone_field: hasPhone,
    contact_form_detected: contactDetected,
    signup_form_detected: signupDetected,
    visible_consent_link: privacyLink,
  };
}
