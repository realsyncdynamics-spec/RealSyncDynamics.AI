import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';
import type { BrowserContext, Page, Route } from 'playwright';

export type BrowserAction =
  | { type: 'navigate'; url: string }
  | { type: 'scroll'; direction: 'up' | 'down'; amount?: number }
  | { type: 'click'; selector: string }
  | { type: 'type'; selector: string; text: string }
  | { type: 'select'; selector: string; value: string }
  | { type: 'extract'; selector?: string }
  | { type: 'wait'; milliseconds: number }
  | { type: 'screenshot' };

export interface BrowserExecuteRequest {
  session_id: string;
  actions: BrowserAction[];
}

export interface BrowserActionResult {
  index: number;
  type: BrowserAction['type'];
  ok: boolean;
  url: string;
  title?: string;
  text?: string;
  screenshot_base64?: string;
  error?: string;
}

interface BrowserLike {
  newContext(options: Record<string, unknown>): Promise<BrowserContext>;
}

interface SessionState {
  context: BrowserContext;
  page: Page;
  lastUsedAt: number;
}

const SESSION_TTL_MS = 15 * 60 * 1000;
const MAX_SESSIONS = 50;
const MAX_ACTIONS = 25;
const MAX_TEXT_LENGTH = 10_000;
const MAX_SELECTOR_LENGTH = 1_000;
const MAX_WAIT_MS = 5_000;
const sessions = new Map<string, SessionState>();
const hostCache = new Map<string, { allowed: boolean; expiresAt: number }>();

function isPrivateIp(address: string): boolean {
  const lower = address.toLowerCase();
  if (lower === '::1' || lower === '::' || lower === '0.0.0.0') return true;
  if (lower.startsWith('127.') || lower.startsWith('10.') || lower.startsWith('192.168.')) return true;
  if (lower.startsWith('169.254.')) return true;
  const v4 = lower.match(/^172\.(\d{1,3})\./);
  if (v4) {
    const second = Number(v4[1]);
    if (second >= 16 && second <= 31) return true;
  }
  if (lower.startsWith('fc') || lower.startsWith('fd') || lower.startsWith('fe80:')) return true;
  return false;
}

async function isPublicHost(host: string): Promise<boolean> {
  const key = host.toLowerCase();
  const cached = hostCache.get(key);
  if (cached && cached.expiresAt > Date.now()) return cached.allowed;

  let allowed = true;
  if (key === 'localhost' || key.endsWith('.localhost')) {
    allowed = false;
  } else if (isIP(key)) {
    allowed = !isPrivateIp(key);
  } else {
    try {
      const resolved = await lookup(key, { all: true, verbatim: true });
      allowed = resolved.length > 0 && resolved.every((entry) => !isPrivateIp(entry.address));
    } catch {
      allowed = false;
    }
  }

  hostCache.set(key, { allowed, expiresAt: Date.now() + 60_000 });
  return allowed;
}

async function assertPublicHttpUrl(raw: string): Promise<URL> {
  let url: URL;
  try { url = new URL(raw); } catch { throw new Error('INVALID_URL'); }
  if (!['http:', 'https:'].includes(url.protocol)) throw new Error('INVALID_URL');
  if (url.username || url.password) throw new Error('URL_CREDENTIALS_NOT_ALLOWED');
  if (!(await isPublicHost(url.hostname))) throw new Error('PRIVATE_NETWORK_BLOCKED');
  return url;
}

async function routeGuard(route: Route): Promise<void> {
  const raw = route.request().url();
  let url: URL;
  try { url = new URL(raw); } catch {
    await route.abort('blockedbyclient');
    return;
  }
  if (!['http:', 'https:'].includes(url.protocol)) {
    await route.continue();
    return;
  }
  if (!(await isPublicHost(url.hostname))) {
    await route.abort('blockedbyclient');
    return;
  }
  await route.continue();
}

function validateSelector(selector: string): void {
  if (!selector || selector.length > MAX_SELECTOR_LENGTH) throw new Error('INVALID_SELECTOR');
}

