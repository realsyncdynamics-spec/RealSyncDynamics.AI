// Governed Browser Runtime — HTTP-Client zum Executor (deploy/playwright-scanner).
// Rein bis auf das injizierte fetch (vitest-testbar mit Fake-Executor).
//
// Der Executor ist eine isolierte Headless-Chromium-Runtime. Er entscheidet
// nichts über Governance; er bekommt nur Aktionen, die evaluateBrowserAction()
// freigegeben hat, und die Session-ID aus browser_sessions.executor_session_id.
// Der API-Key verlässt die Edge Function nie und wird nie geloggt.

import { BrowserRuntimeError, safeErrorCode } from './errors.ts';
import type { BrowserAction, BrowserActionType } from './actions.ts';

export type ExecutorStatus = 'offline' | 'connecting' | 'ready' | 'busy' | 'degraded' | 'error';

export interface ExecutorHealth {
  executor_id: string;
  status: ExecutorStatus;
  /** Warum nicht ready — z. B. EXECUTOR_NOT_CONFIGURED, EXECUTOR_UNREACHABLE. */
  reason_code: string | null;
  checked_at: string;
  runtime: string | null;
  version: string | null;
  browser_version: string | null;
  active_sessions: number | null;
  max_sessions: number | null;
  capabilities: string[];
}

export interface ExecutorPage {
  url: string;
  title: string;
  loading: boolean;
}

export interface ExecutorFrame {
  mime: 'image/jpeg' | 'image/png';
  base64: string;
  sha256: string;
  bytes: number;
  captured_at: string;
}

export interface ExecutorActionResult {
  type: BrowserActionType;
  ok: boolean;
  url: string;
  title?: string;
  text?: string;
  dom?: unknown;
  screenshot?: { sha256: string; bytes: number; base64?: string };
  download?: { filename: string; bytes: number; sha256: string; mime: string | null };
  verification?: { status: 'passed' | 'failed' | 'not_applicable'; checks: Record<string, unknown> };
  error?: string;
}

export interface ExecutorExecuteResult {
  result: ExecutorActionResult;
  page: ExecutorPage | null;
  frame: ExecutorFrame | null;
}

export interface ExecutorConfig {
  baseUrl: string;
  apiKey: string;
  executorId: string;
}

export type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

const TIMEOUTS = { health: 5_000, open: 20_000, frame: 15_000, close: 10_000, execute: 60_000 } as const;

export interface ExecutorClient {
  readonly configured: boolean;
  readonly executorId: string;
  health(): Promise<ExecutorHealth>;
  openSession(executorSessionId: string): Promise<{ page: ExecutorPage | null; frame: ExecutorFrame | null; version: string | null }>;
  frame(executorSessionId: string): Promise<{ page: ExecutorPage | null; frame: ExecutorFrame }>;
  closeSession(executorSessionId: string): Promise<void>;
  /**
   * expectedUrl: die Seite, an die eine Freigabe gebunden ist. Der Executor
   * prüft die LIVE-Seite vor der Aktion; weicht sie ab → PAGE_CHANGED, nichts
   * wird ausgeführt.
   */
  execute(executorSessionId: string, action: BrowserAction, opts?: { expectedUrl?: string | null }): Promise<ExecutorExecuteResult>;
}

