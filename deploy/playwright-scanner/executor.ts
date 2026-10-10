// Governed Browser Executor — Node-Laufzeit (Container, server.ts).
//
// Der Aktions-/Sicherheitskern liegt laufzeitneutral in session-core.ts und
// wird vom Cloudflare-Executor (workers/browser-run-executor) mitbenutzt.
// Hier nur, was Node-spezifisch ist: Session-Verwaltung im Prozess
// (Kapazität, Leerlauf/Höchstalter) und die Prüfung erwarteter Downloads auf
// der lokalen Platte.

import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import type { Browser, Download } from 'playwright';
import type { HostGuard } from './netguard.js';
import {
  BASE_CAPABILITIES,
  ExecutorError,
  GuardedSession,
  LIMITS,
  contextOptions,
  validateRequest,
  type DownloadInspector,
  type ExecuteOutput,
} from './session-core.js';

export {
  ExecutorError,
  LIMITS,
  type BrowserAction,
  type BrowserActionResult,
  type BrowserExecuteRequest,
  type Frame,
  type PageInfo,
  type Verification,
} from './session-core.js';

/** Node prüft Downloads (Größe, Hash) — deshalb zusätzlich 'download'. */
export const EXECUTOR_CAPABILITIES = [...BASE_CAPABILITIES, 'download'] as const;

async function fileSha256(path: string): Promise<string> {
  return await new Promise((resolve, reject) => {
    const hash = createHash('sha256');
    createReadStream(path).on('data', (c) => hash.update(c)).on('end', () => resolve(hash.digest('hex'))).on('error', reject);
  });
}

/** Erwarteter Download: Größe + Hash, danach gelöscht (nichts wird gespeichert). */
export const nodeDownloadInspector: DownloadInspector = {
  async inspect(download: Download) {
    const path = await download.path();
    const info = await stat(path);
    if (info.size > LIMITS.maxDownloadBytes) {
      await download.delete().catch(() => undefined);
      throw new ExecutorError('DOWNLOAD_TOO_LARGE');
    }
    const digest = await fileSha256(path);
    await download.delete().catch(() => undefined);
    return { bytes: info.size, sha256: digest };
  },
};

export class SessionRegistry {
  private readonly sessions = new Map<string, GuardedSession>();

  constructor(
    private readonly getBrowser: () => Promise<Browser>,
    private readonly guard: HostGuard,
    readonly maxSessions: number,
    private readonly now: () => number = () => Date.now(),
    private readonly log: (event: Record<string, unknown>) => void = () => undefined,
  ) {}

  get activeSessions(): number {
    return this.sessions.size;
  }

  has(id: string): boolean {
    const s = this.sessions.get(id);
    if (s?.closed) this.sessions.delete(id);
    return this.sessions.has(id);
  }

  async prune(): Promise<void> {
    const now = this.now();
    for (const [id, s] of this.sessions) {
      if (s.closed || now - s.lastUsedAt > LIMITS.sessionIdleTtlMs || now - s.createdAt > LIMITS.sessionMaxAgeMs) {
        this.sessions.delete(id);
        await s.close();
      }
    }
  }

  async open(id: string): Promise<GuardedSession> {
    if (typeof id !== 'string' || id.length < 16 || id.length > 200) throw new ExecutorError('INVALID_SESSION');
    await this.prune();
    const existing = this.sessions.get(id);
    if (existing && !existing.closed) {
      existing.touch();
      return existing;
    }
    if (this.sessions.size >= this.maxSessions) throw new ExecutorError('TOO_MANY_SESSIONS', 429);
    const browser = await this.getBrowser();
    const context = await browser.newContext(contextOptions(true));
    const session = await GuardedSession.open(context, {
      guard: this.guard,
      downloads: nodeDownloadInspector,
      now: this.now,
      log: this.log,
    }).catch(async (error) => {
      await context.close().catch(() => undefined);
      throw error;
    });
    this.sessions.set(id, session);
    return session;
  }

  get(id: string): GuardedSession {
    const s = this.sessions.get(id);
    if (!s || s.closed) {
      this.sessions.delete(id);
      throw new ExecutorError('SESSION_NOT_FOUND', 404);
    }
    return s;
  }

  async close(id: string): Promise<boolean> {
    const s = this.sessions.get(id);
    if (!s) return false;
    this.sessions.delete(id);
    await s.close();
    return true;
  }

  async closeAll(): Promise<void> {
    for (const id of [...this.sessions.keys()]) await this.close(id);
  }

  async execute(raw: unknown): Promise<ExecuteOutput> {
    const req = validateRequest(raw);
    if (req.require_session && !this.has(req.session_id)) throw new ExecutorError('SESSION_NOT_FOUND', 404);
    const session = this.has(req.session_id) ? this.get(req.session_id) : await this.open(req.session_id);
    try {
      return await session.execute(req);
    } finally {
      if (session.closed) this.sessions.delete(req.session_id);
    }
  }
}
