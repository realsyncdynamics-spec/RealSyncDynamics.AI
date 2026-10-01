// Governed Browser Executor — laufzeitneutraler Session-Kern.
//
// Gemeinsam genutzt vom Node-Executor (executor.ts/server.ts, Container) und
// vom Cloudflare-Executor (deploy/browser-run-executor, Browser Run + Durable
// Object). Kein node:-Import, Hashing über WebCrypto; Playwright nur als Typ.
//
// Der Executor entscheidet nichts über Governance: Er führt nur aus, was die
// Edge Function browser-execute nach Policy/Freigabe/Evidence schickt, und
// liefert überprüfbare Ergebnisse (Verifikation, Frame-Hash).
//
// Sicherheitszusagen dieses Kerns (Review 2026-09-29):
//  - Fehler verlassen den Executor nur als feste Codes (errorCode) — nie als
//    Playwright-Meldung (die Selektoren, Eingaben oder URLs enthalten kann).
//  - expected_url: Eine Freigabe gilt für die Seite, die der Freigebende sah.
//    Steht die LIVE-Seite woanders → PAGE_CHANGED, nichts wird ausgeführt.
//  - Landeprüfung vor und nach jeder Aktion und vor jedem Frame: Seiten auf
//    gesperrten Adressen (Redirect-Hop, selbstständige Navigation) werden auf
//    about:blank gesetzt, bevor Bild oder Text den Executor verlassen.
//  - Downloads nur innerhalb einer download-Aktion; jeder andere wird
//    abgebrochen und in der Verifikation gezählt.
//  - Zustandsändernde Navigationen (POST-Formular, auch per reload/back/
//    forward erneut gesendet) nur während einer FREIGEGEBENEN Aktion
//    (expected_url gesetzt) — sonst ließe sich eine einmal freigegebene
//    Mutation per „Neu laden“ ohne Freigabe wiederholen (Review 10-01).
//  - Optional (Laufzeiten ohne Egress-Proxy, Cloudflare): Server-Adresse
//    jeder Antwort prüfen; eine private Adresse (DNS-Rebinding, Redirect-Hop
//    in einem iframe) sperrt die Session dauerhaft, bevor Inhalte hinausgehen.
//
// Session-Modell: eine Session-ID (browser_sessions.executor_session_id) =
// genau ein BrowserContext mit genau einer aktiven Page. Dieselbe Session
// liefert Aktionen UND Vorschau-Frames — keine zweite Seite, keine Animation.

import type { BrowserContext, BrowserContextOptions, Download, Page, Response as PwResponse, Route } from 'playwright';
import { assertNavigable, isLandingAllowed, type HostGuard } from './netguard.js';

export type BrowserAction =
  | { type: 'navigate'; url: string }
  | { type: 'scroll'; direction: 'up' | 'down'; amount?: number }
  | { type: 'click'; selector: string }
  | { type: 'type'; selector: string; text: string }
  | { type: 'select'; selector: string; value: string }
  | { type: 'submit'; selector: string }
  | { type: 'extract'; selector?: string }
  | { type: 'read_text'; selector?: string }
  | { type: 'read_dom'; selector?: string }
  | { type: 'wait'; milliseconds: number }
  | { type: 'screenshot' }
  | { type: 'back' }
  | { type: 'forward' }
  | { type: 'reload' }
  | { type: 'download'; selector: string };

/** Fähigkeiten jeder Laufzeit; 'download' nur mit DownloadInspector. */
export const BASE_CAPABILITIES = [
  'sessions', 'frame', 'expected_url', 'landing_check', 'post_navigation_guard',
  'navigate', 'scroll', 'click', 'type', 'select', 'submit', 'wait',
  'read_text', 'read_dom', 'screenshot', 'back', 'forward', 'reload',
] as const;

export interface BrowserExecuteRequest {
  session_id: string;
  actions: BrowserAction[];
  /** true: unbekannte Session → SESSION_NOT_FOUND statt stiller Neuanlage. */
  require_session?: boolean;
  include_frame?: boolean;
  /** Seite, an die eine Freigabe gebunden ist; Abweichung → PAGE_CHANGED. */
  expected_url?: string | null;
}

export interface Verification {
  status: 'passed' | 'failed' | 'not_applicable';
  checks: Record<string, unknown>;
}

