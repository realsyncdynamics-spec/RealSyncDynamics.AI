// Playwright Scanner Microservice — server.ts
// REST-API fuer DSGVO-Consent-Timing-Analysis + vollstaendigen Website-Scan
//
// Endpoints:
//   GET  /health                — Liveness-Check
//   POST /scan/full             — Vollstaendiger Scan (Cookies, Requests, Tracker, HTML)
//   POST /scan/consent-timing   — Consent-Timing: welche Tracker laden VOR Consent-Click?
//   POST /scan/screenshot       — Screenshot + HTML-Dump
//
// Auth: SCANNER_API_KEY Header (Basic-Auth via Traefik als erste Schicht)
// Port: 3001
// Deployment: docker-compose.yml hinter Traefik auf realsyncdynamicsai.de VPS

import { chromium, Browser, BrowserContext, Page, Request, Response } from 'playwright';
import * as http from 'http';

const PORT = parseInt(process.env.PORT ?? '3001', 10);
const API_KEY = process.env.SCANNER_API_KEY ?? '';
const MAX_CONCURRENT = parseInt(process.env.MAX_CONCURRENT ?? '3', 10);
const DEFAULT_TIMEOUT = 30_000;

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
      args: [
        '--no-sandbox', '--disable-setuid-sandbox',
        '--disable-dev-shm-usage', '--disable-gpu',
        '--disable-extensions', '--disable-background-networking',
        '--disable-sync', '--no-first-run',
      ],
    });
    console.log('[playwright] browser launched');
  }
  return browser;
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
const server = http.createServer(async (req, res) => {
  const url = req.url ?? '/';
  const method = req.method ?? 'GET';

  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Access-Control-Allow-Origin', '*');

  // Auth-Check
  if (API_KEY) {
    const provided = req.headers['x-api-key'] ?? req.headers['authorization']?.replace('Bearer ', '');
    if (provided !== API_KEY) {
      res.writeHead(401);
      return res.end(JSON.stringify({ ok: false, error: 'UNAUTHORIZED' }));
    }
  }

  if (url === '/health' && method === 'GET') {
    res.writeHead(200);
    return res.end(JSON.stringify({ ok: true, version: '2026.05.0', active_scans: activeSans }));
  }

  if (method !== 'POST') {
    res.writeHead(405);
    return res.end(JSON.stringify({ ok: false, error: 'POST only' }));
  }

  // Body lesen
  const body = await new Promise<string>((resolve, reject) => {
    let data = '';
    req.on('data', (chunk) => { data += chunk; });
    req.on('end', () => resolve(data));
    req.on('error', reject);
  });

  let parsed: { url?: string; timeout?: number };
  try { parsed = JSON.parse(body); } catch {
    res.writeHead(400);
    return res.end(JSON.stringify({ ok: false, error: 'INVALID_JSON' }));
  }

  const targetUrl = (parsed.url ?? '').trim();
  if (!targetUrl || !/^https?:\/\//.test(targetUrl)) {
    res.writeHead(400);
    return res.end(JSON.stringify({ ok: false, error: 'INVALID_URL' }));
  }

  if (activeSans >= MAX_CONCURRENT) {
    res.writeHead(429);
    return res.end(JSON.stringify({ ok: false, error: 'TOO_MANY_CONCURRENT_SCANS', active: activeSans }));
  }

  activeSans++;
  const timeout = Math.min(parsed.timeout ?? DEFAULT_TIMEOUT, 60_000);

  try {
    let result: unknown;
    if (url === '/scan/full') {
      result = await scanFull(targetUrl, timeout);
    } else if (url === '/scan/consent-timing') {
      result = await scanConsentTiming(targetUrl, timeout);
    } else if (url === '/scan/screenshot') {
      result = await scanScreenshot(targetUrl, timeout);
    } else {
      res.writeHead(404);
      return res.end(JSON.stringify({ ok: false, error: 'NOT_FOUND', available: ['/health', '/scan/full', '/scan/consent-timing', '/scan/screenshot'] }));
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
  console.log(`[playwright-scanner] API_KEY=${API_KEY ? '***set***' : 'NOT SET — insecure!'}`);
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('[playwright-scanner] SIGTERM received, shutting down...');
  if (browser) await browser.close();
  server.close(() => process.exit(0));
});
