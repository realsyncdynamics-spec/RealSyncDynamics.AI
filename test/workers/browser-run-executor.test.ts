// @vitest-environment node
/**
 * Cloudflare-Browser-Run-Executor (workers/browser-run-executor) mit Fakes.
 *
 * Geprüft wird die Plattform-Hülle: derselbe HTTP-Vertrag wie der Node-
 * Executor (browser-execute bleibt unverändert), Auth fail-closed, Health aus
 * Browser Run, Session je Durable Object in der EU-Jurisdiktion, Kapazität,
 * Lebensdauer (Leerlauf, Höchstalter, Lebenszeichen) und dass eine verlorene
 * Session nie still wiederbelebt wird. Den Aktions-/Sicherheitskern
 * (GuardedSession) prüft test/executor/executor-chromium.test.ts gegen echtes
 * Chromium — er ist für beide Laufzeiten derselbe.
 */
import { describe, expect, it } from 'vitest';
import { createRouter } from '../../workers/browser-run-executor/src/router';
import { ExecutorSessionCore, type BrowserLike, type SessionLike } from '../../workers/browser-run-executor/src/session-object';
import type { BrowserRunLimits } from '../../workers/browser-run-executor/src/health';
import type { Env, StorageLike } from '../../workers/browser-run-executor/src/env';
import { createExecutorClient } from '../../supabase/functions/_shared/browser-runtime/executor';
import { ExecutorError, LIMITS, type BrowserExecuteRequest } from '../../deploy/playwright-scanner/session-core';

const KEY = 'test-key-0123456789';
const SID = `rsx_${'a'.repeat(32)}`;

function limits(over: Partial<BrowserRunLimits> = {}): BrowserRunLimits {
  return { activeSessions: [], maxConcurrentSessions: 10, allowedBrowserAcquisitions: 1, timeUntilNextAllowedBrowserAcquisition: 0, ...over };
}

// ── Fakes ────────────────────────────────────────────────────────────────────

class FakeStorage implements StorageLike {
  data = new Map<string, unknown>();
  alarm: number | null = null;
  async get<T>(key: string) { return this.data.get(key) as T | undefined; }
  async put(entries: Record<string, unknown>) { for (const [k, v] of Object.entries(entries)) this.data.set(k, v); }
  async delete(keys: string[]) { let n = 0; for (const k of keys) if (this.data.delete(k)) n += 1; return n; }
  async getAlarm() { return this.alarm; }
  async setAlarm(t: number) { this.alarm = t; }
  async deleteAlarm() { this.alarm = null; }
}

class FakeSession implements SessionLike {
  closed = false;
  lastUsedAt: number;
  pings = 0;
  executed: BrowserExecuteRequest[] = [];
  failExecute: ExecutorError | null = null;
  constructor(readonly createdAt: number, private readonly clock: () => number) { this.lastUsedAt = createdAt; }
  touch() { this.lastUsedAt = this.clock(); }
  async run<T>(fn: () => Promise<T>) {
    if (this.closed) throw new ExecutorError('SESSION_NOT_FOUND', 404);
    this.touch();
    return fn();
  }
  async execute(req: BrowserExecuteRequest) {
    return this.run(async () => {
      if (this.failExecute) throw this.failExecute;
      this.executed.push(req);
      return {
        results: [{ index: 0, type: req.actions[0]!.type, ok: true, url: 'https://example.com/', verification: { status: 'passed' as const, checks: {} } }],
        page: { url: 'https://example.com/', title: 'Example', loading: false },
        frame: null,
      };
    });
  }
  async frame() {
    return { page: { url: 'about:blank', title: '', loading: false }, frame: { mime: 'image/jpeg' as const, base64: 'AAAA', sha256: 'f'.repeat(64), bytes: 3, captured_at: '2026-10-01T00:00:00.000Z' } };
  }
  async pageInfo() { this.pings += 1; return { url: 'about:blank', title: '', loading: false }; }
  async close() { this.closed = true; }
}

