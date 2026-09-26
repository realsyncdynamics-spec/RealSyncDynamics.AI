import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';
import type { BrowserContext, Page } from 'playwright';
import { getBrowser } from './scanner.js';

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

function isPrivateIp(address: string): boolean {
  if (address === '::1' || address === '0.0.0.0' || address === '::') return true;
  if (address.startsWith('127.') || address.startsWith('10.') || address.startsWith('192.168.')) return true;
  const v4 = address.match(/^172\.(\d{1,3})\./);
  if (v4) {
    const second = Number(v4[1]);
    if (second >= 16 && second <= 31) return true;
  }
  if (address.startsWith('169.254.')) return true;
  const lower = address.toLowerCase();
  if (lower.startsWith('fc') || lower.startsWith('fd') || lower.startsWith('fe80:')) return true;
  return false;
}

async function assertPublicHttpUrl(raw: string): Promise<URL> {
  let url: URL;
  try { url = new URL(raw); } catch { throw new Error('INVALID_URL'); }
  if (!['http:', 'https:'].includes(url.protocol)) throw new Error('INVALID_URL');
  if (url.username || url.password) throw new Error('URL_CREDENTIALS_NOT_ALLOWED');
  const host = url.hostname.toLowerCase();
  if (host === 'localhost' || host.endsWith('.localhost')) throw new Error('PRIVATE_NETWORK_BLOCKED');
  if (isIP(host) && isPrivateIp(host)) throw new Error('PRIVATE_NETWORK_BLOCKED');
  if (!isIP(host)) {
    const resolved = await lookup(host, { all: true, verbatim: true });
    if (resolved.length === 0 || resolved.some((entry) => isPrivateIp(entry.address))) {
      throw new Error('PRIVATE_NETWORK_BLOCKED');
    }
  }
  return url;
}

function validateSelector(selector: string): void {
  if (!selector || selector.length > MAX_SELECTOR_LENGTH) throw new Error('INVALID_SELECTOR');
}

async function pruneSessions(): Promise<void> {
  const now = Date.now();
  for (const [id, state] of sessions) {
    if (now - state.lastUsedAt > SESSION_TTL_MS) {
      sessions.delete(id);
      await state.context.close().catch(() => {});
    }
  }
  if (sessions.size <= MAX_SESSIONS) return;
  const oldest = [...sessions.entries()].sort((a, b) => a[1].lastUsedAt - b[1].lastUsedAt);
  while (sessions.size > MAX_SESSIONS && oldest.length > 0) {
    const [id, state] = oldest.shift()!;
    sessions.delete(id);
    await state.context.close().catch(() => {});
  }
}

async function getSession(sessionId: string): Promise<SessionState> {
  await pruneSessions();
  const existing = sessions.get(sessionId);
  if (existing) {
    existing.lastUsedAt = Date.now();
    return existing;
  }
  const browser = await getBrowser();
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    locale: 'de-DE',
    timezoneId: 'Europe/Berlin',
    ignoreHTTPSErrors: false,
  });
  const page = await context.newPage();
  const state = { context, page, lastUsedAt: Date.now() };
  sessions.set(sessionId, state);
  return state;
}

export async function executeBrowserActions(input: BrowserExecuteRequest): Promise<BrowserActionResult[]> {
  if (!input.session_id || input.session_id.length > 200) throw new Error('INVALID_SESSION');
  if (!Array.isArray(input.actions) || input.actions.length === 0 || input.actions.length > MAX_ACTIONS) {
    throw new Error('INVALID_ACTIONS');
  }

  const { page } = await getSession(input.session_id);
  const results: BrowserActionResult[] = [];

  for (let index = 0; index < input.actions.length; index++) {
    const action = input.actions[index];
    try {
      if (action.type === 'navigate') {
        const url = await assertPublicHttpUrl(action.url);
        await page.goto(url.toString(), { waitUntil: 'domcontentloaded', timeout: 30_000 });
      } else if (action.type === 'scroll') {
        const amount = Math.min(Math.max(action.amount ?? 700, 1), 5000);
        const delta = action.direction === 'up' ? -amount : amount;
        await page.evaluate((y) => globalThis.scrollBy(0, y), delta);
      } else if (action.type === 'click') {
        validateSelector(action.selector);
        await page.locator(action.selector).first().click({ timeout: 10_000 });
      } else if (action.type === 'type') {
        validateSelector(action.selector);
        if (action.text.length > MAX_TEXT_LENGTH) throw new Error('TEXT_TOO_LONG');
        await page.locator(action.selector).first().fill(action.text, { timeout: 10_000 });
      } else if (action.type === 'select') {
        validateSelector(action.selector);
        await page.locator(action.selector).first().selectOption(action.value, { timeout: 10_000 });
      } else if (action.type === 'extract') {
        const text = action.selector
          ? await page.locator(action.selector).first().innerText({ timeout: 10_000 })
          : await page.locator('body').innerText({ timeout: 10_000 });
        results.push({ index, type: action.type, ok: true, url: page.url(), title: await page.title(), text: text.slice(0, 50_000) });
        continue;
      } else if (action.type === 'wait') {
        await page.waitForTimeout(Math.min(Math.max(action.milliseconds, 0), MAX_WAIT_MS));
      } else if (action.type === 'screenshot') {
        const png = await page.screenshot({ type: 'png', fullPage: false });
        results.push({ index, type: action.type, ok: true, url: page.url(), title: await page.title(), screenshot_base64: png.toString('base64') });
        continue;
      } else {
        throw new Error('UNSUPPORTED_ACTION');
      }

      results.push({ index, type: action.type, ok: true, url: page.url(), title: await page.title() });
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
