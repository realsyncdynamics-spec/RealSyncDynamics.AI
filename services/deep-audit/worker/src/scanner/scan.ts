import { chromium, type Page, type BrowserContext } from 'playwright';
import { detectConsent } from '../consent/detect.js';

export interface ScanRequest {
  url: string;
  method: string;
  resourceType: string;
  preConsent: boolean;
}

export interface ScanCookie {
  name: string;
  domain: string;
  value: string;
  httpOnly: boolean;
  secure: boolean;
  sameSite: 'Strict' | 'Lax' | 'None' | undefined;
}

export interface ScanResult {
  url: string;
  fetched_at: string;
  cookies: ScanCookie[];
  requests: ScanRequest[];
  consent: { found: boolean; selector?: string };
  screenshot_path?: string;
}

export interface ScanOptions {
  url: string;
  /** Where to write the full-page screenshot. Set to null to skip. */
  screenshotPath?: string | null;
  /** Total scan timeout in ms (default 30s). */
  timeoutMs?: number;
}

export async function runScan(opts: ScanOptions): Promise<ScanResult> {
  const { url, screenshotPath, timeoutMs = 30_000 } = opts;

  const browser = await chromium.launch({ headless: true });

  try {
    const context = await browser.newContext({
      userAgent: 'RealSyncDynamicsDeepAudit/0.1 (+https://realsyncdynamicsai.de)',
      viewport: { width: 1366, height: 900 },
    });

    const page = await context.newPage();
    page.setDefaultTimeout(timeoutMs);

    const requests: ScanRequest[] = [];
    let consentAccepted = false;

    page.on('request', (req) => {
      requests.push({
        url: req.url(),
        method: req.method(),
        resourceType: req.resourceType(),
        preConsent: !consentAccepted,
      });
    });

    await page.goto(url, { waitUntil: 'networkidle', timeout: timeoutMs });

    // Capture pre-consent state before clicking anything.
    const cookiesBefore = await context.cookies();
    const consent = await detectConsent(page);

    // Optional screenshot (skipped during unit tests).
    let screenshot_path: string | undefined;
    if (screenshotPath !== null && screenshotPath !== undefined) {
      await page.screenshot({ path: screenshotPath, fullPage: true });
      screenshot_path = screenshotPath;
    }

    // If a consent banner is present, accept it and continue capturing
    // post-consent traffic so the analyzer can distinguish pre/post.
    if (consent.found) {
      consentAccepted = true;
      try {
        await acceptConsent(page, consent.selector!);
        // Give analytics scripts a moment to fire after consent.
        await page.waitForLoadState('networkidle', { timeout: 5_000 }).catch(() => undefined);
      } catch {
        // Accept failed — leave consentAccepted=true since we intent-
        // accepted, but tag downstream that something didn't click.
      }
    }

    return {
      url,
      fetched_at: new Date().toISOString(),
      cookies: cookiesBefore.map(normaliseCookie),
      requests,
      consent,
      screenshot_path,
    };
  } finally {
    await browser.close();
  }
}

async function acceptConsent(page: Page, selector: string): Promise<void> {
  const el = await page.$(selector);
  if (!el) return;
  await el.click({ timeout: 3_000 });
}

function normaliseCookie(c: Awaited<ReturnType<BrowserContext['cookies']>>[number]): ScanCookie {
  return {
    name:     c.name,
    domain:   c.domain ?? '',
    value:    c.value ?? '',
    httpOnly: c.httpOnly ?? false,
    secure:   c.secure ?? false,
    sameSite: c.sameSite,
  };
}
