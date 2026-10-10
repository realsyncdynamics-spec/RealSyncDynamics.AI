// Durable-Object-Logik: genau EINE Executor-Session (browser_sessions.
// executor_session_id) = ein Durable Object = ein Browser-Run-Browser mit
// einem Kontext und einer aktiven Seite (GuardedSession aus session-core.ts —
// derselbe Aktions- und Sicherheitskern wie im Node-Executor).
//
// Lebensdauer:
//   - Alarm alle 10 s hält das Objekt im Speicher und prüft Leerlauf (15 min)
//     und Höchstalter (60 min) — dieselben Fristen wie Node und browser-execute.
//   - Browser Run schließt einen Browser nach höchstens 10 min ohne Befehl;
//     ein Lebenszeichen alle 4 min hält ihn, solange UNSERE Fristen laufen
//     (zählt nicht als Nutzung, verlängert also keine Frist).
//   - Geht das Objekt verloren (Neustart/Verdrängung), wird die Session NIE
//     still wiederbelebt: SESSION_NOT_FOUND, der verwaiste Browser wird über
//     die gespeicherte Browser-Run-Session-ID geschlossen (fail closed).
//
// Alles Plattformspezifische ist injiziert (BrowserRunPort, StorageLike,
// SessionFactory) — testbar mit Fakes, ohne Browser.

import type { BrowserContext, BrowserContextOptions } from 'playwright';
import {
  ExecutorError,
  LIMITS,
  contextOptions,
  validateRequest,
  type BrowserExecuteRequest,
  type ExecuteOutput,
  type Frame,
  type PageInfo,
} from '../../../deploy/playwright-scanner/session-core.js';
import { ALARM_INTERVAL_MS, EXECUTOR_VERSION, PING_INTERVAL_MS, type StorageLike } from './env.js';
import type { BrowserRunLimits } from './health.js';
import { errorResponse, json, sessionIdOf } from './http.js';

/** Was der Kern von einem Browser-Run-Browser braucht. */
export interface BrowserLike {
  newContext(options: BrowserContextOptions): Promise<BrowserContext>;
  close(): Promise<void>;
  /** Browser-Run-Session-ID (für das Aufräumen nach Verlust des Objekts). */
  sessionId(): string | undefined;
}

export interface BrowserRunPort {
  launch(): Promise<BrowserLike>;
  connect(browserSessionId: string): Promise<BrowserLike>;
  limits(): Promise<BrowserRunLimits>;
}

/** Ausschnitt aus GuardedSession, den das Objekt nutzt. */
export interface SessionLike {
  readonly createdAt: number;
  readonly lastUsedAt: number;
  readonly closed: boolean;
  touch(): void;
  run<T>(fn: () => Promise<T>): Promise<T>;
  execute(req: BrowserExecuteRequest): Promise<ExecuteOutput>;
  frame(): Promise<{ page: PageInfo; frame: Frame }>;
  pageInfo(): Promise<PageInfo>;
  close(): Promise<void>;
}

export interface SessionFactory {
  open(context: BrowserContext): Promise<SessionLike>;
}

export interface ExecutorSessionDeps {
  storage: StorageLike;
  browserRun: BrowserRunPort;
  sessions: SessionFactory;
  maxSessions: number;
  now?: () => number;
  log?: (event: Record<string, unknown>) => void;
}

const KEY_BROWSER = 'browser_session_id';
const KEY_OPENED = 'opened_at';

export class ExecutorSessionCore {
  private browser: BrowserLike | null = null;
  private session: SessionLike | null = null;
  private opening: Promise<SessionLike> | null = null;
  private lastPingAt = 0;
  private readonly now: () => number;
  private readonly log: (event: Record<string, unknown>) => void;

  constructor(private readonly deps: ExecutorSessionDeps) {
    this.now = deps.now ?? (() => Date.now());
    this.log = deps.log ?? (() => undefined);
  }

  async fetch(request: Request): Promise<Response> {
    const path = new URL(request.url).pathname;
    try {
      const body: unknown = request.method === 'POST' ? await request.json().catch(() => null) : null;
      switch (path) {
        case '/open': return json(200, await this.open(sessionIdOf(body)));
        case '/frame': return json(200, { ok: true, session_id: sessionIdOf(body), ...(await this.frame()) });
        case '/close': return await this.close(sessionIdOf(body));
        case '/execute': return json(200, { ok: true, session_id: sessionIdOf(body), ...(await this.execute(body)) });
        default: return json(404, { ok: false, error: 'NOT_FOUND' });
      }
    } catch (err) {
      return errorResponse(err, this.log);
    }
  }

  private live(): SessionLike | null {
    return this.session && !this.session.closed ? this.session : null;
  }

  /** Verwaister Browser eines verlorenen Objekts: schließen, Spuren löschen. */
  private async reapOrphan(): Promise<boolean> {
    const orphan = await this.deps.storage.get<string>(KEY_BROWSER);
    if (!orphan) return false;
    try {
      const b = await this.deps.browserRun.connect(orphan);
      await b.close();
    } catch {
      // Schon von Browser Run geschlossen (keep_alive abgelaufen) — nichts zu tun.
    }
    await this.deps.storage.delete([KEY_BROWSER, KEY_OPENED]);
    this.log({ event: 'orphan_reaped' });
    return true;
  }

