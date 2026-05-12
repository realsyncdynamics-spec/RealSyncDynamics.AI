// Playwright-Scanner-Logik — headless Chromium fährt Customer-URL an, sammelt
// Cookies, localStorage, sessionStorage, Network-Requests, Forms, Trackers.
//
// Tracker-Patterns sind synchronisiert mit
// supabase/functions/cookie-scan/index.ts und
// supabase/functions/_shared/rules/tracker-registry.json. Bei Updates dort
// bitte hier nachziehen — siehe rules/CHANGELOG.md.

import { chromium, type Browser, type BrowserContext, type Cookie as PlaywrightCookie } from 'playwright';
import type {
  Cookie,
  FormAnalysis,
  FormDescriptor,
  PrivacyAnalytics,
  ScanMeta,
  ScanResult,
  Severity,
  Tracker,
  TrackerCategory,
} from './types.js';

const SCANNER_VERSION = '1.0.0';
const DEFAULT_TIMEOUT = 30_000;
const MAX_TIMEOUT = 60_000;
const STORAGE_VALUE_PREVIEW_MAX = 200;
const SCRIPT_REPORT_LIMIT = 30;

// ─── Tracker-Patterns (synced mit cookie-scan Edge Function) ─────────────────
interface TrackerPattern {
  id: string;
  name: string;
  category: TrackerCategory;
  needles: string[];
}

const TRACKER_PATTERNS: TrackerPattern[] = [
  // Analytics
  { id: 'google_analytics', name: 'Google Analytics (GA4)', category: 'analytics', needles: ['googletagmanager.com/gtag/js', 'google-analytics.com/analytics.js', 'googletagmanager.com/gtm.js'] },
  { id: 'matomo',           name: 'Matomo',                 category: 'analytics', needles: ['matomo.js', 'piwik.js'] },
  { id: 'mixpanel',         name: 'Mixpanel',               category: 'analytics', needles: ['cdn.mxpnl.com', 'api.mixpanel.com'] },
  { id: 'amplitude',        name: 'Amplitude',              category: 'analytics', needles: ['cdn.amplitude.com', 'api.amplitude.com'] },
  { id: 'segment',          name: 'Segment',                category: 'analytics', needles: ['cdn.segment.com/analytics.js', 'api.segment.io'] },
  { id: 'posthog',          name: 'PostHog',                category: 'analytics', needles: ['app.posthog.com', 'eu.posthog.com', '/posthog.js'] },
  // Advertising
  { id: 'meta_pixel',       name: 'Meta / Facebook Pixel',  category: 'advertising', needles: ['connect.facebook.net/en_US/fbevents.js', 'connect.facebook.net'] },
  { id: 'linkedin_insight', name: 'LinkedIn Insight Tag',   category: 'advertising', needles: ['snap.licdn.com/li.lms-analytics', 'px.ads.linkedin.com'] },
  { id: 'tiktok_pixel',     name: 'TikTok Pixel',           category: 'advertising', needles: ['analytics.tiktok.com'] },
  { id: 'pinterest_tag',    name: 'Pinterest Tag',          category: 'advertising', needles: ['s.pinimg.com/ct/core.js'] },
  { id: 'twitter_pixel',    name: 'Twitter / X Pixel',      category: 'advertising', needles: ['static.ads-twitter.com/uwt.js'] },
  { id: 'snapchat_pixel',   name: 'Snapchat Pixel',         category: 'advertising', needles: ['sc-static.net/scevent.min.js'] },
  { id: 'reddit_pixel',     name: 'Reddit Pixel',           category: 'advertising', needles: ['www.redditstatic.com/ads/pixel.js'] },
  // UX
  { id: 'hotjar',           name: 'Hotjar',                 category: 'ux',          needles: ['static.hotjar.com', 'hotjar-'] },
  { id: 'clarity',          name: 'Microsoft Clarity',      category: 'ux',          needles: ['clarity.ms/tag'] },
  { id: 'fullstory',        name: 'FullStory',              category: 'ux',          needles: ['edge.fullstory.com/s/fs.js'] },
  { id: 'mouseflow',        name: 'Mouseflow',              category: 'ux',          needles: ['cdn.mouseflow.com'] },
  { id: 'smartlook',        name: 'Smartlook',              category: 'ux',          needles: ['rec.smartlook.com'] },
];