export interface BrowserActionResult {
  index: number;
  type: BrowserAction['type'];
  ok: boolean;
  url: string;
  title?: string;
  text?: string;
  dom?: unknown;
  screenshot?: { sha256: string; bytes: number; base64: string };
  download?: { filename: string; bytes: number; sha256: string; mime: string | null };
  verification: Verification;
  /** Legacy-Feld (Alt-Client): identisch zu screenshot.base64. */
  screenshot_base64?: string;
  /** Immer ein fester Code (errorCode), nie Freitext. */
  error?: string;
}

export interface Frame {
  mime: 'image/jpeg';
  base64: string;
  sha256: string;
  bytes: number;
  captured_at: string;
}

export interface PageInfo {
  url: string;
  title: string;
  loading: boolean;
}

export interface ExecuteOutput {
  results: BrowserActionResult[];
  page: PageInfo;
  frame: Frame | null;
}

export const LIMITS = {
  sessionIdleTtlMs: 15 * 60 * 1000,
  sessionMaxAgeMs: 60 * 60 * 1000,
  maxActions: 25,
  maxTextLength: 10_000,
  maxSelectorLength: 1_000,
  maxWaitMs: 5_000,
  maxDownloadBytes: 25 * 1024 * 1024,
  maxDomNodes: 400,
  frameQuality: 55,
} as const;

export class ExecutorError extends Error {
  constructor(readonly code: string, readonly status = 400, readonly extra: Record<string, unknown> = {}) {
    super(code);
    this.name = 'ExecutorError';
  }
}

const NETGUARD_CODES = new Set(['INVALID_URL', 'URL_CREDENTIALS_NOT_ALLOWED', 'PRIVATE_NETWORK_BLOCKED']);

/** Navigationen ohne Zustandsänderung; alles andere (POST) nur mit Freigabe. */
const SAFE_NAVIGATION_METHODS: ReadonlySet<string> = new Set(['GET', 'HEAD']);

/**
 * Fehler → fester Code. Die Playwright-Meldung (inkl. Call-Log) wird nur
 * klassifiziert und verlässt den Executor nie: Sie kann Selektoren,
 * Eingabewerte, Element-HTML oder URLs enthalten.
 */
export function errorCode(error: unknown): string {
  if (error instanceof ExecutorError) return error.code;
  if (!(error instanceof Error)) return 'ACTION_FAILED';
  const m = error.message ?? '';
  if (NETGUARD_CODES.has(m)) return m;
  if (/net::ERR_(BLOCKED_BY_CLIENT|TUNNEL_CONNECTION_FAILED|ACCESS_DENIED|BLOCKED_BY_RESPONSE|PROXY_CONNECTION_FAILED)/.test(m)) return 'NAVIGATION_BLOCKED';
  if (/net::ERR_NAME_NOT_RESOLVED/.test(m)) return 'DNS_FAILED';
  if (/net::ERR_(CERT_|SSL_)/.test(m)) return 'TLS_ERROR';
  if (/net::ERR_ABORTED/.test(m)) return 'NAVIGATION_ABORTED';
  if (/net::ERR_/.test(m)) return 'NETWORK_ERROR';
  if (/has been closed|Target closed|Target crashed/i.test(m)) return 'SESSION_CLOSED';
  if (/while parsing (css )?selector|is not a valid selector|Unknown engine|Unexpected token/i.test(m)) return 'INVALID_SELECTOR';
  if (/not an? <select> element/i.test(m)) return 'NOT_SELECTABLE';
  if (/not an <input>, <textarea>|is not editable|not a contenteditable/i.test(m)) return 'NOT_EDITABLE';
  if (error.name === 'TimeoutError' || /Timeout \d+ms exceeded/.test(m)) {
    if (/did not find some options/.test(m)) return 'OPTION_NOT_FOUND';
    if (/locator resolved to/.test(m)) return 'ELEMENT_NOT_INTERACTABLE';
    if (/waiting for (locator|selector)/.test(m)) return 'SELECTOR_NOT_FOUND';
    return 'TIMEOUT';
  }
  return 'ACTION_FAILED';
}

