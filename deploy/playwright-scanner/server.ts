// Playwright Scanner Microservice — server.ts
// REST-API fuer DSGVO-Consent-Timing-Analysis, Website-Scan und den
// Governed Browser Executor (Sessions fuer browser-execute).
//
// Endpoints:
//   GET  /health                — Liveness + Capabilities (runtime, version, active_sessions)
//   POST /scan/full             — Vollstaendiger Scan (Cookies, Requests, Tracker, HTML)
//   POST /scan/consent-timing   — Consent-Timing: welche Tracker laden VOR Consent-Click?
//   POST /scan/screenshot       — Screenshot + HTML-Dump
//   POST /session/open          — Executor-Session anlegen/wiederverwenden { session_id }
//   POST /session/frame         — aktuelles Bild DERSELBEN Session (JPEG) { session_id }
//   POST /session/close         — Session schliessen { session_id }
//   POST /execute               — Aktionen in einer Session { session_id, actions, require_session, include_frame, expected_url }
//
// Auth: SCANNER_API_KEY Header (Basic-Auth via Traefik als erste Schicht)
// Port: 3001
// Deployment: docker-compose.yml hinter Traefik auf realsyncdynamicsai.de VPS
//
// Netzwerk: Chromium spricht nur über den Egress-Proxy (egress-proxy.ts), der
// jede Verbindung — auch Redirect-Hops — DNS-gepinnt gegen den HostGuard
// prüft; context.route() ist die zweite Schicht.

import { chromium, Browser, BrowserContext, Page, Request, Response } from 'playwright';
import * as http from 'http';
import { timingSafeEqual } from 'node:crypto';
import { EXECUTOR_CAPABILITIES, ExecutorError, SessionRegistry } from './executor.js';
import { assertNavigable, createHostGuard, parseAllowlist } from './netguard.js';
import { nodeResolver } from './node-resolver.js';
import { startEgressProxy } from './egress-proxy.js';

const PORT = parseInt(process.env.PORT ?? '3001', 10);
const API_KEY = process.env.SCANNER_API_KEY ?? '';
const MAX_CONCURRENT = parseInt(process.env.MAX_CONCURRENT ?? '3', 10);
const MAX_SESSIONS = parseInt(process.env.MAX_SESSIONS ?? '20', 10);
const DEFAULT_TIMEOUT = 30_000;
const MAX_BODY_BYTES = 1_000_000;
export const EXECUTOR_VERSION = '2026.10.1';
const STARTED_AT = Date.now();

if (!API_KEY) {
  console.error('[playwright-scanner] FATAL: SCANNER_API_KEY is required');
  process.exit(1);
}

// Nur ausdruecklich administrativ freigegebene private Hosts (z. B. lokale
// Integrationstests). Leer = keine Ausnahme.
const hostGuard = createHostGuard(parseAllowlist(process.env.EXECUTOR_PRIVATE_HOST_ALLOWLIST), nodeResolver);

// Nur Ereignisart, nie Ziele/URLs (können Eingaben enthalten).
const logEvent = (event: Record<string, unknown>): void => {
  console.log('[executor]', JSON.stringify(event));
};

const egress = await startEgressProxy(hostGuard, { log: logEvent });

// ─── Tracker-Patterns (synchronisiert mit cookie-scan/index.ts) ──────────────
const TRACKER_PATTERNS = [
  { id: 'google_analytics',  needles: ['googletagmanager.com/gtag', 'google-analytics.com'] },
  { id: 'meta_pixel',        needles: ['connect.facebook.net', 'fbq(', 'www.facebook.com/tr'] },
  { id: 'tiktok_pixel',      needles: ['analytics.tiktok.com'] },
  { id: 'linkedin_insight',  needles: ['snap.licdn.com/li.lms-analytics', 'px.ads.linkedin.com'] },
  { id: 'hotjar',            needles: ['static.hotjar.com', 'script.hotjar.com'] },
  { id: 'clarity',           needles: ['clarity.ms/tag'] },
  { id: 'google_tag_manager',needles: ['googletagmanager.com/gtm.js'] },
  { id: 'google_fonts',      needles: ['fonts.googleapis.com', 'fonts.gstatic.com'] },
  { id: 'youtube',           needles: ['youtube.com/embed', 'youtube-nocookie.com'] },
  { id: 'google_maps',       needles: ['maps.googleapis.com', 'maps.google.com'] },
];

