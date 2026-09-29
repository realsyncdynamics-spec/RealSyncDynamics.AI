// Governed Browser Executor — Sessions, Aktionen, Frames.
//
// Der Executor entscheidet nichts über Governance: Er führt nur aus, was die
// Edge Function browser-execute nach Policy/Approval/Evidence freigegeben
// hat, und liefert überprüfbare Ergebnisse (Verifikation, Frame-Hash).
//
// Session-Modell: eine Session-ID (browser_sessions.executor_session_id) =
// genau ein BrowserContext mit genau einer aktiven Page. Dieselbe Session
// liefert Aktionen UND Vorschau-Frames — die Vorschau ist ein Bild derselben
// Chromium-Session, keine zweite Seite und keine Animation.

import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import type { Browser, BrowserContext, Page, Route } from 'playwright';
import { assertNavigable, type HostGuard } from './netguard.js';

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

export const EXECUTOR_CAPABILITIES = [
  'sessions', 'frame',
  'navigate', 'scroll', 'click', 'type', 'select', 'submit', 'wait',
  'read_text', 'read_dom', 'screenshot', 'back', 'forward', 'reload', 'download',
] as const;

export interface BrowserExecuteRequest {
  session_id: string;
  actions: BrowserAction[];
  /** true: unbekannte Session → SESSION_NOT_FOUND statt stiller Neuanlage. */
  require_session?: boolean;
  include_frame?: boolean;
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

interface SessionState {
  context: BrowserContext;
  page: Page;
  createdAt: number;
  lastUsedAt: number;
  queue: Promise<unknown>;
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
  constructor(readonly code: string, readonly status = 400) {
    super(code);
    this.name = 'ExecutorError';
  }
}

function sha256(buf: Buffer): string {
  return createHash('sha256').update(buf).digest('hex');
}

async function fileSha256(path: string): Promise<string> {
  return await new Promise((resolve, reject) => {
    const hash = createHash('sha256');
    createReadStream(path).on('data', (c) => hash.update(c)).on('end', () => resolve(hash.digest('hex'))).on('error', reject);
  });
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

function validateSelector(selector: unknown): string {
  if (typeof selector !== 'string' || selector.length === 0 || selector.length > LIMITS.maxSelectorLength) {
    throw new ExecutorError('INVALID_SELECTOR');
  }
  if (/^\s*(javascript|js)\s*[:=]/i.test(selector)) throw new ExecutorError('INVALID_SELECTOR');
  return selector;
}

export class SessionRegistry {
  private readonly sessions = new Map<string, SessionState>();

  constructor(
    private readonly getBrowser: () => Promise<Browser>,
    private readonly guard: HostGuard,
    readonly maxSessions: number,
    private readonly now: () => number = () => Date.now(),
  ) {}

  get activeSessions(): number {
    return this.sessions.size;
  }

  has(id: string): boolean {
    return this.sessions.has(id);
  }

  async prune(): Promise<void> {
    const now = this.now();
    for (const [id, s] of this.sessions) {
      if (now - s.lastUsedAt > LIMITS.sessionIdleTtlMs || now - s.createdAt > LIMITS.sessionMaxAgeMs) {
        this.sessions.delete(id);
        await s.context.close().catch(() => undefined);
      }
    }
  }

  private async routeGuard(route: Route): Promise<void> {
    let url: URL;
    try { url = new URL(route.request().url()); } catch {
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
    if (!(await this.guard.allows(url.hostname, url.port))) {
      await route.abort('blockedbyclient');
      return;
    }
    await route.continue();
  }

  async open(id: string): Promise<SessionState> {
    if (!id || id.length < 16 || id.length > 200) throw new ExecutorError('INVALID_SESSION');
    await this.prune();
    const existing = this.sessions.get(id);
    if (existing) {
      existing.lastUsedAt = this.now();
      return existing;
    }
    if (this.sessions.size >= this.maxSessions) throw new ExecutorError('TOO_MANY_SESSIONS', 429);
    const browser = await this.getBrowser();
    const context = await browser.newContext({
      viewport: { width: 1280, height: 800 },
      locale: 'de-DE',
      timezoneId: 'Europe/Berlin',
      ignoreHTTPSErrors: false,
      acceptDownloads: true,
      // Service Worker umgehen context.route — deshalb gesperrt.
      serviceWorkers: 'block',
    });
    await context.route('**/*', (route) => this.routeGuard(route));
    const ctx = context as BrowserContext & {
      routeWebSocket?: (url: RegExp, handler: (ws: { url(): string; close(): Promise<void>; connectToServer(): unknown }) => unknown) => Promise<void>;
    };
    if (typeof ctx.routeWebSocket === 'function') {
      await ctx.routeWebSocket(/.*/, async (ws) => {
        let allowed = false;
        try {
          const u = new URL(ws.url());
          allowed = (u.protocol === 'ws:' || u.protocol === 'wss:') && await this.guard.allows(u.hostname, u.port);
        } catch { allowed = false; }
        if (allowed) ws.connectToServer();
        else await ws.close();
      });
    }
    const page = await context.newPage();
    const state: SessionState = { context, page, createdAt: this.now(), lastUsedAt: this.now(), queue: Promise.resolve() };
    // Neue Tabs (target=_blank) werden zur aktiven Seite der Session.
    context.on('page', (p) => { state.page = p; });
    this.sessions.set(id, state);
    return state;
  }

  get(id: string): SessionState {
    const s = this.sessions.get(id);
    if (!s) throw new ExecutorError('SESSION_NOT_FOUND', 404);
    s.lastUsedAt = this.now();
    return s;
  }

  async close(id: string): Promise<boolean> {
    const s = this.sessions.get(id);
    if (!s) return false;
    this.sessions.delete(id);
    await s.context.close().catch(() => undefined);
    return true;
  }

  async closeAll(): Promise<void> {
    for (const id of [...this.sessions.keys()]) await this.close(id);
  }

  /** Serialisiert Arbeit je Session (keine verschränkten Aktionen). */
  async withSession<T>(id: string, fn: (s: SessionState) => Promise<T>): Promise<T> {
    const s = this.get(id);
    const run = s.queue.then(() => fn(s));
    s.queue = run.catch(() => undefined);
    return await run;
  }

  async pageInfo(s: SessionState): Promise<PageInfo> {
    let loading = false;
    try {
      loading = await s.page.evaluate('document.readyState !== "complete"') as boolean;
    } catch { loading = false; }
    return { url: s.page.url(), title: await s.page.title().catch(() => ''), loading };
  }

  async frame(s: SessionState): Promise<Frame> {
    const jpeg = await s.page.screenshot({ type: 'jpeg', quality: LIMITS.frameQuality, fullPage: false });
    return {
      mime: 'image/jpeg',
      base64: jpeg.toString('base64'),
      sha256: sha256(jpeg),
      bytes: jpeg.length,
      captured_at: new Date(this.now()).toISOString(),
    };
  }

  async runAction(s: SessionState, action: BrowserAction, index: number): Promise<BrowserActionResult> {
    const page = s.page;
    const base = { index, type: action.type };
    switch (action.type) {
      case 'navigate': {
        const target = await assertNavigable(action.url, this.guard);
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
        const amount = Math.min(Math.max(action.amount ?? 700, 1), 5_000);
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
        if (s.page !== page) await s.page.waitForLoadState('domcontentloaded', { timeout: 15_000 }).catch(() => undefined);
        return {
          ...base, ok: true, url: s.page.url(), title: await s.page.title(),
          verification: { status: 'passed', checks: { clicked: true, url_changed: s.page.url() !== before } },
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
        const selected = await page.locator(selector).first().selectOption(action.value, { timeout: 10_000 });
        return {
          ...base, ok: true, url: page.url(), title: await page.title(),
          verification: { status: selected.includes(action.value) ? 'passed' : 'failed', checks: { selected } },
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
        return {
          ...base, ok: true, url: s.page.url(), title: await s.page.title(),
          verification: { status: 'passed', checks: { form_found: true, url_changed: s.page.url() !== before } },
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
        }, { rootSelector, maxNodes: LIMITS.maxDomNodes });
        if (!dom) throw new ExecutorError('SELECTOR_NOT_FOUND');
        return {
          ...base, ok: true, url: page.url(), title: await page.title(), dom,
          verification: { status: 'passed', checks: { nodes: (dom as { nodes: unknown[] }).nodes.length } },
        };
      }
      case 'wait': {
        await page.waitForTimeout(Math.min(Math.max(action.milliseconds, 0), LIMITS.maxWaitMs));
        return { ...base, ok: true, url: page.url(), title: await page.title(), verification: { status: 'not_applicable', checks: {} } };
      }
      case 'screenshot': {
        const png = await page.screenshot({ type: 'png', fullPage: false });
        const base64 = png.toString('base64');
        return {
          ...base, ok: true, url: page.url(), title: await page.title(),
          screenshot: { sha256: sha256(png), bytes: png.length, base64 },
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
        const selector = validateSelector(action.selector);
        const [download] = await Promise.all([
          page.waitForEvent('download', { timeout: 20_000 }),
          page.locator(selector).first().click({ timeout: 10_000 }),
        ]);
        const path = await download.path();
        const info = await stat(path);
        if (info.size > LIMITS.maxDownloadBytes) {
          await download.delete().catch(() => undefined);
          throw new ExecutorError('DOWNLOAD_TOO_LARGE');
        }
        const digest = await fileSha256(path);
        await download.delete().catch(() => undefined);
        return {
          ...base, ok: true, url: page.url(), title: await page.title(),
          download: { filename: download.suggestedFilename().slice(0, 200), bytes: info.size, sha256: digest, mime: null },
          verification: { status: 'passed', checks: { bytes: info.size, stored: false } },
        };
      }
      default:
        throw new ExecutorError('UNSUPPORTED_ACTION');
    }
  }

  async execute(req: BrowserExecuteRequest): Promise<{ results: BrowserActionResult[]; page: PageInfo; frame: Frame | null }> {
    if (!req || typeof req.session_id !== 'string') throw new ExecutorError('INVALID_SESSION');
    if (!Array.isArray(req.actions) || req.actions.length === 0 || req.actions.length > LIMITS.maxActions) {
      throw new ExecutorError('INVALID_ACTIONS');
    }
    if (req.require_session && !this.has(req.session_id)) throw new ExecutorError('SESSION_NOT_FOUND', 404);
    if (!this.has(req.session_id)) await this.open(req.session_id);

    return await this.withSession(req.session_id, async (s) => {
      const results: BrowserActionResult[] = [];
      for (const [index, action] of req.actions.entries()) {
        try {
          results.push(await this.runAction(s, action, index));
        } catch (error) {
          const code = error instanceof ExecutorError ? error.code : (error instanceof Error ? error.message : String(error));
          results.push({
            index,
            type: action?.type ?? 'wait',
            ok: false,
            url: s.page.url(),
            error: code.slice(0, 200),
            verification: { status: 'failed', checks: { error: code.slice(0, 200) } },
          });
          if (code === 'PRIVATE_NETWORK_BLOCKED' || code === 'INVALID_URL' || code === 'URL_CREDENTIALS_NOT_ALLOWED') {
            throw new ExecutorError(code, code === 'PRIVATE_NETWORK_BLOCKED' ? 403 : 400);
          }
          break;
        }
      }
      const page = await this.pageInfo(s);
      const frame = req.include_frame ? await this.frame(s).catch(() => null) : null;
      return { results, page, frame };
    });
  }
}