async function pruneSessions(): Promise<void> {
  const now = Date.now();
  for (const [id, state] of sessions) {
    if (now - state.lastUsedAt > SESSION_TTL_MS) {
      sessions.delete(id);
      await state.context.close().catch(() => undefined);
    }
  }
  if (sessions.size <= MAX_SESSIONS) return;
  const oldest = [...sessions.entries()].sort((a, b) => a[1].lastUsedAt - b[1].lastUsedAt);
  while (sessions.size > MAX_SESSIONS && oldest.length > 0) {
    const item = oldest.shift();
    if (!item) break;
    const [id, state] = item;
    sessions.delete(id);
    await state.context.close().catch(() => undefined);
  }
}

export async function executeBrowserActions(
  browser: BrowserLike,
  input: BrowserExecuteRequest,
): Promise<BrowserActionResult[]> {
  if (!input.session_id || input.session_id.length > 200) throw new Error('INVALID_SESSION');
  if (!Array.isArray(input.actions) || input.actions.length === 0 || input.actions.length > MAX_ACTIONS) {
    throw new Error('INVALID_ACTIONS');
  }

  await pruneSessions();
  let state = sessions.get(input.session_id);
  if (!state) {
    const context = await browser.newContext({
      viewport: { width: 1440, height: 900 },
      locale: 'de-DE',
      timezoneId: 'Europe/Berlin',
      ignoreHTTPSErrors: false,
    });
    await context.route('**/*', routeGuard);
    const page = await context.newPage();
    state = { context, page, lastUsedAt: Date.now() };
    sessions.set(input.session_id, state);
  }
  state.lastUsedAt = Date.now();

  const page = state.page;
  const results: BrowserActionResult[] = [];

  for (const [index, action] of input.actions.entries()) {
    try {
      switch (action.type) {
        case 'navigate': {
          const target = await assertPublicHttpUrl(action.url);
          await page.goto(target.toString(), { waitUntil: 'domcontentloaded', timeout: 30_000 });
          break;
        }
        case 'scroll': {
          const amount = Math.min(Math.max(action.amount ?? 700, 1), 5_000);
          const delta = action.direction === 'up' ? -amount : amount;
          await page.evaluate(`window.scrollBy(0, ${delta})`);
          break;
        }
        case 'click':
          validateSelector(action.selector);
          await page.locator(action.selector).first().click({ timeout: 10_000 });
          break;
        case 'type':
          validateSelector(action.selector);
          if (action.text.length > MAX_TEXT_LENGTH) throw new Error('TEXT_TOO_LONG');
          await page.locator(action.selector).first().fill(action.text, { timeout: 10_000 });
          break;
        case 'select':
          validateSelector(action.selector);
          await page.locator(action.selector).first().selectOption(action.value, { timeout: 10_000 });
          break;
        case 'extract': {
          const text = action.selector
            ? await page.locator(action.selector).first().innerText({ timeout: 10_000 })
            : await page.locator('body').innerText({ timeout: 10_000 });
          results.push({
            index,
            type: action.type,
            ok: true,
            url: page.url(),
            title: await page.title(),
            text: text.slice(0, 50_000),
          });
          continue;
        }
        case 'wait':
          await page.waitForTimeout(Math.min(Math.max(action.milliseconds, 0), MAX_WAIT_MS));
          break;
        case 'screenshot': {
          const png = await page.screenshot({ type: 'png', fullPage: false });
          results.push({
            index,
            type: action.type,
            ok: true,
            url: page.url(),
            title: await page.title(),
            screenshot_base64: png.toString('base64'),
          });
          continue;
        }
      }

      results.push({
        index,
        type: action.type,
        ok: true,
        url: page.url(),
        title: await page.title(),
      });
    } catch (error) {
      results.push({
        index,
        type: action.type,
        ok: false,
        url: page.url(),
        error: error instanceof Error ? error.message : String(error),
      });
      break;
    }
  }

  return results;
}