const CONSENT_PATTERNS = [
  'cookiebot', 'usercentrics', 'borlabs', 'onetrust', 'cookieyes',
  'klaro', 'consentmanager', 'ccm19', 'didomi', 'sourcepoint', 'realsyncdynamics',
  'consent.js', 'cookie-consent',
];

// ─── Aktiver Scan-Zaehler (Rate-Limiter) ─────────────────────────────────────
let activeSans = 0;

// ─── Browser-Pool ─────────────────────────────────────────────────────────────
let browser: Browser | null = null;

async function getBrowser(): Promise<Browser> {
  if (!browser || !browser.isConnected()) {
    browser = await chromium.launch({
      headless: true,
      ...(process.env.EXECUTOR_CHROMIUM_PATH ? { executablePath: process.env.EXECUTOR_CHROMIUM_PATH } : {}),
      // Gesamter Browser-Verkehr über den Egress-Proxy. Playwright setzt dazu
      // <-loopback>: auch localhost/127.0.0.1 laufen durch den Proxy.
      proxy: { server: egress.url },
      args: [
        '--no-sandbox', '--disable-setuid-sandbox',
        '--disable-dev-shm-usage', '--disable-gpu',
        '--disable-extensions', '--disable-background-networking',
        '--disable-sync', '--no-first-run',
        // WebRTC/UDP am Proxy vorbei (STUN/ICE) unterbinden.
        '--force-webrtc-ip-handling-policy=disable_non_proxied_udp',
      ],
    });
    console.log('[playwright] browser launched');
  }
  return browser;
}

const registry = new SessionRegistry(getBrowser, hostGuard, MAX_SESSIONS, undefined, logEvent);
setInterval(() => { registry.prune().catch(() => undefined); }, 60_000).unref();

// Scan-Kontexte bekommen denselben Netzwerk-Schutz wie Executor-Sessions:
// keine Unterressourcen aus privaten Netzen / Metadaten-Endpunkten.
async function guardContext(ctx: BrowserContext): Promise<void> {
  await ctx.route('**/*', async (route) => {
    let u: URL;
    try { u = new URL(route.request().url()); } catch { await route.abort('blockedbyclient'); return; }
    if (u.protocol === 'data:' || u.protocol === 'blob:') { await route.continue(); return; }
    if ((u.protocol !== 'http:' && u.protocol !== 'https:') || !(await hostGuard.allows(u.hostname, u.port))) {
      await route.abort('blockedbyclient');
      return;
    }
    await route.continue();
  });
}

function apiKeyMatches(provided: string | undefined): boolean {
  if (typeof provided !== 'string') return false;
  const a = Buffer.from(provided);
  const b = Buffer.from(API_KEY);
  return a.length === b.length && timingSafeEqual(a, b);
}

// ─── Hilfsfunktionen ──────────────────────────────────────────────────────────
function extractTrackers(urls: string[]): string[] {
  const found: string[] = [];
  for (const t of TRACKER_PATTERNS) {
    if (t.needles.some(n => urls.some(u => u.includes(n)))) {
      found.push(t.id);
    }
  }
  return found;
}

function detectConsentManager(html: string): { detected: boolean; name: string|null } {
  for (const p of CONSENT_PATTERNS) {
    if (html.toLowerCase().includes(p)) {
      return { detected: true, name: p };
    }
  }
  return { detected: false, name: null };
}