const PRIVACY_ANALYTICS_PATTERNS: Array<{ id: string; name: string; needles: string[] }> = [
  { id: 'plausible',        name: 'Plausible (privacy-friendly)',        needles: ['plausible.io/js/'] },
  { id: 'fathom',           name: 'Fathom Analytics (privacy-friendly)', needles: ['cdn.usefathom.com/script.js'] },
  { id: 'simple_analytics', name: 'Simple Analytics (privacy-friendly)', needles: ['scripts.simpleanalyticscdn.com'] },
  { id: 'umami',            name: 'Umami (privacy-friendly)',            needles: ['umami.is/script.js', '/umami.js'] },
];

const CONSENT_PATTERNS: string[] = [
  'cookiebot.com', 'usercentrics.eu', 'borlabs-cookie', 'klaro', 'onetrust.com',
  'cookieyes.com', 'real-cookie-banner', 'iubenda.com', 'consentmanager.net',
  'ccm19', 'cookie-information.com', 'cookielaw.org', 'didomi.io', 'trustarc.com',
  'sourcepoint', 'osano.com',
];

const ESSENTIAL_COOKIE_NAMES = new Set([
  'sessionid', 'csrf', 'csrftoken', 'xsrf-token', 'phpsessid', 'jsessionid',
  'connect.sid', 'next-auth.csrf-token', 'cf_clearance', 'cf-bm', '__cf_bm',
  '__host-next-auth.csrf-token', 'auth_session', 'authjs.session-token',
  '__stripe_mid', '__stripe_sid', '__hssrc',
]);

const TRACKING_COOKIE_PATTERNS: RegExp[] = [
  /^_ga/, /^_gid/, /^_gat/, /^_fbp/, /^_fbc/, /^_li_/, /^bcookie/, /^lidc/,
  /^_tt_/, /^ttp/, /^_pinterest_/, /^_pin_unauth/, /^personalization_id/,
  /^muc_ads/, /^_scid/, /^sc_at/, /^_rdt_/, /^_hj/, /^_clck/, /^_clsk/,
  /^MR/, /^MUID/, /^_pk_/, /^mp_/, /^amplitude_/, /^AMP_/, /^_cfduid/,
  /^IDE$/, /^DSID$/, /^id$/, /^FLC$/, /^uetsid/, /^uetvid/, /^_uetsid/,
  /^_uetvid/, /^crto_/, /^cto_/, /^obuid/, /^t_gid/,
];

// ─── Browser-Pool ────────────────────────────────────────────────────────────
let browserSingleton: Browser | null = null;

export async function getBrowser(): Promise<Browser> {
  if (browserSingleton && browserSingleton.isConnected()) return browserSingleton;
  browserSingleton = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
  });
  return browserSingleton;
}

export async function closeBrowser(): Promise<void> {
  if (browserSingleton) {
    await browserSingleton.close().catch(() => { /* ignore */ });
    browserSingleton = null;
  }
}

// ─── Public Scan-Funktion ────────────────────────────────────────────────────
export interface ScanOptions {
  timeout?: number;
  waitFor?: string;
  user_agent?: string;
}

