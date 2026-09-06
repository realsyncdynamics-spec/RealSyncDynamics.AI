// Beobachtung des ausgelieferten Browser-Zustands für Browser Agent X07.
//
// Modell: Artifact „Organisationsmodell für ein hierarchisches Multi-Agent-System"
// v0.2, §02. X07 beobachtet und meldet — er behebt nichts.
//
// ── Warum das hier steht und nicht in einer Edge Function ───────────────────
//
// §09 des Modells nennt eine „Edge Function browser-agent-x07, Playwright-basiert".
// Das geht nicht: Supabase Edge Functions laufen in einem Deno-Isolat ohne
// Browser-Binary. Das etablierte Muster dieses Repos ist deshalb ein anderes und
// wird hier fortgeführt — die Edge Function ruft diesen Dienst über HTTP auf,
// genau wie `cookie-scan-deep` und `audit-monitor-cron` es schon tun
// (`PLAYWRIGHT_SCANNER_URL`). Chromium läuft im Container, nicht im Isolat.
//
// ── Was hier bewusst NICHT gemessen wird ────────────────────────────────────
//
// **Lighthouse.** §02 des Modells nennt es in der Zuständigkeit von X07, aber
// Lighthouse ist in diesem Dienst weder installiert noch Dependency (geprüft:
// `services/playwright-scanner/package.json` führt nur playwright und hono).
// Ein „Performance-Score" aus eigener Rechnung wäre keine Lighthouse-Zahl und
// mit den historischen Werten nicht vergleichbar — genau die Art Zahl, die
// aussieht wie eine Zusage. Stattdessen liefert `timings` die echten Werte der
// Navigation-Timing-API. Wer Lighthouse will, entscheidet die Dependency.
//
// Ebenfalls nicht enthalten: Accessibility-Prüfung (bräuchte axe-core) und
// WebMCP. Beides steht in §02, beides ist heute nicht gebaut.

import type { Browser, BrowserContext, ConsoleMessage } from 'playwright';
import { getBrowser, ScanFailure } from './scanner.js';
import type {
  ConsoleEntry,
  FailedRequest,
  ObserveOptions,
  ObserveResult,
  ViewportObservation,
  ViewportSpec,
} from './types.js';

// ── Browser-Typen, bewusst lokal ────────────────────────────────────────────
//
// Die Rückrufe in `page.evaluate` laufen im Browser, nicht in Node. Der Dienst
// lädt aber absichtlich keine DOM-Typen (`tsconfig.json`: lib = ES2022), damit
// Node-Code nicht versehentlich `document` benutzen kann. Deshalb hier genau
// die Oberfläche, die diese beiden Rückrufe brauchen — mehr nicht.
interface BrowserRect { left: number; right: number; width: number; height: number }
interface BrowserElement { getBoundingClientRect(): BrowserRect }
interface BrowserStyle { display: string; visibility: string; opacity: string }
interface BrowserGlobals {
  document: {
    documentElement: { scrollWidth: number };
    querySelector(selector: string): BrowserElement | null;
  };
  window: {
    innerWidth: number;
    getComputedStyle(el: BrowserElement): BrowserStyle;
  };
  performance: {
    getEntriesByType(type: string): Array<{
      responseStart: number;
      domContentLoadedEventEnd: number;
      loadEventEnd: number;
    }>;
  };
}

const OBSERVER_VERSION = '1.0.0';
const DEFAULT_TIMEOUT = 30_000;
const MAX_TIMEOUT = 60_000;
const MAX_VIEWPORTS = 4;
const MAX_SELECTORS = 12;
const MAX_ENTRIES = 50;

/** Die Breiten, an denen ohne ausdrückliche Angabe beobachtet wird. */
const DEFAULT_VIEWPORTS: ViewportSpec[] = [
  { label: 'desktop', width: 1280, height: 900 },
  { label: 'mobile', width: 390, height: 844 },
];

function clampTimeout(v: number | undefined): number {
  if (typeof v !== 'number' || Number.isNaN(v)) return DEFAULT_TIMEOUT;
  return Math.min(Math.max(v, 1_000), MAX_TIMEOUT);
}

/**
 * Gleiche Meldung mehrfach = ein Befund. Ohne das erzeugt eine Schleife im
 * Seitencode hunderte identische Zeilen und das Ticket wird unlesbar.
 */
function dedupe(entries: ConsoleEntry[]): ConsoleEntry[] {
  const seen = new Set<string>();
  const out: ConsoleEntry[] = [];
  for (const e of entries) {
    const key = `${e.level}|${e.text}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(e);
    if (out.length >= MAX_ENTRIES) break;
  }
  return out;
}

/**
 * Dieselbe fehlgeschlagene Anfrage an mehreren Breiten ist ein Fehler, nicht
 * zwei. Ohne das meldet der Befund „2 Anfragen schlugen fehl", wo eine einzige
 * Datei fehlt — und die Zahl im Ticket-Titel wäre falsch.
 */
function dedupeRequests(reqs: FailedRequest[]): FailedRequest[] {
  const seen = new Set<string>();
  const out: FailedRequest[] = [];
  for (const r of reqs) {
    const key = `${r.url}|${r.status ?? ''}|${r.failure ?? ''}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(r);
    if (out.length >= MAX_ENTRIES) break;
  }
  return out;
}

function toConsoleEntry(msg: ConsoleMessage): ConsoleEntry {
  const loc = msg.location();
  return {
    level: msg.type() === 'error' ? 'error' : 'warning',
    text: msg.text().slice(0, 500),
    url: loc.url || null,
    line: typeof loc.lineNumber === 'number' ? loc.lineNumber : null,
  };
}