function harness(opts: { limits?: BrowserRunLimits; failLaunch?: boolean; maxSessions?: number } = {}) {
  let clock = 1_000_000;
  const now = () => clock;
  const storage = new FakeStorage();
  const calls: string[] = [];
  const contexts: unknown[] = [];
  const sessions: FakeSession[] = [];
  let browserSeq = 0;
  const makeBrowser = (id: string): BrowserLike & { closed: boolean } => {
    const b = {
      closed: false,
      async newContext(options: unknown) { contexts.push(options); return {} as never; },
      async close() { b.closed = true; calls.push(`close:${id}`); },
      sessionId: () => id,
    };
    return b;
  };
  const core = new ExecutorSessionCore({
    storage,
    maxSessions: opts.maxSessions ?? 10,
    now,
    browserRun: {
      async launch() {
        calls.push('launch');
        if (opts.failLaunch) throw new Error('launch failed: 429 from upstream with details');
        browserSeq += 1;
        return makeBrowser(`br-${browserSeq}`);
      },
      async connect(id) { calls.push(`connect:${id}`); return makeBrowser(id); },
      async limits() { return opts.limits ?? limits(); },
    },
    sessions: {
      async open() {
        const s = new FakeSession(now(), now);
        sessions.push(s);
        return s;
      },
    },
  });
  const post = (path: string, body: unknown) =>
    core.fetch(new Request(`https://executor-session${path}`, { method: 'POST', body: JSON.stringify(body), headers: { 'content-type': 'application/json' } }));
  return { core, storage, calls, contexts, sessions, post, advance: (ms: number) => { clock += ms; }, now };
}

// ── Durable Object ───────────────────────────────────────────────────────────

describe('ExecutorSession (Durable Object)', () => {
  it('öffnet genau einen Browser je Session, ohne Downloads, merkt sich die Browser-Run-ID und setzt den Alarm', async () => {
    const h = harness();
    const first = await (await h.post('/open', { session_id: SID })).json();
    expect(first).toMatchObject({ ok: true, session_id: SID, version: '2026.10.1', page: { url: 'about:blank' } });
    expect(first.frame.sha256).toMatch(/^[0-9a-f]{64}$/);
    await h.post('/open', { session_id: SID });
    expect(h.calls.filter((c) => c === 'launch')).toHaveLength(1);
    expect(h.contexts[0]).toMatchObject({ acceptDownloads: false, serviceWorkers: 'block', ignoreHTTPSErrors: false });
    expect(h.storage.data.get('browser_session_id')).toBe('br-1');
    expect(h.storage.alarm).toBe(h.now() + 10_000);
  });

  it('parallele Öffnungen teilen sich einen Start', async () => {
    const h = harness();
    await Promise.all([h.post('/open', { session_id: SID }), h.post('/open', { session_id: SID })]);
    expect(h.calls.filter((c) => c === 'launch')).toHaveLength(1);
  });

  it('Kapazität: am Limit kein Start, 429 TOO_MANY_SESSIONS', async () => {
    const h = harness({ limits: limits({ activeSessions: [{ id: 'x' }, { id: 'y' }] }), maxSessions: 2 });
    const res = await h.post('/open', { session_id: SID });
    expect(res.status).toBe(429);
    expect(await res.json()).toEqual({ ok: false, error: 'TOO_MANY_SESSIONS' });
    expect(h.calls).not.toContain('launch');
  });

  it('Start fehlgeschlagen: 503 nur mit Code, keine Spur im Speicher', async () => {
    const h = harness({ failLaunch: true });
    const res = await h.post('/open', { session_id: SID });
    expect(res.status).toBe(503);
    const text = await res.text();
    expect(JSON.parse(text)).toEqual({ ok: false, error: 'EXECUTOR_UNAVAILABLE' });
    expect(text).not.toContain('upstream');
    expect(h.storage.data.size).toBe(0);
  });

  it('führt aus und reicht expected_url unverändert an den Kern', async () => {
    const h = harness();
    await h.post('/open', { session_id: SID });
    const res = await h.post('/execute', {
      session_id: SID, actions: [{ type: 'click', selector: '#a' }], require_session: true, include_frame: true, expected_url: 'https://example.com/',
    });
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ ok: true, session_id: SID, results: [{ ok: true, type: 'click' }] });
    expect(h.sessions[0]!.executed[0]).toMatchObject({ expected_url: 'https://example.com/' });
  });

  it('Fehler des Kerns gehen als Code mit Status und Extras hinaus (PAGE_CHANGED)', async () => {
    const h = harness();
    await h.post('/open', { session_id: SID });
    h.sessions[0]!.failExecute = new ExecutorError('PAGE_CHANGED', 409, { current_url: 'https://example.com/anders' });
    const res = await h.post('/execute', { session_id: SID, actions: [{ type: 'click', selector: '#a' }], require_session: true });
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ ok: false, error: 'PAGE_CHANGED', current_url: 'https://example.com/anders' });
  });

  it('unbekannte Aktion und ungültige Session-ID werden vor dem Browser abgewiesen', async () => {
    const h = harness();
    await h.post('/open', { session_id: SID });
    expect((await h.post('/execute', { session_id: SID, actions: [{ type: 'eval', code: '1' }], require_session: true })).status).toBe(400);
    expect((await h.post('/execute', { session_id: 'kurz', actions: [{ type: 'wait', milliseconds: 1 }] })).status).toBe(400);
    expect(h.sessions[0]!.executed).toHaveLength(0);
  });

  it('verlorenes Objekt (Neustart): SESSION_NOT_FOUND, verwaister Browser wird geschlossen — nie still neu', async () => {
    const h = harness();
    await h.storage.put({ browser_session_id: 'br-alt', opened_at: 1 }); // Stand vor dem Neustart
    const exec = await h.post('/execute', { session_id: SID, actions: [{ type: 'read_text' }], require_session: true });
    expect(exec.status).toBe(404);
    expect(await exec.json()).toEqual({ ok: false, error: 'SESSION_NOT_FOUND' });
    expect(h.calls).toEqual(['connect:br-alt', 'close:br-alt']);
    expect(h.calls).not.toContain('launch');
    expect(h.storage.data.size).toBe(0);
    expect((await h.post('/frame', { session_id: SID })).status).toBe(404);
  });

  it('schließen: Session, Browser, Speicher und Alarm weg; zweites Schließen 404', async () => {
    const h = harness();
    await h.post('/open', { session_id: SID });
    const res = await h.post('/close', { session_id: SID });
    expect(await res.json()).toEqual({ ok: true, session_id: SID, closed: true });
    expect(h.sessions[0]!.closed).toBe(true);
    expect(h.calls).toContain('close:br-1');
    expect(h.storage.data.size).toBe(0);
    expect(h.storage.alarm).toBeNull();
    expect((await h.post('/close', { session_id: SID })).status).toBe(404);
  });

  it('Alarm: Lebenszeichen ohne Fristverlängerung, Leerlauf schließt nach 15 min', async () => {
    const h = harness();
    await h.post('/open', { session_id: SID });
    const s = h.sessions[0]!;
    const lastUse = s.lastUsedAt;
    for (let t = 0; t < 5 * 60_000; t += 10_000) { h.advance(10_000); await h.core.alarm(); }
    expect(s.pings).toBeGreaterThanOrEqual(1);
    expect(s.lastUsedAt).toBe(lastUse); // Lebenszeichen zählt nicht als Nutzung
    expect(h.storage.alarm).toBe(h.now() + 10_000);
    h.advance(LIMITS.sessionIdleTtlMs);
    await h.core.alarm();
    expect(s.closed).toBe(true);
    expect(h.calls).toContain('close:br-1');
    expect(h.storage.alarm).toBeNull();
  });

  it('Alarm: Höchstalter schließt auch bei Nutzung', async () => {
    const h = harness();
    await h.post('/open', { session_id: SID });
    const s = h.sessions[0]!;
    for (let t = 0; t < LIMITS.sessionMaxAgeMs; t += 60_000) { h.advance(60_000); s.touch(); await h.core.alarm(); }
    h.advance(60_000);
    s.touch();
    await h.core.alarm();
    expect(s.closed).toBe(true);
  });

  it('Alarm nach Neustart: verwaisten Browser schließen, Alarm aus', async () => {
    const h = harness();
    await h.storage.put({ browser_session_id: 'br-alt', opened_at: 1 });
    await h.storage.setAlarm(5);
    await h.core.alarm();
    expect(h.calls).toEqual(['connect:br-alt', 'close:br-alt']);
    expect(h.storage.alarm).toBeNull();
  });
});