function validateSelector(selector: unknown): string {
  if (typeof selector !== 'string' || selector.length === 0 || selector.length > LIMITS.maxSelectorLength) {
    throw new ExecutorError('INVALID_SELECTOR');
  }
  if (/^\s*(javascript|js)\s*[:=]/i.test(selector)) throw new ExecutorError('INVALID_SELECTOR');
  return selector;
}

const ACTION_TYPES: ReadonlySet<string> = new Set([
  'navigate', 'scroll', 'click', 'type', 'select', 'submit', 'extract', 'read_text', 'read_dom',
  'wait', 'screenshot', 'back', 'forward', 'reload', 'download',
]);

export function validateRequest(req: unknown): BrowserExecuteRequest {
  const r = req as BrowserExecuteRequest | null;
  if (!r || typeof r.session_id !== 'string') throw new ExecutorError('INVALID_SESSION');
  if (!Array.isArray(r.actions) || r.actions.length === 0 || r.actions.length > LIMITS.maxActions) {
    throw new ExecutorError('INVALID_ACTIONS');
  }
  for (const a of r.actions) {
    if (!a || typeof a !== 'object' || typeof a.type !== 'string' || !ACTION_TYPES.has(a.type)) {
      throw new ExecutorError('UNSUPPORTED_ACTION');
    }
  }
  if (r.expected_url !== undefined && r.expected_url !== null && (typeof r.expected_url !== 'string' || r.expected_url.length > 4096)) {
    throw new ExecutorError('INVALID_EXPECTED_URL');
  }
  return r;
}

// ── Hashing/Kodierung (WebCrypto, Node 20 + Workers) ─────────────────────────

