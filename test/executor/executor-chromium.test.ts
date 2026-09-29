// @vitest-environment node
/**
 * Browser-Executor gegen ein echtes Chromium (Integration).
 *
 * Prüft den Vertrag, den browser-execute nutzt, Ende-zu-Ende über HTTP:
 * der echte Server (deploy/playwright-scanner/server.ts) läuft als Kindprozess,
 * angesprochen mit DEMSELBEN Client wie in der Edge Function
 * (supabase/functions/_shared/browser-runtime/executor.ts).
 *
 * Fixture-Server auf 127.0.0.1 ist ausdrücklich freigegeben
 * (EXECUTOR_PRIVATE_HOST_ALLOWLIST) — ein zweiter Fixture-Server ist es nicht
 * und muss für Navigation UND Unterressourcen gesperrt bleiben.
 *
 * Läuft nur, wenn ein Chromium startbar ist (lokal/CI mit Browsern);
 * sonst übersprungen mit Begründung.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createServer, type Server } from 'node:http';
import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { spawn, type ChildProcess } from 'node:child_process';
import { resolve } from 'node:path';
import type { AddressInfo } from 'node:net';
import { createExecutorClient, type ExecutorClient } from '../../supabase/functions/_shared/browser-runtime/executor';

const ROOT = resolve(__dirname, '../..');
const CHROMIUM = process.env.EXECUTOR_CHROMIUM_PATH
  ?? ['/opt/pw-browsers/chromium'].find((p) => existsSync(p))
  ?? null;
const RUN = CHROMIUM !== null && process.env.SKIP_EXECUTOR_IT !== '1';

const DOWNLOAD_BODY = 'Datenschutzerklärung v1 — RealSync Fixture\n';
const DOWNLOAD_SHA = createHash('sha256').update(DOWNLOAD_BODY).digest('hex');
const API_KEY = `it-${Math.random().toString(36).slice(2)}`;

let fixture: Server;
let blocked: Server;
let fixtureOrigin = '';
let blockedOrigin = '';
const blockedHits: string[] = [];
let executorProc: ChildProcess | null = null;
let executorPort = 0;
let client: ExecutorClient;

function listen(server: Server): Promise<number> {
  return new Promise((ok) => server.listen(0, '127.0.0.1', () => ok((server.address() as AddressInfo).port)));
}

async function waitForHealth(url: string, key: string, ms: number): Promise<void> {
  const until = Date.now() + ms;
  while (Date.now() < until) {
    try {
      const r = await fetch(`${url}/health`, { headers: { Authorization: `Bearer ${key}` } });
      if (r.ok) return;
    } catch { /* noch nicht bereit */ }
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error('executor did not become healthy');
}

