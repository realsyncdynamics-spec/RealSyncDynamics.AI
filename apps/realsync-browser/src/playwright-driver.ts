// Lokaler Chromium-Treiber für den RealSync Browser (MVP).
//
// Der Treiber führt nur aus, was der Guardian freigegeben hat, und prüft
// jede Netzanfrage selbst noch einmal:
//   - nur http(s) (data:/blob: bleiben lokal), keine lokalen/internen Netze
//     — auch nach DNS-Auflösung;
//   - Hauptdokument (Navigation, Weiterleitung, Absenden) nur, wenn der
//     Egress-Wächter des Guardians zustimmt; ohne laufende Aktion gar nicht;
//   - kein Referer an fremde Origins, keine Downloads, keine Service Worker
//     (die würden am Wächter vorbeiladen), keine WebSockets, keine Popups.
//
// Netzgrenze: Jede Verbindung läuft über den lokalen Egress-Proxy
// (egress-proxy.ts) — auch Weiterleitungen, die Playwright-Routen nicht
// sehen, und mit fest verbundener, geprüfter IP (kein DNS-Rebinding).

import { lookup } from 'node:dns/promises';
import { createRequire } from 'node:module';
import { isIP } from 'node:net';
import type { Browser, BrowserContext, Page, Route } from 'playwright';
import { isPrivateHostLiteral } from '../../../packages/browser-guardian/src/policy.ts';
import { startEgressProxy, type Dial, type EgressProxy } from './egress-proxy.ts';
import type { BrowserAction, BrowserDriver, DriverResult, EgressGuard } from '../../../packages/browser-guardian/src/index.ts';

export type HostResolver = (hostname: string) => Promise<string[]>;
/** Läuft erst NACH allen Prüfungen. Standard: Anfrage ans Netz weiterreichen. */
export type Transport = (route: Route, headers?: Record<string, string>) => Promise<void>;

export interface PlaywrightDriverOptions {
  headless?: boolean;
  executablePath?: string;
  /** Nur für Tests ersetzbar; Standard ist die System-DNS-Auflösung. */
  resolveHost?: HostResolver;
  /** Nur für Tests ersetzbar (Antworten ohne Netz); umgeht keine Prüfung. */
  transport?: Transport;
  /** Nur für Tests ersetzbar: Verbindungsaufbau des Egress-Proxys. */
  dial?: Dial;
}

const systemResolver: HostResolver = async (hostname) =>
  (await lookup(hostname, { all: true, verbatim: true })).map((r) => r.address);

const netTransport: Transport = (route, headers) => (headers ? route.continue({ headers }) : route.continue());

const MAX_TEXT = 50_000;
const MAX_WAIT_MS = 5_000;

function shortError(e: unknown): string {
  const msg = e instanceof Error ? e.message : String(e);
  if (/ERR_BLOCKED_BY_CLIENT/.test(msg)) return 'DOCUMENT_BLOCKED';
  if (/ERR_TUNNEL_CONNECTION_FAILED|ERR_PROXY|ERR_CONNECTION|ERR_NAME/.test(msg)) return 'NETWORK_ERROR';
  if (/Timeout/i.test(msg)) return 'TIMEOUT';
  return `ACTION_FAILED: ${msg.split('\n')[0].slice(0, 120)}`;
}

export class PlaywrightDriver implements BrowserDriver {
  readonly kind = 'playwright' as const;
  #browser: Browser;
  #context: BrowserContext;
  #page: Page;
  #resolve: HostResolver;
  #transport: Transport;
  #proxy: EgressProxy;
  #guard: EgressGuard | null = null;
  #blocked = 0;

  private constructor(browser: Browser, context: BrowserContext, page: Page, resolve: HostResolver, transport: Transport, proxy: EgressProxy) {
    this.#proxy = proxy;
    this.#browser = browser;
    this.#context = context;
    this.#page = page;
    this.#resolve = resolve;
    this.#transport = transport;
  }

  static async launch(opts: PlaywrightDriverOptions = {}): Promise<PlaywrightDriver> {
    // createRequire: findet ein lokal oder global installiertes playwright (NODE_PATH).
    const { chromium } = createRequire(import.meta.url)('playwright') as typeof import('playwright');
    const resolve = opts.resolveHost ?? systemResolver;
    const proxy = await startEgressProxy({ resolveHost: resolve, dial: opts.dial });
    const browser = await chromium.launch({
      headless: opts.headless ?? true,
      executablePath: opts.executablePath,
      // Auch Loopback über den Proxy; WebRTC nicht am Proxy vorbei.
      proxy: { server: proxy.url, bypass: '<-loopback>' },
      args: ['--force-webrtc-ip-handling-policy=disable_non_proxied_udp'],
    }).catch(async (e) => { await proxy.close(); throw e; });
    const context = await browser.newContext({
      acceptDownloads: false,
      serviceWorkers: 'block',
      permissions: [],
      locale: 'de-DE',
      timezoneId: 'Europe/Berlin',
      viewport: { width: 1280, height: 860 },
    });
    const page = await context.newPage();
    const driver = new PlaywrightDriver(browser, context, page, resolve, opts.transport ?? netTransport, proxy);
    await context.routeWebSocket(/.*/, (ws) => { void ws.close({ code: 1008, reason: 'RealSync Guardian: WebSocket gesperrt' }); });
    await context.route('**/*', (route) => driver.#route(route));
    context.on('page', (p) => { if (p !== page) void p.close(); });
    return driver;
  }

  async #isPublicHost(hostname: string): Promise<boolean> {
    const host = hostname.replace(/^\[|\]$/g, '');
    if (isPrivateHostLiteral(host)) return false;
    if (isIP(host)) return true;
    try {
      const addresses = await this.#resolve(host);
      return addresses.length > 0 && addresses.every((a) => !isPrivateHostLiteral(a));
    } catch {
      return false;
    }
  }