// ─── Endpoint: /scan/full ─────────────────────────────────────────────────────
async function scanFull(url: string, timeout = DEFAULT_TIMEOUT) {
  const b = await getBrowser();
  const ctx: BrowserContext = await b.newContext({
    userAgent: 'RealSyncDynamics-Scanner/1.0 (DSGVO-Audit; +https://realsyncdynamicsai.de)',
    viewport: { width: 1280, height: 800 },
    ignoreHTTPSErrors: false,
  });
  await guardContext(ctx);

  const requestUrls: string[] = [];
  const responseCodes: Record<string, number> = {};
  const cookies: Array<{name:string;domain:string;httpOnly:boolean;secure:boolean;sameSite:string}> = [];
  let html = '';

  ctx.on('request', (req: Request) => requestUrls.push(req.url()));
  ctx.on('response', (resp: Response) => { responseCodes[resp.url()] = resp.status(); });

  const page: Page = await ctx.newPage();

  try {
    await page.goto(url, { waitUntil: 'networkidle', timeout });
    html = await page.content();

    const rawCookies = await ctx.cookies();
    for (const c of rawCookies) {
      cookies.push({
        name: c.name,
        domain: c.domain,
        httpOnly: c.httpOnly,
        secure: c.secure,
        sameSite: c.sameSite ?? 'None',
      });
    }
  } finally {
    await ctx.close();
  }

  const trackers = extractTrackers(requestUrls);
  const consentManager = detectConsentManager(html);
  const externalRequests = requestUrls.filter(u => {
    try { return new URL(u).hostname !== new URL(url).hostname; } catch { return false; }
  });
  const usRequests = externalRequests.filter(u =>
    /.com$|.net$|.io$|amazonaws.com|cloudfront.net/.test(new URL(u).hostname)
  );

  return {
    ok: true,
    url,
    scanned_at: new Date().toISOString(),
    html_length: html.length,
    request_count: requestUrls.length,
    external_request_count: externalRequests.length,
    potential_us_transfers: usRequests.length,
    cookies,
    cookie_count: cookies.length,
    trackers_detected: trackers,
    consent_manager: consentManager,
    top_external_domains: [...new Set(externalRequests.map(u => { try { return new URL(u).hostname; } catch { return 'unknown'; } }))].slice(0, 20),
    scanner_version: '2026.05.0',
  };
}

// ─── Endpoint: /scan/consent-timing ──────────────────────────────────────────
// Misst welche Tracker VOR dem Consent-Click laden (kritischstes Feature).
async function scanConsentTiming(url: string, timeout = DEFAULT_TIMEOUT) {
  const b = await getBrowser();
  const ctx: BrowserContext = await b.newContext({
    userAgent: 'RealSyncDynamics-ConsentTiming/1.0 (+https://realsyncdynamicsai.de)',
    viewport: { width: 1280, height: 800 },
  });
  await guardContext(ctx);

  const preConsentRequests: string[] = [];
  const postConsentRequests: string[] = [];
  let consentClickDone = false;
  let consentClickMs: number|null = null;
  const startTs = Date.now();

  ctx.on('request', (req: Request) => {
    if (!consentClickDone) {
      preConsentRequests.push(req.url());
    } else {
      postConsentRequests.push(req.url());
    }
  });

  const page: Page = await ctx.newPage();

  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout });

    // Warte kurz fuer Banner-Rendering
    await page.waitForTimeout(2000);
    const htmlBeforeConsent = await page.content();
    const consentMgr = detectConsentManager(htmlBeforeConsent);

    // Versuche Consent-Banner-Button zu finden und zu klicken
    const acceptSelectors = [
      // Borlabs
      '[data-borlabs-cookie-accept]', '#CookieBoxSaveButton',
      // OneTrust
      '#onetrust-accept-btn-handler',
      // Cookiebot
      '#CybotCookiebotDialogBodyLevelButtonAccept',
      // UserCentrics
      '[data-testid="uc-accept-all-button"]',
      // Generisch
      'button:has-text("Alle akzeptieren")',
      'button:has-text("Akzeptieren")',
      'button:has-text("Accept all")',
      'button:has-text("Accept All")',
      'button:has-text("Zustimmen")',
      '.cookie-consent-accept', '#cookie-accept', '.accept-cookies',
      '[class*="accept"][class*="cookie"]',
      '[id*="accept"][id*="cookie"]',
    ];

    let clicked = false;
    for (const sel of acceptSelectors) {
      try {
        const btn = await page.$(sel);
        if (btn && await btn.isVisible()) {
          await btn.click();
          consentClickDone = true;
          consentClickMs = Date.now() - startTs;
          clicked = true;
          console.log(`[consent-timing] clicked: ${sel} at ${consentClickMs}ms`);
          break;
        }
      } catch { /* ignore */ }
    }

    // Warte nach Consent-Click fuer nachlaufende Requests
    if (clicked) await page.waitForTimeout(3000);

    const preTrackers = extractTrackers(preConsentRequests);
    const postTrackers = extractTrackers(postConsentRequests);
    const violatingTrackers = preTrackers; // Alles vor Consent = Verstos

    return {
      ok: true,
      url,
      scanned_at: new Date().toISOString(),
      consent_manager: consentMgr,
      consent_button_found: clicked,
      consent_click_ms: consentClickMs,
      pre_consent: {
        request_count: preConsentRequests.length,
        trackers: preTrackers,
        external_domains: [...new Set(preConsentRequests.map(u => { try { return new URL(u).hostname; } catch { return 'unknown'; } }))].slice(0,15),
      },
      post_consent: {
        request_count: postConsentRequests.length,
        trackers: postTrackers,
      },
      violations: {
        trackers_before_consent: violatingTrackers,
        violation_count: violatingTrackers.length,
        compliant: violatingTrackers.length === 0,
        severity: violatingTrackers.length === 0 ? 'pass' : violatingTrackers.length >= 3 ? 'critical' : 'high',
      },
      scanner_version: '2026.05.0',
    };
  } finally {
    await ctx.close();
  }
}