// ── Worker-Eingang (gleicher Vertrag wie der Node-Executor) ──────────────────

function routerEnv(over: Partial<Env> = {}) {
  const forwarded: Array<{ name: string; jurisdiction: string | null; url: string; body: unknown }> = [];
  const namespace = (jurisdiction: string | null) => ({
    idFromName: (name: string) => ({ toString: () => `${jurisdiction ?? 'global'}:${name}` }),
    get: (id: { toString(): string }) => ({
      async fetch(url: string, init?: RequestInit) {
        const body = JSON.parse(String(init?.body ?? 'null'));
        forwarded.push({ name: id.toString().split(':').slice(1).join(':'), jurisdiction, url, body });
        if (url.endsWith('/open')) {
          return new Response(JSON.stringify({ ok: true, session_id: body.session_id, version: '2026.10.1', page: { url: 'about:blank', title: '', loading: false }, frame: null }), { status: 200 });
        }
        if (url.endsWith('/execute')) {
          return new Response(JSON.stringify({ ok: false, error: 'PAGE_CHANGED', current_url: 'https://example.com/neu' }), { status: 409 });
        }
        return new Response(JSON.stringify({ ok: true }), { status: 200 });
      },
    }),
    jurisdiction: (j: 'eu') => namespace(j),
  });
  const env: Env = {
    BROWSER: { fetch: (() => Promise.reject(new Error('not used'))) as unknown as typeof fetch },
    SESSIONS: namespace(null),
    SCANNER_API_KEY: KEY,
    MAX_SESSIONS: '10',
    ...over,
  };
  return { env, forwarded };
}