export async function scan(targetUrl: string, options: ScanOptions = {}): Promise<ScanResult> {
  const startedAt = Date.now();
  const timeout = clampTimeout(options.timeout);
  const userAgent = options.user_agent ?? `RealSync-PlaywrightScanner/${SCANNER_VERSION} (+https://realsyncdynamicsai.de/cookie-scanner)`;

  let parsedUrl: URL;
  try { parsedUrl = new URL(targetUrl); }
  catch { throw new ScanFailure('INVALID_URL', `Cannot parse URL: ${targetUrl}`); }

  const siteDomain = parsedUrl.hostname.toLowerCase();

  const browser = await getBrowser();
  const context: BrowserContext = await browser.newContext({
    userAgent,
    viewport: { width: 1366, height: 900 },
    locale: 'de-DE',
    timezoneId: 'Europe/Berlin',
    ignoreHTTPSErrors: true,
  });

  const requestUrls: string[] = [];
  const redirectChain: string[] = [];
  let mainResponseStatus: number | null = null;
  let fetchError: string | null = null;

  context.on('request', (req) => {
    requestUrls.push(req.url());
  });

  const page = await context.newPage();

  try {
    const response = await page.goto(targetUrl, {
      waitUntil: 'domcontentloaded',
      timeout,
    }).catch((err) => {
      fetchError = err instanceof Error ? err.message : String(err);
      return null;
    });

    mainResponseStatus = response?.status() ?? null;

    // Redirect-Chain rekonstruieren
    let r = response?.request();
    while (r) {
      redirectChain.unshift(r.url());
      const prev = r.redirectedFrom();
      if (!prev) break;
      r = prev;
    }

    // Optional: auf spezifischen Selector warten
    if (options.waitFor && !fetchError) {
      await page.waitForSelector(options.waitFor, { timeout: Math.min(5000, timeout) }).catch(() => { /* tolerant */ });
    }

    // Network-idle: gib der Site noch ~2s um lazy-loaded Tracker zu starten
    await page.waitForLoadState('networkidle', { timeout: 5000 }).catch(() => { /* tolerant */ });

    const html = await page.content().catch(() => '');
    const cookies = await context.cookies().catch<PlaywrightCookie[]>(() => []);
    const localStorage = await page.evaluate(() => {
      const out: Record<string, string> = {};
      for (let i = 0; i < window.localStorage.length; i++) {
        const k = window.localStorage.key(i);
        if (k !== null) {
          const v = window.localStorage.getItem(k) ?? '';
          out[k] = v;
        }
      }
      return out;
    }).catch<Record<string, string>>(() => ({}));

    const sessionStorage = await page.evaluate(() => {
      const out: Record<string, string> = {};
      for (let i = 0; i < window.sessionStorage.length; i++) {
        const k = window.sessionStorage.key(i);
        if (k !== null) {
          const v = window.sessionStorage.getItem(k) ?? '';
          out[k] = v;
        }
      }
      return out;
    }).catch<Record<string, string>>(() => ({}));

    const formAnalysis = detectForms(html);
    const trackers = detectTrackers(html, requestUrls);
    const privacyAnalytics = detectPrivacyAnalytics(html);
    const consentManagerDetected = CONSENT_PATTERNS.some((p) => html.includes(p));
    const cookiesNormalized = cookies.map((c) => normalizeCookie(c, siteDomain));
    const thirdPartyHosts = extractThirdPartyHosts(requestUrls, siteDomain);
    const unknownScripts = extractUnknownThirdPartyScripts(html, requestUrls, siteDomain, trackers);

    const { score, severity, summary } = scoreScan({
      cookies: cookiesNormalized,
      trackers,
      consentManager: consentManagerDetected,
      formAnalysis,
    });

    const meta: ScanMeta = {
      url: targetUrl,
      domain: siteDomain,
      fetched_status: mainResponseStatus,
      scanned_at: new Date().toISOString(),
      user_agent: userAgent,
      duration_ms: Date.now() - startedAt,
      redirect_chain: redirectChain,
      fetch_error: fetchError,
      scanner_version: SCANNER_VERSION,
    };

    return {
      ok: true,
      meta,
      cookies: cookiesNormalized,
      trackers,
      privacy_analytics: privacyAnalytics,
      consent_manager_detected: consentManagerDetected,
      forms: formAnalysis,
      local_storage: previewMap(localStorage),
      session_storage: previewMap(sessionStorage),
      network_requests_count: requestUrls.length,
      third_party_hosts: thirdPartyHosts,
      unknown_third_party_scripts: unknownScripts,
      score,
      severity,
      summary,
    };
  } finally {
    await context.close().catch(() => { /* ignore */ });
  }
}

// ─── Detection Helpers ───────────────────────────────────────────────────────

function detectTrackers(html: string, requests: string[]): Tracker[] {
  const out: Tracker[] = [];
  const seen = new Set<string>();
  for (const t of TRACKER_PATTERNS) {
    let hit: string | undefined;
    // 1) HTML-Match
    hit = t.needles.find((n) => html.includes(n));
    // 2) Network-Request-Match
    if (!hit) {
      const req = requests.find((u) => t.needles.some((n) => u.includes(n)));
      hit = req ? (t.needles.find((n) => req.includes(n)) ?? req) : undefined;
    }
    if (hit && !seen.has(t.id)) {
      seen.add(t.id);
      out.push({
        id: t.id,
        name: t.name,
        category: t.category,
        pattern_matched: hit,
        consent_compliant: false,
        loaded_before_consent: true,        // headless ohne Consent-Click → alle vor Consent
      });
    }
  }
  return out;
}