// ─── Endpoint: /scan/screenshot ───────────────────────────────────────────────
async function scanScreenshot(url: string, timeout = DEFAULT_TIMEOUT) {
  const b = await getBrowser();
  const ctx: BrowserContext = await b.newContext({ viewport: { width: 1280, height: 800 } });
  await guardContext(ctx);
  const page: Page = await ctx.newPage();
  try {
    await page.goto(url, { waitUntil: 'networkidle', timeout });
    const screenshot = await page.screenshot({ fullPage: false, type: 'png' });
    const html = await page.content();
    return {
      ok: true, url,
      scanned_at: new Date().toISOString(),
      screenshot_base64: screenshot.toString('base64'),
      html_length: html.length,
      html_preview: html.slice(0, 2000),
    };
  } finally {
    await ctx.close();
  }
}

// ─── HTTP-Server ──────────────────────────────────────────────────────────────
function send(res: http.ServerResponse, status: number, body: unknown): void {
  res.writeHead(status);
  res.end(JSON.stringify(body));
}

function sendExecutorError(res: http.ServerResponse, err: unknown): void {
  if (err instanceof ExecutorError) {
    // extra stammt nur aus session-core (current_url bei PAGE_CHANGED,
    // blocked_origin bei LANDED_ON_BLOCKED_URL) — nie aus Fehlermeldungen.
    send(res, err.status, { ok: false, error: err.code, ...err.extra });
    return;
  }
  // Nur der Fehlertyp ins Log: Playwright-Meldungen können Eingaben enthalten.
  console.error('[executor] internal error:', err instanceof Error ? err.name : typeof err);
  send(res, 500, { ok: false, error: 'INTERNAL' });
}