describe('Worker-Eingang', () => {
  const ok = () => Promise.resolve(limits({ activeSessions: [{ id: 'a' }] }));
  const router = createRouter({ limits: ok, now: () => 2_000_000, startedAt: 1_000_000 });
  const req = (path: string, init: RequestInit & { key?: string | null } = {}) => {
    const headers = new Headers(init.headers);
    if (init.key !== null) headers.set('authorization', `Bearer ${init.key ?? KEY}`);
    return new Request(`https://executor.example${path}`, { ...init, headers });
  };

  it('ohne Secret fail-closed, ohne/mit falschem Schlüssel 401', async () => {
    const { env } = routerEnv({ SCANNER_API_KEY: undefined });
    expect((await router(req('/health'), env)).status).toBe(503);
    const { env: env2 } = routerEnv();
    expect((await router(req('/health', { key: null }), env2)).status).toBe(401);
    expect((await router(req('/health', { key: 'falsch' }), env2)).status).toBe(401);
    expect((await router(req('/health', { key: `${KEY}x` }), env2)).status).toBe(401);
  });

  it('Health aus Browser Run: der Edge-Client meldet ready; ohne API degraded', async () => {
    const { env } = routerEnv();
    const fetchVia = (r: ReturnType<typeof createRouter>) => (input: string, init?: RequestInit) => r(new Request(input, init), env);
    const client = createExecutorClient({ baseUrl: 'https://executor.example', apiKey: KEY, executorId: 'cf' }, fetchVia(router));
    const health = await client.health();
    expect(health).toMatchObject({ status: 'ready', runtime: 'cloudflare-browser-run', version: '2026.10.1', active_sessions: 1, max_sessions: 10 });
    expect(health.capabilities).toEqual(expect.arrayContaining(['sessions', 'frame', 'expected_url', 'landing_check', 'post_navigation_guard', 'navigate', 'click']));
    expect(health.capabilities).not.toContain('download');

    const broken = createRouter({ limits: () => Promise.reject(new Error('api down')) });
    const degraded = await createExecutorClient({ baseUrl: 'https://executor.example', apiKey: KEY, executorId: 'cf' }, fetchVia(broken)).health();
    expect(degraded).toMatchObject({ status: 'degraded', reason_code: 'EXECUTOR_BROWSER_DISCONNECTED' });
  });

  it('Session-Anfragen gehen an das Durable Object namens session_id in der EU-Jurisdiktion', async () => {
    const { env, forwarded } = routerEnv();
    const client = createExecutorClient({ baseUrl: 'https://executor.example', apiKey: KEY, executorId: 'cf' }, (i, n) => router(new Request(i, n), env));
    const opened = await client.openSession(SID);
    expect(opened.version).toBe('2026.10.1');
    expect(forwarded[0]).toMatchObject({ name: SID, jurisdiction: 'eu', url: 'https://executor-session/open', body: { session_id: SID } });
    // Fehlercode + Extras kommen unverändert beim Edge-Client an.
    await expect(client.execute(SID, { type: 'click', selector: '#a' }, { expectedUrl: 'https://example.com/' }))
      .rejects.toMatchObject({ code: 'PAGE_CHANGED', details: { current_url: 'https://example.com/neu' } });
    expect(forwarded[1]).toMatchObject({ url: 'https://executor-session/execute', body: { expected_url: 'https://example.com/', require_session: true } });
  });

  it('Eingaben: ungültige Session-ID, kaputtes JSON, zu großer Body, falsche Methode, Scan-Endpunkte', async () => {
    const { env, forwarded } = routerEnv();
    const post = (path: string, body: string) => router(req(path, { method: 'POST', body, headers: { 'content-type': 'application/json' } }), env);
    expect((await post('/session/open', JSON.stringify({ session_id: 'kurz' }))).status).toBe(400);
    expect(await (await post('/execute', '{kaputt')).json()).toEqual({ ok: false, error: 'INVALID_JSON' });
    expect((await post('/execute', JSON.stringify({ session_id: SID, pad: 'x'.repeat(1_000_001) }))).status).toBe(413);
    expect((await router(req('/session/open'), env)).status).toBe(405);
    expect(await (await post('/scan/full', JSON.stringify({ url: 'https://example.com' }))).json()).toEqual({ ok: false, error: 'SCAN_NOT_SUPPORTED_ON_THIS_RUNTIME' });
    expect((await router(req('/unbekannt', { method: 'POST', body: '{}' }), env)).status).toBe(404);
    expect(forwarded).toHaveLength(0);
  });
});