export async function observe(targetUrl: string, options: ObserveOptions = {}): Promise<ObserveResult> {
  const startedAt = Date.now();
  const timeout = clampTimeout(options.timeout);

  let parsedUrl: URL;
  try { parsedUrl = new URL(targetUrl); }
  catch { throw new ScanFailure('INVALID_URL', `Cannot parse URL: ${targetUrl}`); }
  void parsedUrl;

  const viewports = (options.viewports?.length ? options.viewports : DEFAULT_VIEWPORTS).slice(0, MAX_VIEWPORTS);
  const expectVisible = (options.expect_visible ?? []).slice(0, MAX_SELECTORS);
  const userAgent = options.user_agent
    ?? `RealSync-BrowserAgentX07/${OBSERVER_VERSION} (+https://realsyncdynamicsai.de/governance-runtime)`;

  const consoleEntries: ConsoleEntry[] = [];
  const pageErrors: string[] = [];
  const failedRequests: FailedRequest[] = [];
  const viewportResults: ViewportObservation[] = [];

  let finalUrl: string | null = null;
  let httpStatus: number | null = null;
  let timings: ObserveResult['timings'] = null;

  const browser: Browser = await getBrowser();

  for (const vp of viewports) {
    // Eigener Kontext je Breite: Ein `setViewportSize` auf derselben Seite
    // führt kein erneutes Laden aus — Fehler, die nur beim Laden in schmaler
    // Breite auftreten, blieben dann unsichtbar.
    const context: BrowserContext = await browser.newContext({
      userAgent,
      viewport: { width: vp.width, height: vp.height },
      locale: 'de-DE',
      timezoneId: 'Europe/Berlin',
      ignoreHTTPSErrors: true,
    });

    const page = await context.newPage();

    page.on('console', (msg) => {
      const t = msg.type();
      if (t === 'error' || t === 'warning') consoleEntries.push(toConsoleEntry(msg));
    });
    page.on('pageerror', (err) => {
      pageErrors.push(String(err?.message ?? err).slice(0, 500));
    });
    page.on('requestfailed', (req) => {
      failedRequests.push({
        url: req.url().slice(0, 500),
        method: req.method(),
        failure: req.failure()?.errorText ?? null,
        status: null,
      });
    });
    page.on('response', (resp) => {
      if (resp.status() >= 400) {
        failedRequests.push({
          url: resp.url().slice(0, 500),
          method: resp.request().method(),
          failure: null,
          status: resp.status(),
        });
      }
    });

    try {
      const response = await page.goto(targetUrl, { waitUntil: 'load', timeout });
      if (finalUrl === null) {
        finalUrl = page.url();
        httpStatus = response?.status() ?? null;
      }

      if (timings === null) {
        timings = await page.evaluate(() => {
          const g = globalThis as unknown as BrowserGlobals;
          const nav = g.performance.getEntriesByType('navigation')[0];
          if (!nav) return null;
          return {
            response_start_ms: Math.round(nav.responseStart),
            dom_content_loaded_ms: Math.round(nav.domContentLoadedEventEnd),
            load_ms: Math.round(nav.loadEventEnd),
          };
        }).catch(() => null);
      }

      const observation = await page.evaluate((selectors: string[]) => {
        const g = globalThis as unknown as BrowserGlobals;
        const vw = g.window.innerWidth;
        const results = selectors.map((selector) => {
          const el = g.document.querySelector(selector);
          if (!el) {
            return {
              selector, found: false, visible: false, within_viewport: false,
              right: null as number | null,
            };
          }
          const rect = el.getBoundingClientRect();
          const style = g.window.getComputedStyle(el);
          const visible = style.display !== 'none'
            && style.visibility !== 'hidden'
            && Number(style.opacity) !== 0
            && rect.width > 0
            && rect.height > 0;
          return {
            selector,
            found: true,
            visible,
            within_viewport: visible && rect.left >= 0 && rect.right <= vw + 1,
            right: Math.round(rect.right),
          };
        });
        return {
          document_scroll_width: g.document.documentElement.scrollWidth,
          window_inner_width: vw,
          selectors: results,
        };
      }, expectVisible);

      viewportResults.push({
        label: vp.label ?? `${vp.width}x${vp.height}`,
        width: vp.width,
        height: vp.height,
        document_scroll_width: observation.document_scroll_width,
        // +1 px Toleranz gegen Rundung bei fraktionalen Layout-Breiten.
        horizontal_overflow: observation.document_scroll_width > observation.window_inner_width + 1,
        selectors: observation.selectors,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      // Eine Breite, die nicht lädt, ist selbst ein Befund — kein Abbruch des
      // ganzen Laufs, sonst verdeckt die erste kaputte Breite alle weiteren.
      viewportResults.push({
        label: vp.label ?? `${vp.width}x${vp.height}`,
        width: vp.width,
        height: vp.height,
        document_scroll_width: 0,
        horizontal_overflow: false,
        selectors: expectVisible.map((selector) => ({
          selector, found: false, visible: false, within_viewport: false, right: null,
        })),
        load_error: msg.slice(0, 300),
      });
    } finally {
      await context.close().catch(() => { /* ignore */ });
    }
  }

  return {
    ok: true,
    meta: {
      url: targetUrl,
      final_url: finalUrl,
      http_status: httpStatus,
      duration_ms: Date.now() - startedAt,
      observer_version: OBSERVER_VERSION,
      observed_at: new Date().toISOString(),
    },
    console_errors: dedupe(consoleEntries.filter((e) => e.level === 'error')),
    console_warnings: dedupe(consoleEntries.filter((e) => e.level === 'warning')),
    page_errors: Array.from(new Set(pageErrors)).slice(0, MAX_ENTRIES),
    failed_requests: dedupeRequests(failedRequests),
    timings,
    viewports: viewportResults,
  };
}