export async function sha256Hex(bytes: Uint8Array): Promise<string> {
  // Kopie: eigener ArrayBuffer (BufferSource-kompatibel in jeder TS-/Laufzeitversion).
  const digest = await crypto.subtle.digest('SHA-256', new Uint8Array(bytes));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export function bytesToBase64(bytes: Uint8Array): string {
  const B = (globalThis as { Buffer?: { from(b: Uint8Array): { toString(enc: 'base64'): string } } }).Buffer;
  if (B) return B.from(bytes).toString('base64');
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}

function originOf(raw: string): string | null {
  try {
    const u = new URL(raw);
    return u.origin === 'null' ? `${u.protocol}` : u.origin;
  } catch {
    return null;
  }
}

/**
 * Löst eine Aktion aus und wartet auf eine dadurch ausgelöste Navigation der
 * Hauptseite (Commit + DOMContentLoaded). Ohne Navigation innerhalb von
 * navTimeoutMs geht es weiter — nicht jeder Klick navigiert.
 */
async function triggerAndSettle(page: Page, trigger: () => Promise<unknown>, navTimeoutMs: number): Promise<boolean> {
  const navigated = page
    .waitForEvent('framenavigated', { predicate: (f) => f === page.mainFrame(), timeout: navTimeoutMs })
    .then(() => true)
    .catch(() => false);
  await trigger();
  const didNavigate = await navigated;
  if (didNavigate) await page.waitForLoadState('domcontentloaded', { timeout: 15_000 }).catch(() => undefined);
  return didNavigate;
}

/** Ergebnis einer Aktion, nach der die Seite gesperrt landete (Inhalt verworfen). */
function landedResult(index: number, type: BrowserAction['type'], blockedOrigin: string): BrowserActionResult {
  return {
    index,
    type,
    ok: false,
    url: 'about:blank',
    error: 'LANDED_ON_BLOCKED_URL',
    verification: { status: 'failed', checks: { landed_blocked: true, blocked_origin: blockedOrigin } },
  };
}

/** Prüft/hasht einen ERWARTETEN Download und verwirft ihn danach (laufzeitspezifisch). */
export interface DownloadInspector {
  inspect(download: Download): Promise<{ bytes: number; sha256: string }>;
}

export interface GuardedSessionOptions {
  guard: HostGuard;
  /** null: Laufzeit kann keine Downloads prüfen — jeder Download wird abgebrochen. */
  downloads: DownloadInspector | null;
  /**
   * Server-Adresse jeder Antwort gegen den HostGuard prüfen. Nur für
   * Laufzeiten OHNE Egress-Proxy (dort wäre jede Adresse die des Proxys).
   */
  verifyServerAddress?: boolean;
  now?: () => number;
  log?: (event: Record<string, unknown>) => void;
}

/** Kontext-Optionen beider Laufzeiten. */
export function contextOptions(acceptDownloads: boolean): BrowserContextOptions {
  return {
    viewport: { width: 1280, height: 800 },
    locale: 'de-DE',
    timezoneId: 'Europe/Berlin',
    ignoreHTTPSErrors: false,
    acceptDownloads,
    // Service Worker umgehen context.route — deshalb gesperrt.
    serviceWorkers: 'block',
  };
}

type WebSocketRoute = { url(): string; close(): Promise<void>; connectToServer(): unknown };

export class GuardedSession {
  readonly createdAt: number;
  lastUsedAt: number;
  closed = false;
  private active: Page | null = null;
  private readonly adopted = new WeakSet<Page>();
  private queue: Promise<unknown> = Promise.resolve();
  private expectingDownload = false;
  private blockedDownloads = 0;
  private blockedNavigations = 0;
  /** true nur während einer freigegebenen Aktion (expected_url gesetzt). */
  private allowStateChangingNavigation = false;
  /** Eine Antwort kam von einer nicht-öffentlichen Adresse: Session gesperrt. */
  private tainted = false;
  private readonly addressChecks = new Set<Promise<void>>();
  private readonly now: () => number;
  private readonly log: (event: Record<string, unknown>) => void;

  private constructor(readonly context: BrowserContext, private readonly opts: GuardedSessionOptions) {
    this.now = opts.now ?? (() => Date.now());
    this.log = opts.log ?? (() => undefined);
    this.createdAt = this.now();
    this.lastUsedAt = this.createdAt;
  }

  /** Netzwerk-Wächter am Kontext, dann die erste (leere) Seite. */
  static async open(context: BrowserContext, opts: GuardedSessionOptions): Promise<GuardedSession> {
    const s = new GuardedSession(context, opts);
    await context.route('**/*', (route) => s.routeGuard(route));
    const ctx = context as BrowserContext & {
      routeWebSocket?: (url: RegExp, handler: (ws: WebSocketRoute) => unknown) => Promise<void>;
    };
    if (typeof ctx.routeWebSocket === 'function') {
      await ctx.routeWebSocket(/.*/, async (ws) => {
        let allowed = false;
        try {
          const u = new URL(ws.url());
          allowed = (u.protocol === 'ws:' || u.protocol === 'wss:') && await opts.guard.allows(u.hostname, u.port);
        } catch { allowed = false; }
        if (allowed) ws.connectToServer();
        else await ws.close();
      });
    }
    if (opts.verifyServerAddress) context.on('response', (r) => s.checkServerAddress(r));
    // Neue Tabs (target=_blank) werden zur aktiven Seite der Session.
    context.on('page', (p) => s.adopt(p));
    s.adopt(await context.newPage());
    return s;
  }

  private adopt(page: Page): void {
    this.active = page;
    // context.on('page') meldet auch die selbst geöffnete erste Seite —
    // Handler nur einmal je Seite anhängen.
    if (this.adopted.has(page)) return;
    this.adopted.add(page);
    page.on('download', (d) => this.onDownload(d));
    page.on('close', () => {
      if (this.active !== page) return;
      const open = this.context.pages().filter((p) => !p.isClosed());
      this.active = open.at(-1) ?? null;
    });
  }

  private onDownload(download: Download): void {
    if (this.expectingDownload) return; // die download-Aktion übernimmt
    this.blockedDownloads += 1;
    void download.cancel().catch(() => undefined);
    this.log({ event: 'download_blocked' });
  }

  private checkServerAddress(response: PwResponse): void {
    const check: Promise<void> = response.serverAddr()
      .then(async (addr) => {
        if (!addr) return; // Cache, data: — kein Netzweg
        const port = addr.port === 80 || addr.port === 443 ? '' : String(addr.port);
        if (!(await this.opts.guard.allows(addr.ipAddress, port))) {
          this.tainted = true;
          this.log({ event: 'private_server_address' });
        }
      })
      .catch(() => undefined)
      .finally(() => { this.addressChecks.delete(check); });
    this.addressChecks.add(check);
  }

  private async routeGuard(route: Route): Promise<void> {
    const request = route.request();
    if (request.isNavigationRequest() && !SAFE_NAVIGATION_METHODS.has(request.method()) && !this.allowStateChangingNavigation) {
      // POST-Navigation außerhalb einer freigegebenen Aktion (z. B. reload
      // einer Formular-Antwortseite) — nie ohne Freigabe erneut senden.
      this.blockedNavigations += 1;
      this.log({ event: 'state_changing_navigation_blocked' });
      await route.abort('blockedbyclient');
      return;
    }
    let url: URL;
    try { url = new URL(request.url()); } catch {
      await route.abort('blockedbyclient');
      return;
    }
    if (url.protocol === 'data:' || url.protocol === 'blob:') {
      await route.continue();
      return;
    }
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      await route.abort('blockedbyclient');
      return;
    }
    if (!(await this.opts.guard.allows(url.hostname, url.port))) {
      await route.abort('blockedbyclient');
      return;
    }
    await route.continue();
  }

  touch(): void {
    this.lastUsedAt = this.now();
  }

  /** Aktive Seite; ist sie geschlossen (Popup zu), eine neue leere. */
  async page(): Promise<Page> {
    if (this.active && !this.active.isClosed()) return this.active;
    const p = await this.context.newPage();
    this.adopt(p);
    return p;
  }

  /** Serialisiert Arbeit je Session (keine verschränkten Aktionen/Frames). */
  async run<T>(fn: () => Promise<T>): Promise<T> {
    const run = this.queue.then(() => {
      if (this.closed) throw new ExecutorError('SESSION_NOT_FOUND', 404);
      this.touch();
      return fn();
    });
    this.queue = run.catch(() => undefined);
    return await run;
  }

  async close(): Promise<void> {
    this.closed = true;
    await this.context.close().catch(() => undefined);
  }

  /**
   * Steht die Seite auf einer gesperrten Adresse, wird sie auf about:blank
   * gesetzt (gelingt das nicht: Session zu) — danach verlässt kein Bild/Text
   * dieser Seite den Executor. Rückgabe: Ursprung der gesperrten Adresse.
   */
  private async enforceLanding(): Promise<string | null> {
    // Laufende Adressprüfungen abwarten — erst danach darf etwas hinaus.
    if (this.addressChecks.size > 0) await Promise.all([...this.addressChecks]);
    const page = await this.page();
    let blocked: string | null = this.tainted ? 'private-server-address' : null;
    if (!blocked) {
      // Alle Frames, nicht nur die Hauptseite (Redirect-Hop in einem iframe).
      for (const frame of page.frames()) {
        const url = frame.url();
        if (url !== '' && !(await isLandingAllowed(url, this.opts.guard))) {
          blocked = originOf(url) ?? 'unknown';
          break;
        }
      }
    }
    if (!blocked) return null;
    this.log({ event: 'landing_blocked' });
    await page.goto('about:blank', { timeout: 5_000 }).catch(() => undefined);
    if (page.url() !== 'about:blank') {
      await this.close();
      throw new ExecutorError('LANDED_ON_BLOCKED_URL', 403);
    }
    return blocked;
  }

  async pageInfo(): Promise<PageInfo> {
    const page = await this.page();
    let loading = false;
    try {
      loading = await page.evaluate('document.readyState !== "complete"') as boolean;
    } catch { loading = false; }
    return { url: page.url(), title: await page.title().catch(() => ''), loading };
  }

  private async captureFrame(): Promise<Frame> {
    const page = await this.page();
    const jpeg = new Uint8Array(await page.screenshot({ type: 'jpeg', quality: LIMITS.frameQuality, fullPage: false }));
    return {
      mime: 'image/jpeg',
      base64: bytesToBase64(jpeg),
      sha256: await sha256Hex(jpeg),
      bytes: jpeg.length,
      captured_at: new Date(this.now()).toISOString(),
    };
  }

  /**
   * Aktuelles Bild derselben Session. Landeprüfung davor UND danach: alles,
   * was auf dem Bild zu sehen ist, kam vor der Aufnahme an und ist damit
   * geprüft — sonst geht das Bild nicht hinaus.
   */
  async frame(): Promise<{ page: PageInfo; frame: Frame }> {
    const before = await this.enforceLanding();
    if (before) throw new ExecutorError('LANDED_ON_BLOCKED_URL', 403, { blocked_origin: before });
    const frame = await this.captureFrame();
    const after = await this.enforceLanding();
    if (after) throw new ExecutorError('LANDED_ON_BLOCKED_URL', 403, { blocked_origin: after });
    return { page: await this.pageInfo(), frame };
  }

  async runAction(action: BrowserAction, index: number): Promise<BrowserActionResult> {
    const page = await this.page();
    const base = { index, type: action.type };
    switch (action.type) {
      case 'navigate': {
        const target = await assertNavigable(action.url, this.opts.guard);
        const response = await page.goto(target.toString(), { waitUntil: 'domcontentloaded', timeout: 30_000 });
        return {
          ...base, ok: true, url: page.url(), title: await page.title(),
          verification: {
            status: response ? 'passed' : 'failed',
            checks: { http_status: response?.status() ?? null, final_url: page.url() },
          },
        };
      }
      case 'scroll': {
        const amount = Math.min(Math.max(Number(action.amount ?? 700) || 700, 1), 5_000);
        const before = await page.evaluate('window.scrollY') as number;
        await page.evaluate(`window.scrollBy(0, ${action.direction === 'up' ? -amount : amount})`);
        const after = await page.evaluate('window.scrollY') as number;
        return {
          ...base, ok: true, url: page.url(), title: await page.title(),
          verification: { status: 'passed', checks: { scroll_y_before: before, scroll_y_after: after, moved: before !== after } },
        };
      }
      case 'click': {
        const selector = validateSelector(action.selector);
        const before = page.url();
        await triggerAndSettle(page, () => page.locator(selector).first().click({ timeout: 10_000 }), 1_500);
        const now = await this.page();
        if (now !== page) await now.waitForLoadState('domcontentloaded', { timeout: 15_000 }).catch(() => undefined);
        return {
          ...base, ok: true, url: now.url(), title: await now.title(),
          verification: { status: 'passed', checks: { clicked: true, url_changed: now.url() !== before } },
        };
      }
      case 'type': {
        const selector = validateSelector(action.selector);
        if (typeof action.text !== 'string' || action.text.length > LIMITS.maxTextLength) throw new ExecutorError('TEXT_TOO_LONG');
        const locator = page.locator(selector).first();
        await locator.fill(action.text, { timeout: 10_000 });
        const length = await locator.inputValue({ timeout: 2_000 }).then((v) => v.length).catch(() => null);
        return {
          ...base, ok: true, url: page.url(), title: await page.title(),
          verification: {
            status: length === action.text.length ? 'passed' : 'failed',
            // Nur die Länge — der Wert selbst verlässt den Executor nie.
            checks: { value_length_matches: length === action.text.length },
          },
        };
      }
      case 'select': {
        const selector = validateSelector(action.selector);
        if (typeof action.value !== 'string' || action.value.length > LIMITS.maxSelectorLength) throw new ExecutorError('INVALID_VALUE');
        const selected = await page.locator(selector).first().selectOption(action.value, { timeout: 10_000 });
        return {
          ...base, ok: true, url: page.url(), title: await page.title(),
          verification: { status: selected.includes(action.value) ? 'passed' : 'failed', checks: { selected_matches: selected.includes(action.value) } },
        };
      }
      case 'submit': {
        const selector = validateSelector(action.selector);
        const before = page.url();
        let found = false;
        await triggerAndSettle(page, async () => {
          found = await page.locator(selector).first().evaluate((el) => {
            const form = el instanceof HTMLFormElement ? el : el.closest('form');
            if (!form) return false;
            form.requestSubmit();
            return true;
          }, undefined, { timeout: 10_000 });
        }, 5_000);
        if (!found) throw new ExecutorError('NO_FORM');
        const now = await this.page();
        return {
          ...base, ok: true, url: now.url(), title: await now.title(),
          verification: { status: 'passed', checks: { form_found: true, url_changed: now.url() !== before } },
        };
      }
      case 'extract':
      case 'read_text': {
        const text = action.selector
          ? await page.locator(validateSelector(action.selector)).first().innerText({ timeout: 10_000 })
          : await page.locator('body').innerText({ timeout: 10_000 });
        return {
          ...base, ok: true, url: page.url(), title: await page.title(), text: text.slice(0, 50_000),
          verification: { status: 'passed', checks: { text_chars: text.length, truncated: text.length > 50_000 } },
        };
      }
      case 'read_dom': {
        const rootSelector = action.selector ? validateSelector(action.selector) : null;
        const dom = await page.evaluate(({ rootSelector, maxNodes }) => {
          const root = rootSelector ? document.querySelector(rootSelector) : document.body;
          if (!root) return null;
          const keep = new Set(['a', 'button', 'input', 'select', 'textarea', 'form', 'label', 'h1', 'h2', 'h3', 'nav', 'main', 'iframe', 'option']);
          const nodes: Array<Record<string, string | null>> = [];
          const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT);
          let node: Node | null = walker.currentNode;
          while (node && nodes.length < maxNodes) {
            const el = node as HTMLElement;
            const tag = el.tagName.toLowerCase();
            if (keep.has(tag) || el.getAttribute('role')) {
              nodes.push({
                tag,
                id: el.id || null,
                name: el.getAttribute('name'),
                type: el.getAttribute('type'),
                role: el.getAttribute('role'),
                aria_label: el.getAttribute('aria-label'),
                // Eingabewerte werden nie gelesen — nur sichtbarer Text.
                text: tag === 'input' || tag === 'textarea' ? null : (el.innerText || el.textContent || '').trim().slice(0, 120),
                href: tag === 'a' ? el.getAttribute('href') : null,
              });
            }
            node = walker.nextNode();
          }
          return { nodes, truncated: nodes.length >= maxNodes };
        }, { rootSelector, maxNodes: LIMITS.maxDomNodes }).catch((e: unknown) => {
          // Ungültiger Selektor wirft im Seitenkontext — als Code, nicht als Text.
          if (e instanceof Error && /not a valid selector|SyntaxError/i.test(e.message)) throw new ExecutorError('INVALID_SELECTOR');
          throw e;
        });
        if (!dom) throw new ExecutorError('SELECTOR_NOT_FOUND');
        return {
          ...base, ok: true, url: page.url(), title: await page.title(), dom,
          verification: { status: 'passed', checks: { nodes: (dom as { nodes: unknown[] }).nodes.length } },
        };
      }
      case 'wait': {
        await page.waitForTimeout(Math.min(Math.max(Number(action.milliseconds) || 0, 0), LIMITS.maxWaitMs));
        return { ...base, ok: true, url: page.url(), title: await page.title(), verification: { status: 'not_applicable', checks: {} } };
      }
      case 'screenshot': {
        const png = new Uint8Array(await page.screenshot({ type: 'png', fullPage: false }));
        const base64 = bytesToBase64(png);
        return {
          ...base, ok: true, url: page.url(), title: await page.title(),
          screenshot: { sha256: await sha256Hex(png), bytes: png.length, base64 },
          screenshot_base64: base64,
          verification: { status: 'passed', checks: { bytes: png.length } },
        };
      }
      case 'back':
      case 'forward':
      case 'reload': {
        const before = page.url();
        const response = action.type === 'back'
          ? await page.goBack({ waitUntil: 'domcontentloaded', timeout: 15_000 })
          : action.type === 'forward'
            ? await page.goForward({ waitUntil: 'domcontentloaded', timeout: 15_000 })
            : await page.reload({ waitUntil: 'domcontentloaded', timeout: 15_000 });
        if (!response && action.type !== 'reload') throw new ExecutorError('NO_HISTORY');
        return {
          ...base, ok: true, url: page.url(), title: await page.title(),
          verification: { status: 'passed', checks: { url_before: before, url_after: page.url() } },
        };
      }
      case 'download': {
        const inspector = this.opts.downloads;
        if (!inspector) throw new ExecutorError('UNSUPPORTED_ACTION');
        const selector = validateSelector(action.selector);
        this.expectingDownload = true;
        try {
          const [download] = await Promise.all([
            page.waitForEvent('download', { timeout: 20_000 }),
            page.locator(selector).first().click({ timeout: 10_000 }),
          ]);
          const info = await inspector.inspect(download);
          return {
            ...base, ok: true, url: page.url(), title: await page.title(),
            download: { filename: download.suggestedFilename().slice(0, 200), bytes: info.bytes, sha256: info.sha256, mime: null },
            verification: { status: 'passed', checks: { bytes: info.bytes, stored: false } },
          };
        } finally {
          this.expectingDownload = false;
        }
      }
      default:
        throw new ExecutorError('UNSUPPORTED_ACTION');
    }
  }

  /** Aktionen nacheinander; Landeprüfung nach jeder, Abbruch beim ersten Fehler. */
  private async runActions(actions: readonly BrowserAction[]): Promise<BrowserActionResult[]> {
    const results: BrowserActionResult[] = [];
    for (const [index, action] of actions.entries()) {
      this.blockedDownloads = 0;
      this.blockedNavigations = 0;
      let result: BrowserActionResult;
      try {
        result = await this.runAction(action, index);
      } catch (error) {
        const code = errorCode(error);
        if (NETGUARD_CODES.has(code)) throw new ExecutorError(code, code === 'PRIVATE_NETWORK_BLOCKED' ? 403 : 400);
        if (code === 'SESSION_CLOSED') {
          await this.close();
          throw new ExecutorError('SESSION_NOT_FOUND', 404);
        }
        result = {
          index,
          type: action.type,
          ok: false,
          url: (await this.page()).url(),
          error: code,
          verification: { status: 'failed', checks: { error: code } },
        };
      }
      if (this.blockedDownloads > 0) result.verification.checks.downloads_blocked = this.blockedDownloads;
      if (this.blockedNavigations > 0) result.verification.checks.navigations_blocked = this.blockedNavigations;
      // Unterframes (iframes) fertig laden lassen, damit ihre Adressen geprüft
      // sind — begrenzt, eine Seite ohne load-Ereignis hält nicht auf.
      await (await this.page()).waitForLoadState('load', { timeout: 2_000 }).catch(() => undefined);
      const landed = await this.enforceLanding();
      if (landed) {
        // Die Aktion lief, die Seite landete auf einer gesperrten Adresse:
        // kein Text, kein DOM, kein Bild davon — nur der Ursprung als Nachweis.
        results.push(landedResult(index, action.type, landed));
        break;
      }
      results.push(result);
      if (!result.ok) break;
    }
    return results;
  }

  /**
   * Aktionen ausführen. Reihenfolge: Seitenbindung (expected_url) →
   * Landeprüfung → Aktion → Landeprüfung → Frame. Gesperrte Ziele einer
   * navigate-Aktion brechen die ganze Anfrage ab (nichts ausgeführt).
   */
  async execute(req: BrowserExecuteRequest): Promise<ExecuteOutput> {
    return this.run(async () => {
      // Erst die Landeprüfung: eine selbstständig auf eine gesperrte Adresse
      // gewechselte Seite wird zurückgesetzt, ihre URL nie als „aktuelle Seite“
      // gemeldet. Nichts ausgeführt.
      const before = await this.enforceLanding();
      if (before) throw new ExecutorError('LANDED_ON_BLOCKED_URL', 403, { blocked_origin: before });
      if (typeof req.expected_url === 'string' && req.expected_url.length > 0) {
        const live = (await this.page()).url();
        if (live !== req.expected_url) {
          throw new ExecutorError('PAGE_CHANGED', 409, { current_url: live.slice(0, 2048) });
        }
      }

      // Zustandsändernde Navigation nur während einer freigegebenen Aktion.
      this.allowStateChangingNavigation = typeof req.expected_url === 'string' && req.expected_url.length > 0;
      let results: BrowserActionResult[];
      try {
        results = await this.runActions(req.actions);
      } finally {
        this.allowStateChangingNavigation = false;
      }
      let frame = req.include_frame ? await this.captureFrame().catch(() => null) : null;
      // Nach dem Bild erneut prüfen (spät geladene Frames): sonst kein Bild,
      // und das Ergebnis meldet die gesperrte Landung.
      const late = await this.enforceLanding();
      if (late) {
        frame = null;
        const last = results[results.length - 1];
        if (last && last.error !== 'LANDED_ON_BLOCKED_URL') results[results.length - 1] = landedResult(last.index, last.type, late);
      }
      return { results, page: await this.pageInfo(), frame };
    });
  }
}