function detectPrivacyAnalytics(html: string): PrivacyAnalytics[] {
  const out: PrivacyAnalytics[] = [];
  for (const p of PRIVACY_ANALYTICS_PATTERNS) {
    const hit = p.needles.find((n) => html.includes(n));
    if (hit) out.push({ id: p.id, name: p.name, pattern_matched: hit });
  }
  return out;
}

export function detectForms(html: string): FormAnalysis {
  const formMatches: string[] = [];
  for (const m of html.matchAll(/<form\b[\s\S]*?<\/form>/gi)) {
    formMatches.push(m[0]);
  }

  const forms: FormDescriptor[] = [];
  let hasEmail = false, hasPassword = false, hasPhone = false;
  let signupDetected = false, contactDetected = false, anyConsentLink = false;

  for (const f of formMatches) {
    const lower = f.toLowerCase();
    const actionMatch = /<form[^>]+action=["']([^"']+)["']/i.exec(f);
    const methodMatch = /<form[^>]+method=["']([^"']+)["']/i.exec(f);
    const fEmail = /type=["']email["']|name=["'][^"']*e[-_]?mail/i.test(f);
    const fPassword = /type=["']password["']/i.test(lower);
    const fPhone = /type=["']tel["']|name=["'][^"']*(phone|tel|mobil)/i.test(f);
    const fTextarea = /<textarea/i.test(lower);
    const fMessage = fTextarea || /name=["'][^"']*(message|nachricht|comment)/i.test(f);
    const fConsentLink = /href=["'][^"']*(datenschutz|privacy|policy)/i.test(f);

    const inputs: FormDescriptor['inputs'] = [];
    for (const im of f.matchAll(/<input\b[^>]*>/gi)) {
      const tag = im[0];
      const nameM = /name=["']([^"']+)["']/i.exec(tag);
      const typeM = /type=["']([^"']+)["']/i.exec(tag);
      inputs.push({
        name: nameM?.[1] ?? null,
        type: typeM?.[1] ?? 'text',
      });
    }

    forms.push({
      action: actionMatch?.[1] ?? null,
      method: (methodMatch?.[1] ?? 'GET').toUpperCase(),
      has_email_field: fEmail,
      has_password_field: fPassword,
      has_phone_field: fPhone,
      has_textarea: fTextarea,
      has_visible_consent_link: fConsentLink,
      inputs,
    });

    if (fEmail) hasEmail = true;
    if (fPassword) hasPassword = true;
    if (fPhone) hasPhone = true;
    if (fEmail && fPassword) signupDetected = true;
    if (fEmail && fMessage) contactDetected = true;
    if (fConsentLink) anyConsentLink = true;
  }

  return {
    total_forms: forms.length,
    has_email_field: hasEmail,
    has_password_field: hasPassword,
    has_phone_field: hasPhone,
    contact_form_detected: contactDetected,
    signup_form_detected: signupDetected,
    visible_consent_link: anyConsentLink,
    forms,
  };
}

function normalizeCookie(c: PlaywrightCookie, siteDomain: string): Cookie {
  const cookieDomain = c.domain.replace(/^\./, '');
  const isThirdParty = !siteDomain.endsWith(cookieDomain) && !cookieDomain.endsWith(siteDomain);

  const lc = c.name.toLowerCase();
  let category: Cookie['category'] = 'unknown';
  if (ESSENTIAL_COOKIE_NAMES.has(lc)) category = 'essential';
  else if (TRACKING_COOKIE_PATTERNS.some((re) => re.test(c.name))) category = 'tracking';

  return {
    name: c.name,
    value_preview: maskCookieValue(c.value),
    domain: c.domain,
    path: c.path,
    expires: c.expires > 0 ? new Date(c.expires * 1000).toISOString() : null,
    http_only: c.httpOnly,
    secure: c.secure,
    same_site: c.sameSite,
    category,
    third_party: isThirdParty,
    set_before_consent: true,
  };
}

function maskCookieValue(v: string): string {
  if (v.length <= 8) return v;
  return v.slice(0, 8) + '…';
}

function previewMap(map: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(map)) {
    out[k] = v.length > STORAGE_VALUE_PREVIEW_MAX ? v.slice(0, STORAGE_VALUE_PREVIEW_MAX) + '…' : v;
  }
  return out;
}

function extractThirdPartyHosts(requests: string[], siteDomain: string): string[] {
  const siteApex = siteDomain.replace(/^www\./, '');
  const hosts = new Set<string>();
  for (const u of requests) {
    try {
      const h = new URL(u).hostname.toLowerCase();
      const apex = h.replace(/^www\./, '');
      if (apex !== siteApex && !apex.endsWith('.' + siteApex)) hosts.add(h);
    } catch { /* skip */ }
  }
  return [...hosts].sort();
}

function extractUnknownThirdPartyScripts(
  html: string,
  requests: string[],
  siteDomain: string,
  knownTrackers: Tracker[],
): Array<{ host: string; sample_url: string }> {
  const matched = knownTrackers.map((t) => t.pattern_matched.toLowerCase());
  const siteApex = siteDomain.replace(/^www\./, '');

  const candidates = new Map<string, string>();

  // Aus HTML-Tags
  for (const m of html.matchAll(/<script[^>]+src=["']([^"']+)["']/gi)) {
    const src = m[1];
    if (!src) continue;
    addCandidate(candidates, src);
  }

  // Aus Network-Requests (sieht auch dynamisch geladene)
  for (const u of requests) {
    if (u.endsWith('.js') || u.includes('.js?')) addCandidate(candidates, u);
  }

  const out: Array<{ host: string; sample_url: string }> = [];
  for (const [host, sampleUrl] of candidates.entries()) {
    const apex = host.replace(/^www\./, '');
    if (apex === siteApex || apex.endsWith('.' + siteApex)) continue;
    if (matched.some((n) => sampleUrl.toLowerCase().includes(n))) continue;
    out.push({ host, sample_url: sampleUrl.slice(0, 500) });
    if (out.length >= SCRIPT_REPORT_LIMIT) break;
  }
  return out;
}

function addCandidate(map: Map<string, string>, src: string): void {
  try {
    if (!/^https?:/.test(src) && !src.startsWith('//')) return;
    const fullUrl = src.startsWith('//') ? `https:${src}` : src;
    const host = new URL(fullUrl).hostname.toLowerCase();
    if (!map.has(host)) map.set(host, fullUrl);
  } catch { /* skip */ }
}

interface ScoreInput {
  cookies: Cookie[];
  trackers: Tracker[];
  consentManager: boolean;
  formAnalysis: FormAnalysis;
}

function scoreScan(input: ScoreInput): { score: number; severity: Severity; summary: string } {
  let score = 100;
  const trackingCookies = input.cookies.filter((c) => c.category === 'tracking').length;
  const thirdPartyCookies = input.cookies.filter((c) => c.third_party).length;
  const trackerCount = input.trackers.length;

  score -= trackingCookies * 8;
  score -= thirdPartyCookies * 4;
  score -= trackerCount * 10;
  if (!input.consentManager && trackerCount > 0) score -= 15;
  if (input.formAnalysis.has_email_field && !input.formAnalysis.visible_consent_link) score -= 5;

  score = Math.max(0, Math.min(100, score));

  let severity: Severity;
  if (score >= 90) severity = 'pass';
  else if (score >= 70) severity = 'low';
  else if (score >= 50) severity = 'medium';
  else if (score >= 30) severity = 'high';
  else severity = 'critical';

  const parts: string[] = [];
  parts.push(`${input.cookies.length} Cookie${input.cookies.length === 1 ? '' : 's'} ohne Consent`);
  if (trackerCount > 0) parts.push(`${trackerCount} Tracker erkannt`);
  if (input.consentManager) parts.push('Consent-Manager vorhanden — Pre-Consent-Loading manuell verifizieren');
  else if (trackerCount > 0) parts.push('Kein Consent-Manager');

  return { score, severity, summary: parts.join(' · ') };
}

function clampTimeout(t?: number): number {
  if (typeof t !== 'number' || !Number.isFinite(t) || t <= 0) return DEFAULT_TIMEOUT;
  return Math.min(t, MAX_TIMEOUT);
}

// ─── Strukturierte Fehler ────────────────────────────────────────────────────
export class ScanFailure extends Error {
  public readonly code: string;
  public readonly details?: Record<string, unknown>;
  constructor(code: string, message: string, details?: Record<string, unknown>) {
    super(message);
    this.name = 'ScanFailure';
    this.code = code;
    if (details !== undefined) this.details = details;
  }
}