function num(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function str(value: unknown, max = 200): string | null {
  return typeof value === 'string' && value.length > 0 ? value.slice(0, max) : null;
}

export function healthFromResponse(
  executorId: string,
  checkedAt: string,
  httpStatus: number | null,
  body: unknown,
): ExecutorHealth {
  const base: ExecutorHealth = {
    executor_id: executorId,
    status: 'offline',
    reason_code: null,
    checked_at: checkedAt,
    runtime: null,
    version: null,
    browser_version: null,
    active_sessions: null,
    max_sessions: null,
    capabilities: [],
  };
  if (httpStatus === null) return { ...base, status: 'offline', reason_code: 'EXECUTOR_UNREACHABLE' };
  if (httpStatus === 401 || httpStatus === 403) return { ...base, status: 'error', reason_code: 'EXECUTOR_AUTH_FAILED' };
  if (httpStatus < 200 || httpStatus >= 300) return { ...base, status: 'error', reason_code: `EXECUTOR_HTTP_${httpStatus}` };

  const b = (body && typeof body === 'object' ? body : {}) as Record<string, unknown>;
  const caps = Array.isArray(b.capabilities) ? b.capabilities.filter((c): c is string => typeof c === 'string').slice(0, 50) : [];
  const active = num(b.active_sessions);
  const max = num(b.max_sessions);
  const out: ExecutorHealth = {
    ...base,
    runtime: str(b.runtime),
    version: str(b.version),
    browser_version: str(b.browser_version),
    active_sessions: active,
    max_sessions: max,
    capabilities: caps,
  };
  if (b.status === 'starting') return { ...out, status: 'connecting', reason_code: 'EXECUTOR_STARTING' };
  if (b.browser_connected === false || b.status === 'degraded') {
    return { ...out, status: 'degraded', reason_code: 'EXECUTOR_BROWSER_DISCONNECTED' };
  }
  if (caps.length === 0) {
    // Alte Executor-Version (nur /health ok): kann keine Sessions/Frames —
    // als degraded melden statt als ready vorzutäuschen.
    return { ...out, status: 'degraded', reason_code: 'EXECUTOR_LEGACY_NO_SESSIONS' };
  }
  if (active !== null && max !== null && max > 0 && active >= max) {
    return { ...out, status: 'busy', reason_code: 'EXECUTOR_AT_CAPACITY' };
  }
  return { ...out, status: 'ready', reason_code: null };
}

export function notConfiguredHealth(executorId: string, checkedAt: string): ExecutorHealth {
  return {
    executor_id: executorId,
    status: 'offline',
    reason_code: 'EXECUTOR_NOT_CONFIGURED',
    checked_at: checkedAt,
    runtime: null,
    version: null,
    browser_version: null,
    active_sessions: null,
    max_sessions: null,
    capabilities: [],
  };
}

function frameFrom(value: unknown): ExecutorFrame | null {
  if (!value || typeof value !== 'object') return null;
  const f = value as Record<string, unknown>;
  if (typeof f.base64 !== 'string' || typeof f.sha256 !== 'string' || !/^[0-9a-f]{64}$/.test(f.sha256)) return null;
  const mime = f.mime === 'image/png' ? 'image/png' : 'image/jpeg';
  return {
    mime,
    base64: f.base64,
    sha256: f.sha256,
    bytes: num(f.bytes) ?? Math.floor((f.base64.length * 3) / 4),
    captured_at: str(f.captured_at, 40) ?? new Date().toISOString(),
  };
}

function pageFrom(value: unknown): ExecutorPage | null {
  if (!value || typeof value !== 'object') return null;
  const p = value as Record<string, unknown>;
  return {
    url: str(p.url, 2048) ?? 'about:blank',
    title: typeof p.title === 'string' ? p.title.slice(0, 500) : '',
    loading: p.loading === true,
  };
}

/** Executor-Fehlercode → Runtime-Fehler. */
export function errorFromExecutor(httpStatus: number, code: string | null, json: Record<string, unknown> = {}): BrowserRuntimeError {
  if (code === 'PAGE_CHANGED') {
    return new BrowserRuntimeError('PAGE_CHANGED', 'the live page differs from the approved page; nothing was executed', {
      executor_code: code,
      current_url: str(json.current_url, 2048),
    });
  }
  if (code === 'LANDED_ON_BLOCKED_URL') {
    // Die Seite stand (Redirect-Hop, selbstständige Navigation) auf einer
    // gesperrten Adresse; der Executor hat sie zurückgesetzt, nichts ausgeführt.
    return new BrowserRuntimeError('URL_BLOCKED', 'the page ended up on a blocked address and was reset; nothing was executed', {
      executor_code: code,
      reason: 'LANDED_ON_NON_PUBLIC_URL',
      blocked_origin: str(json.blocked_origin, 300),
    });
  }
  if (httpStatus === 404 || code === 'SESSION_NOT_FOUND') {
    return new BrowserRuntimeError('SESSION_NOT_FOUND', 'executor session not found', { executor_code: 'SESSION_NOT_FOUND' });
  }
  if (code === 'PRIVATE_NETWORK_BLOCKED' || code === 'INVALID_URL' || code === 'URL_CREDENTIALS_NOT_ALLOWED') {
    return new BrowserRuntimeError('URL_BLOCKED', 'target blocked by executor network guard', { executor_code: code });
  }
  if (code === 'UNSUPPORTED_ACTION') {
    return new BrowserRuntimeError('ACTION_NOT_SUPPORTED', 'action not supported by executor', { executor_code: code });
  }
  if (httpStatus === 429 || code === 'TOO_MANY_SESSIONS') {
    return new BrowserRuntimeError('SESSION_LIMIT_REACHED', 'executor at capacity', { executor_code: code ?? 'HTTP_429' });
  }
  if (httpStatus === 401 || httpStatus === 403) {
    return new BrowserRuntimeError('EXECUTOR_OFFLINE', 'executor rejected credentials', { executor_code: 'EXECUTOR_AUTH_FAILED' });
  }
  return new BrowserRuntimeError('EXECUTION_FAILED', 'executor request failed', { executor_code: safeErrorCode(code, `HTTP_${httpStatus}`) });
}

export function createExecutorClient(
  config: ExecutorConfig | null,
  fetchImpl: FetchLike,
  now: () => Date = () => new Date(),
): ExecutorClient {
  const executorId = config?.executorId ?? 'default';

  async function call(path: string, body: unknown, timeoutMs: number): Promise<{ status: number; json: Record<string, unknown> }> {
    if (!config) throw new BrowserRuntimeError('EXECUTOR_OFFLINE', 'executor not configured', { reason: 'EXECUTOR_NOT_CONFIGURED' });
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetchImpl(`${config.baseUrl.replace(/\/$/, '')}${path}`, {
        method: body === undefined ? 'GET' : 'POST',
        headers: {
          Authorization: `Bearer ${config.apiKey}`,
          ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
        },
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: controller.signal,
      });
      const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
      return { status: res.status, json };
    } catch {
      throw new BrowserRuntimeError('EXECUTOR_OFFLINE', 'executor unreachable', { reason: 'EXECUTOR_UNREACHABLE' });
    } finally {
      clearTimeout(timer);
    }
  }

  // Nur Codes, nie Freitext: Executor-Meldungen können Eingaben enthalten.
  function codeOf(json: Record<string, unknown>): string | null {
    const e = json.error;
    if (typeof e === 'string') return safeErrorCode(e, 'EXECUTOR_ERROR');
    if (e && typeof e === 'object' && typeof (e as { code?: unknown }).code === 'string') {
      return safeErrorCode((e as { code: string }).code, 'EXECUTOR_ERROR');
    }
    return null;
  }

  return {
    configured: config !== null,
    executorId,

    async health() {
      const checkedAt = now().toISOString();
      if (!config) return notConfiguredHealth(executorId, checkedAt);
      try {
        const { status, json } = await call('/health', undefined, TIMEOUTS.health);
        return healthFromResponse(executorId, checkedAt, status, json);
      } catch {
        return healthFromResponse(executorId, checkedAt, null, null);
      }
    },

    async openSession(executorSessionId) {
      const { status, json } = await call('/session/open', { session_id: executorSessionId }, TIMEOUTS.open);
      if (status < 200 || status >= 300 || json.ok !== true) throw errorFromExecutor(status, codeOf(json), json);
      return { page: pageFrom(json.page), frame: frameFrom(json.frame), version: str(json.version) };
    },

    async frame(executorSessionId) {
      const { status, json } = await call('/session/frame', { session_id: executorSessionId }, TIMEOUTS.frame);
      if (status < 200 || status >= 300 || json.ok !== true) throw errorFromExecutor(status, codeOf(json), json);
      const frame = frameFrom(json.frame);
      if (!frame) throw new BrowserRuntimeError('EXECUTION_FAILED', 'executor returned no frame');
      return { page: pageFrom(json.page), frame };
    },

    async closeSession(executorSessionId) {
      const { status, json } = await call('/session/close', { session_id: executorSessionId }, TIMEOUTS.close);
      if ((status < 200 || status >= 300) && status !== 404) throw errorFromExecutor(status, codeOf(json), json);
    },

    async execute(executorSessionId, action, opts) {
      const { status, json } = await call('/execute', {
        session_id: executorSessionId,
        actions: [action],
        require_session: true,
        include_frame: true,
        ...(opts?.expectedUrl ? { expected_url: opts.expectedUrl } : {}),
      }, TIMEOUTS.execute);
      if (status < 200 || status >= 300 || json.ok !== true) throw errorFromExecutor(status, codeOf(json), json);
      const results = Array.isArray(json.results) ? json.results : [];
      const raw = (results[0] ?? {}) as Record<string, unknown>;
      const result: ExecutorActionResult = {
        type: action.type,
        ok: raw.ok === true,
        url: str(raw.url, 2048) ?? 'about:blank',
        ...(typeof raw.title === 'string' ? { title: raw.title.slice(0, 500) } : {}),
        ...(typeof raw.text === 'string' ? { text: raw.text.slice(0, 50_000) } : {}),
        ...(raw.dom !== undefined ? { dom: raw.dom } : {}),
        ...(raw.screenshot && typeof raw.screenshot === 'object' ? { screenshot: raw.screenshot as ExecutorActionResult['screenshot'] } : {}),
        ...(raw.download && typeof raw.download === 'object' ? { download: raw.download as ExecutorActionResult['download'] } : {}),
        ...(raw.verification && typeof raw.verification === 'object'
          ? { verification: raw.verification as ExecutorActionResult['verification'] }
          : {}),
        ...(typeof raw.error === 'string' ? { error: safeErrorCode(raw.error, 'ACTION_FAILED') } : {}),
      };
      return { result, page: pageFrom(json.page), frame: frameFrom(json.frame) };
    },
  };
}