  async #route(route: Route): Promise<void> {
    const request = route.request();
    let url: URL;
    try { url = new URL(request.url()); } catch { this.#blocked += 1; return route.abort('blockedbyclient'); }
    if (url.protocol === 'data:' || url.protocol === 'blob:') return route.continue();
    if ((url.protocol !== 'https:' && url.protocol !== 'http:') || url.username || url.password) {
      this.#blocked += 1;
      return route.abort('blockedbyclient');
    }
    if (!(await this.#isPublicHost(url.hostname))) {
      this.#blocked += 1;
      return route.abort('blockedbyclient');
    }
    const mainDocument = request.isNavigationRequest() && request.frame() === this.#page.mainFrame();
    if (mainDocument && !(this.#guard?.document(url.toString()) ?? false)) {
      this.#blocked += 1;
      return route.abort('blockedbyclient');
    }
    const headers = request.headers();
    if (headers.referer) {
      let refOrigin: string | null = null;
      try { refOrigin = new URL(headers.referer).origin; } catch { /* entfernen */ }
      if (refOrigin !== url.origin) {
        const { referer: _drop, ...rest } = headers;
        return this.#transport(route, rest);
      }
    }
    return this.#transport(route);
  }

  /** Nur echte Seiten; eine Fehlerseite (chrome-error://) heißt: keine Seite. */
  #currentUrl(): string | null {
    const u = this.#page.url();
    return /^https?:\/\//.test(u) ? u : null;
  }

  async run(action: BrowserAction, guard: EgressGuard): Promise<DriverResult> {
    this.#guard = guard;
    this.#blocked = 0;
    const proxyBlockedBefore = this.#proxy.blocked();
    const page = this.#page;
    const blockedNow = () => this.#blocked + this.#proxy.blocked() - proxyBlockedBefore;
    const done = (extra: Partial<DriverResult> = {}): DriverResult =>
      ({ ok: true, url: this.#currentUrl(), blocked_requests: blockedNow(), ...extra });
    try {
      switch (action.type) {
        case 'navigate':
          await page.goto(action.url, { waitUntil: 'domcontentloaded', timeout: 30_000 });
          return done({ title: await page.title() });
        case 'scroll':
          await page.mouse.wheel(0, (action.direction === 'up' ? -1 : 1) * (action.amount ?? 700));
          return done();
        case 'click':
          await page.locator(action.selector).first().click({ timeout: 10_000 });
          await page.waitForLoadState('domcontentloaded', { timeout: 5_000 }).catch(() => undefined);
          return done({ title: await page.title() });
        case 'type':
          await page.locator(action.selector).first().fill(action.text, { timeout: 10_000 });
          return done();
        case 'select':
          await page.locator(action.selector).first().selectOption(action.value, { timeout: 10_000 });
          return done();
        case 'extract': {
          const text = await page.locator(action.selector ?? 'body').first().innerText({ timeout: 10_000 });
          return done({ title: await page.title(), text: text.slice(0, MAX_TEXT) });
        }
        case 'wait':
          await page.waitForTimeout(Math.min(Math.max(action.milliseconds, 0), MAX_WAIT_MS));
          return done();
        case 'screenshot': {
          const png = await page.screenshot({ type: 'png', fullPage: false });
          return done({ screenshot_png: new Uint8Array(png) });
        }
      }
    } catch (e) {
      // Fehlerseite fertig laden lassen, sonst unterbricht sie die nächste Navigation.
      if (action.type === 'navigate' || action.type === 'click') {
        await page.waitForLoadState('domcontentloaded', { timeout: 3_000 }).catch(() => undefined);
      }
      const blocked = blockedNow();
      return { ok: false, url: this.#currentUrl(), error: blocked > 0 ? 'DOCUMENT_BLOCKED' : shortError(e), blocked_requests: blocked };
    } finally {
      this.#guard = null;
    }
  }

  async close(): Promise<void> {
    await this.#context.close().catch(() => undefined);
    await this.#browser.close().catch(() => undefined);
    await this.#proxy.close();
  }
}