  private async launch(): Promise<SessionLike> {
    await this.reapOrphan();
    const limits = await this.deps.browserRun.limits().catch(() => {
      throw new ExecutorError('EXECUTOR_UNAVAILABLE', 503);
    });
    if (limits.activeSessions.length >= Math.min(this.deps.maxSessions, limits.maxConcurrentSessions)) {
      throw new ExecutorError('TOO_MANY_SESSIONS', 429);
    }
    if (limits.allowedBrowserAcquisitions <= 0) {
      throw new ExecutorError('TOO_MANY_SESSIONS', 429, { retry_after_ms: Math.max(0, limits.timeUntilNextAllowedBrowserAcquisition) });
    }
    const browser = await this.deps.browserRun.launch().catch(() => {
      throw new ExecutorError('EXECUTOR_UNAVAILABLE', 503);
    });
    try {
      // Keine Downloads in dieser Laufzeit (kein prüfbares Dateisystem).
      const context = await browser.newContext(contextOptions(false));
      const session = await this.deps.sessions.open(context);
      this.browser = browser;
      this.session = session;
      this.lastPingAt = this.now();
      await this.deps.storage.put({ [KEY_BROWSER]: browser.sessionId() ?? null, [KEY_OPENED]: this.now() });
      await this.deps.storage.setAlarm(this.now() + ALARM_INTERVAL_MS);
      this.log({ event: 'session_opened' });
      return session;
    } catch (err) {
      await browser.close().catch(() => undefined);
      this.browser = null;
      this.session = null;
      throw err instanceof ExecutorError ? err : new ExecutorError('EXECUTOR_UNAVAILABLE', 503);
    }
  }

  private async open(sessionId: string): Promise<Record<string, unknown>> {
    let session = this.live();
    if (session) {
      session.touch();
    } else {
      // Parallele Öffnungen desselben Objekts teilen sich einen Start.
      this.opening ??= this.launch().finally(() => { this.opening = null; });
      session = await this.opening;
    }
    let page: PageInfo | null = null;
    let frame: Frame | null = null;
    try {
      ({ page, frame } = await session.run(() => session!.frame()));
    } catch (err) {
      // Kein Bild ist kein Fehler beim Öffnen; eine verlorene Session schon.
      if (err instanceof ExecutorError && err.code === 'SESSION_NOT_FOUND') throw err;
      page = await session.run(() => session!.pageInfo());
    }
    return { ok: true, session_id: sessionId, version: EXECUTOR_VERSION, page, frame };
  }

  /** Bestehende Session oder SESSION_NOT_FOUND — nie still neu angelegt. */
  private async require(): Promise<SessionLike> {
    const session = this.live();
    if (session) return session;
    await this.reapOrphan();
    throw new ExecutorError('SESSION_NOT_FOUND', 404);
  }

  private async frame(): Promise<{ page: PageInfo; frame: Frame }> {
    const session = await this.require();
    try {
      return await session.run(() => session.frame());
    } finally {
      if (session.closed) await this.shutdown('closed_by_core');
    }
  }

  private async execute(raw: unknown): Promise<ExecuteOutput> {
    const req = validateRequest(raw);
    const session = req.require_session === false && !this.live()
      ? await (this.opening ??= this.launch().finally(() => { this.opening = null; }))
      : await this.require();
    try {
      return await session.execute(req);
    } finally {
      if (session.closed) await this.shutdown('closed_by_core');
    }
  }

  private async close(sessionId: string): Promise<Response> {
    const had = this.live() !== null || (await this.deps.storage.get<string>(KEY_BROWSER)) !== undefined;
    await this.shutdown('closed');
    return had
      ? json(200, { ok: true, session_id: sessionId, closed: true })
      : json(404, { ok: false, error: 'SESSION_NOT_FOUND' });
  }

  /** Session, Browser und gespeicherte Spuren beenden; Alarm aus. */
  private async shutdown(reason: string): Promise<void> {
    const session = this.session;
    const browser = this.browser;
    this.session = null;
    this.browser = null;
    if (session) await session.close().catch(() => undefined);
    if (browser) await browser.close().catch(() => undefined);
    else await this.reapOrphan();
    await this.deps.storage.delete([KEY_BROWSER, KEY_OPENED]);
    await this.deps.storage.deleteAlarm();
    this.log({ event: 'session_closed', reason });
  }

  /** Alarm: Fristen prüfen, Browser am Leben halten, Objekt im Speicher halten. */
  async alarm(): Promise<void> {
    const session = this.live();
    if (!session) {
      // Neustart des Objekts oder Session schon zu: Verwaisten Browser schließen.
      await this.shutdown('no_live_session');
      return;
    }
    const now = this.now();
    if (now - session.lastUsedAt > LIMITS.sessionIdleTtlMs) {
      await this.shutdown('idle_timeout');
      return;
    }
    if (now - session.createdAt > LIMITS.sessionMaxAgeMs) {
      await this.shutdown('max_age');
      return;
    }
    if (now - this.lastPingAt >= PING_INTERVAL_MS) {
      this.lastPingAt = now;
      // Ohne run(): ein Lebenszeichen ist keine Nutzung und verlängert keine Frist.
      await session.pageInfo().catch(() => undefined);
    }
    await this.deps.storage.setAlarm(now + ALARM_INTERVAL_MS);
  }
}