describe.skipIf(!RUN)('Browser-Executor (echtes Chromium, HTTP-Vertrag)', () => {
  beforeAll(async () => {
    blocked = createServer((req, res) => {
      blockedHits.push(req.url ?? '');
      res.writeHead(200, { 'content-type': 'image/png' });
      res.end();
    });
    const blockedPort = await listen(blocked);
    blockedOrigin = `http://127.0.0.1:${blockedPort}`;

    fixture = createServer((req, res) => {
      const url = new URL(req.url ?? '/', 'http://fixture');
      if (url.pathname === '/') {
        res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
        res.end(`<!doctype html><html><head><title>Fixture</title></head><body style="height:3000px">
          <h1>Hallo Governance</h1>
          <img src="${blockedOrigin}/tracker.png" alt="">
          <form id="f" action="/submitted" method="get">
            <label for="q">Suche</label><input id="q" name="q" value="">
            <select id="country" name="country"><option value="at">AT</option><option value="de">DE</option></select>
            <button id="go" type="submit">Senden</button>
          </form>
          <a id="dl" href="/download">Download</a>
          <a id="p2" href="/page2">Seite 2</a>
        </body></html>`);
        return;
      }
      if (url.pathname === '/page2') {
        res.writeHead(200, { 'content-type': 'text/html' });
        res.end('<!doctype html><title>Page 2</title><p>Zweite Seite</p>');
        return;
      }
      if (url.pathname === '/submitted') {
        res.writeHead(200, { 'content-type': 'text/html' });
        // Eingaben nicht zurückspiegeln (CodeQL: reflected XSS) — geprüft wird nur Titel + URL.
        res.end('<!doctype html><title>Submitted</title><p>Formular empfangen</p>');
        return;
      }
      if (url.pathname === '/download') {
        res.writeHead(200, {
          'content-type': 'text/plain; charset=utf-8',
          'content-disposition': 'attachment; filename="datenschutz.txt"',
        });
        res.end(DOWNLOAD_BODY);
        return;
      }
      res.writeHead(404);
      res.end();
    });
    const fixturePort = await listen(fixture);
    fixtureOrigin = `http://127.0.0.1:${fixturePort}`;

    const probe = createServer();
    executorPort = await listen(probe);
    await new Promise((r) => probe.close(r));

    executorProc = spawn(resolve(ROOT, 'node_modules/.bin/tsx'), [resolve(ROOT, 'deploy/playwright-scanner/server.ts')], {
      env: {
        ...process.env,
        PORT: String(executorPort),
        SCANNER_API_KEY: API_KEY,
        MAX_SESSIONS: '3',
        EXECUTOR_CHROMIUM_PATH: CHROMIUM!,
        EXECUTOR_PRIVATE_HOST_ALLOWLIST: `127.0.0.1:${fixturePort}`,
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    await waitForHealth(`http://127.0.0.1:${executorPort}`, API_KEY, 45_000);
    client = createExecutorClient(
      { baseUrl: `http://127.0.0.1:${executorPort}`, apiKey: API_KEY, executorId: 'it' },
      (input, init) => fetch(input, init),
    );
  }, 60_000);

  afterAll(async () => {
    executorProc?.kill('SIGTERM');
    await new Promise((r) => fixture?.close(r));
    await new Promise((r) => blocked?.close(r));
  });

  it('Health meldet ready mit Capabilities, Laufzeit und Version — nur mit Key', async () => {
    const health = await client.health();
    expect(health.status).toBe('ready');
    expect(health.runtime).toBe('playwright-chromium');
    expect(health.version).toMatch(/^\d{4}\.\d{2}\.\d+$/);
    expect(health.capabilities).toEqual(expect.arrayContaining(['sessions', 'frame', 'navigate', 'click', 'read_dom', 'download']));
    expect(health.max_sessions).toBe(3);

    const noKey = await fetch(`http://127.0.0.1:${executorPort}/health`);
    expect(noKey.status).toBe(401);
    const wrongKey = createExecutorClient({ baseUrl: `http://127.0.0.1:${executorPort}`, apiKey: 'wrong', executorId: 'it' }, (i, n) => fetch(i, n));
    expect((await wrongKey.health()).reason_code).toBe('EXECUTOR_AUTH_FAILED');
  });

  it('eine Session: Aktionen, Verifikation und Frame beziehen sich auf dieselbe Seite', async () => {
    const sid = `rsx_${'a'.repeat(32)}`;
    const opened = await client.openSession(sid);
    expect(opened.page?.url).toBe('about:blank');
    expect(opened.frame?.sha256).toMatch(/^[0-9a-f]{64}$/);

    const nav = await client.execute(sid, { type: 'navigate', url: `${fixtureOrigin}/` });
    expect(nav.result.ok).toBe(true);
    expect(nav.result.verification?.status).toBe('passed');
    expect(nav.result.verification?.checks.http_status).toBe(200);
    expect(nav.page?.title).toBe('Fixture');
    expect(nav.frame?.mime).toBe('image/jpeg');
    const frameBytes = Buffer.from(nav.frame!.base64, 'base64');
    expect(createHash('sha256').update(frameBytes).digest('hex')).toBe(nav.frame!.sha256);

    // Unterressource aus einem NICHT freigegebenen privaten Host wurde blockiert.
    expect(blockedHits).toEqual([]);

    const text = await client.execute(sid, { type: 'read_text' });
    expect(text.result.text).toContain('Hallo Governance');

    const dom = await client.execute(sid, { type: 'read_dom', selector: '#f' });
    const nodes = (dom.result.dom as { nodes: Array<Record<string, unknown>> }).nodes;
    expect(nodes.some((n) => n.id === 'q' && n.tag === 'input' && n.text === null)).toBe(true);

    const typed = await client.execute(sid, { type: 'type', selector: '#q', text: 'geheim123' });
    expect(typed.result.verification).toEqual({ status: 'passed', checks: { value_length_matches: true } });
    expect(JSON.stringify(typed)).not.toContain('geheim123');

    const selected = await client.execute(sid, { type: 'select', selector: '#country', value: 'de' });
    expect(selected.result.verification?.status).toBe('passed');

    const scrolled = await client.execute(sid, { type: 'scroll', direction: 'down', amount: 400 });
    expect(scrolled.result.verification?.checks.moved).toBe(true);

    const shot = await client.execute(sid, { type: 'screenshot' });
    expect(shot.result.screenshot?.sha256).toMatch(/^[0-9a-f]{64}$/);

    const dl = await client.execute(sid, { type: 'download', selector: '#dl' });
    expect(dl.result.download).toMatchObject({ filename: 'datenschutz.txt', sha256: DOWNLOAD_SHA, bytes: Buffer.byteLength(DOWNLOAD_BODY) });

    const submitted = await client.execute(sid, { type: 'submit', selector: '#q' });
    expect(submitted.page?.title).toBe('Submitted');
    expect(submitted.page?.url).toContain('q=geheim123');

    const back = await client.execute(sid, { type: 'back' });
    expect(back.page?.title).toBe('Fixture');
    const forward = await client.execute(sid, { type: 'forward' });
    expect(forward.page?.title).toBe('Submitted');
    const reload = await client.execute(sid, { type: 'reload' });
    expect(reload.result.ok).toBe(true);

    const framed = await client.frame(sid);
    expect(framed.page?.title).toBe('Submitted');
    expect(framed.frame.sha256).toMatch(/^[0-9a-f]{64}$/);

    await client.closeSession(sid);
    await expect(client.frame(sid)).rejects.toMatchObject({ code: 'SESSION_NOT_FOUND' });
  }, 120_000);

  it('blockiert private Ziele, Metadaten und fremde Schemata', async () => {
    const sid = `rsx_${'b'.repeat(32)}`;
    await client.openSession(sid);
    for (const url of [`${blockedOrigin}/`, 'http://169.254.169.254/latest/meta-data', 'http://[::1]/', 'http://localhost/']) {
      await expect(client.execute(sid, { type: 'navigate', url })).rejects.toMatchObject({ code: 'URL_BLOCKED' });
    }
    await expect(client.execute(sid, { type: 'navigate', url: 'file:///etc/passwd' })).rejects.toMatchObject({ code: 'URL_BLOCKED' });
    expect(blockedHits).toEqual([]);
    await client.closeSession(sid);
  }, 60_000);

  it('unbekannte Sessions werden nicht still neu angelegt', async () => {
    await expect(client.execute(`rsx_${'c'.repeat(32)}`, { type: 'read_text' })).rejects.toMatchObject({ code: 'SESSION_NOT_FOUND' });
  });

  it('Kapazitätsgrenze der Sessions greift', async () => {
    const ids = ['d', 'e', 'f', 'g'].map((c) => `rsx_${c.repeat(32)}`);
    await client.openSession(ids[0]);
    await client.openSession(ids[1]);
    await client.openSession(ids[2]);
    await expect(client.openSession(ids[3])).rejects.toMatchObject({ code: 'SESSION_LIMIT_REACHED' });
    for (const id of ids.slice(0, 3)) await client.closeSession(id);
  }, 60_000);
});

describe.runIf(!RUN)('Browser-Executor (übersprungen)', () => {
  it('kein startbares Chromium gefunden — EXECUTOR_CHROMIUM_PATH setzen', () => {
    expect(RUN).toBe(false);
  });
});