const server = http.createServer(async (req, res) => {
  const path = new URL(req.url ?? '/', 'http://executor.local').pathname;
  const method = req.method ?? 'GET';

  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Access-Control-Allow-Origin', '*');

  // Auth — Pflicht fuer Health, Scans und Executor (konstante Vergleichszeit).
  const header = req.headers['x-api-key'] ?? req.headers['authorization']?.replace(/^Bearer\s+/i, '');
  const provided = Array.isArray(header) ? header[0] : header;
  if (!apiKeyMatches(provided)) {
    return send(res, 401, { ok: false, error: 'UNAUTHORIZED' });
  }

  if (path === '/health' && method === 'GET') {
    let browserConnected = false;
    let browserVersion: string | null = null;
    try {
      const b = await getBrowser();
      browserConnected = b.isConnected();
      browserVersion = b.version();
    } catch { /* browserConnected = false */ }
    return send(res, 200, {
      ok: true,
      status: browserConnected ? 'ok' : 'degraded',
      version: EXECUTOR_VERSION,
      runtime: 'playwright-chromium',
      browser_version: browserVersion,
      browser_connected: browserConnected,
      active_sessions: registry.activeSessions,
      max_sessions: MAX_SESSIONS,
      active_scans: activeSans,
      capabilities: EXECUTOR_CAPABILITIES,
      network_guard: { route_guard: true, egress_proxy: true, blocked_connections: egress.blockedCount() },
      uptime_seconds: Math.round((Date.now() - STARTED_AT) / 1000),
    });
  }

  if (method !== 'POST') {
    return send(res, 405, { ok: false, error: 'POST only' });
  }

  // Body lesen (gedeckelt)
  let tooLarge = false;
  const body = await new Promise<string>((resolve, reject) => {
    let data = '';
    req.on('data', (chunk) => {
      data += chunk;
      if (data.length > MAX_BODY_BYTES) { tooLarge = true; req.destroy(); }
    });
    req.on('end', () => resolve(data));
    req.on('error', (e) => (tooLarge ? resolve('') : reject(e)));
  }).catch(() => '');
  if (tooLarge) return send(res, 413, { ok: false, error: 'BODY_TOO_LARGE' });

  let parsed: unknown;
  try { parsed = JSON.parse(body); } catch {
    return send(res, 400, { ok: false, error: 'INVALID_JSON' });
  }
  const sessionId = (parsed as { session_id?: unknown })?.session_id;

  if (path === '/session/open') {
    try {
      if (typeof sessionId !== 'string') throw new ExecutorError('INVALID_SESSION');
      const state = await registry.open(sessionId);
      let page = null;
      let frame = null;
      try {
        ({ page, frame } = await state.run(() => state.frame()));
      } catch (err) {
        // Kein Bild ist kein Fehler beim Öffnen; eine verlorene Session schon.
        if (err instanceof ExecutorError && err.code === 'SESSION_NOT_FOUND') throw err;
        page = await state.run(() => state.pageInfo());
      }
      return send(res, 200, { ok: true, session_id: sessionId, version: EXECUTOR_VERSION, page, frame });
    } catch (err) {
      return sendExecutorError(res, err);
    }
  }

  if (path === '/session/frame') {
    try {
      if (typeof sessionId !== 'string') throw new ExecutorError('INVALID_SESSION');
      const state = registry.get(sessionId);
      const out = await state.run(() => state.frame());
      return send(res, 200, { ok: true, session_id: sessionId, ...out });
    } catch (err) {
      return sendExecutorError(res, err);
    }
  }

  if (path === '/session/close') {
    if (typeof sessionId !== 'string') return send(res, 400, { ok: false, error: 'INVALID_SESSION' });
    const closed = await registry.close(sessionId);
    return send(res, closed ? 200 : 404, closed ? { ok: true, closed: true } : { ok: false, error: 'SESSION_NOT_FOUND' });
  }

  if (path === '/execute') {
    try {
      const out = await registry.execute(parsed);
      return send(res, 200, { ok: true, session_id: sessionId, ...out });
    } catch (err) {
      return sendExecutorError(res, err);
    }
  }

  const scanBody = parsed as { url?: string; timeout?: number };
  const targetUrl = (scanBody.url ?? '').trim();
  if (!targetUrl || !/^https?:\/\//.test(targetUrl)) {
    res.writeHead(400);
    return res.end(JSON.stringify({ ok: false, error: 'INVALID_URL' }));
  }
  try {
    await assertNavigable(targetUrl, hostGuard);
  } catch (err) {
    const code = err instanceof Error ? err.message : String(err);
    res.writeHead(code === 'PRIVATE_NETWORK_BLOCKED' ? 403 : 400);
    return res.end(JSON.stringify({ ok: false, error: code }));
  }

  if (activeSans >= MAX_CONCURRENT) {
    res.writeHead(429);
    return res.end(JSON.stringify({ ok: false, error: 'TOO_MANY_CONCURRENT_SCANS', active: activeSans }));
  }

  activeSans++;
  const timeout = Math.min(scanBody.timeout ?? DEFAULT_TIMEOUT, 60_000);

  try {
    let result: unknown;
    if (path === '/scan/full') {
      result = await scanFull(targetUrl, timeout);
    } else if (path === '/scan/consent-timing') {
      result = await scanConsentTiming(targetUrl, timeout);
    } else if (path === '/scan/screenshot') {
      result = await scanScreenshot(targetUrl, timeout);
    } else {
      res.writeHead(404);
      return res.end(JSON.stringify({ ok: false, error: 'NOT_FOUND', available: ['/health', '/scan/full', '/scan/consent-timing', '/scan/screenshot', '/session/open', '/session/frame', '/session/close', '/execute'] }));
    }
    res.writeHead(200);
    res.end(JSON.stringify(result));
  } catch (err) {
    console.error('[scanner] error:', err);
    res.writeHead(500);
    res.end(JSON.stringify({ ok: false, error: 'SCAN_FAILED', detail: (err as Error).message }));
  } finally {
    activeSans--;
  }
});

server.listen(PORT, () => {
  console.log(`[playwright-scanner] Listening on port ${PORT}`);
  console.log(`[playwright-scanner] MAX_CONCURRENT=${MAX_CONCURRENT}`);
  console.log('[playwright-scanner] API_KEY=***set***');
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('[playwright-scanner] SIGTERM received, shutting down...');
  await registry.closeAll().catch(() => undefined);
  if (browser) await browser.close();
  await egress.close().catch(() => undefined);
  server.close(() => process.exit(0));
});
